// Phase 23 (v1.20) - ATEL-04 / D-07 : contexte complet de l'athlete pour l'atelier.
//
// Le client Supabase du backend contourne la RLS (service key) : TOUTES les requetes filtrent
// explicitement sur user_id. Chaque requete est tolerante (une erreur donne une liste vide : le
// contexte est un enrichissement, jamais une cause d'echec du tour).

import { WORKSHOP_CONTEXT_MAX_CHARS } from './limits.js';

/** Minimal structural db : un client Supabase ou un double de test. */
export interface WorkshopDb {
  from(table: string): any;
}

export interface SessionSummary {
  name: string;
  date: string;
  total_volume_kg: number | null;
  top_sets: Array<{ exercise: string; weight_kg: number; reps: number }>;
}

export interface RecordEntry {
  exercise: string;
  e1rm_kg: number;
  best_set: string;
}

export interface WorkshopContext {
  profile: { name: string | null; age: number | null; weight_kg: number | null; height_cm: number | null; goal: string | null } | null;
  sessionsCount: number;
  recentSessions: SessionSummary[];
  records: RecordEntry[];
  programs: Array<{ name: string; goal: string | null; is_active: boolean; created_at: string; source: 'ia' | 'coach' }>;
  measurements: Array<{ date: string; weight_kg: number | null; body_fat_pct: number | null }>;
}

/** Epley : 1RM estime. Non applique au-dela de 12 repetitions (peu fiable). */
export function epley(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > 12) return null;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

const rows = (res: any): any[] => (res && !res.error && Array.isArray(res.data) ? res.data : []);

export async function fetchWorkshopContext(db: WorkshopDb, userId: string, now = new Date()): Promise<WorkshopContext> {
  const since = new Date(now.getTime() - 90 * 86400000).toISOString();

  const [profileRes, sessionsRes, countRes, aiProgramsRes, coachProgramsRes, measRes] = await Promise.all([
    db.from('ziko_user_profiles').select('name, age, weight_kg, height_cm, goal').eq('id', userId).maybeSingle(),
    db
      .from('ziko_workout_sessions')
      .select('id, name, started_at, total_volume_kg')
      .eq('user_id', userId)
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(60),
    db.from('ziko_workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db
      .from('ziko_ai_generated_programs')
      .select('name, goal, is_active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    db
      .from('ziko_workout_programs')
      .select('name, is_active, created_at')
      .eq('assigned_to_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4),
    db
      .from('ziko_body_measurements')
      .select('date, weight_kg, body_fat_pct')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(3),
  ]);

  const sessions = rows(sessionsRes);
  const ids = sessions.map((s) => s.id);
  let sets: any[] = [];
  const exerciseNames = new Map<string, string>();
  if (ids.length > 0) {
    const setsRes = await db
      .from('ziko_session_sets')
      .select('session_id, exercise_id, reps, weight_kg, completed')
      .in('session_id', ids)
      .limit(3000);
    sets = rows(setsRes).filter((s) => s.completed !== false && Number(s.weight_kg) > 0 && Number(s.reps) >= 1);
    const exIds = [...new Set(sets.map((s) => s.exercise_id))];
    if (exIds.length > 0) {
      const exRes = await db.from('ziko_exercises').select('id, name').in('id', exIds);
      for (const e of rows(exRes)) exerciseNames.set(e.id, e.name);
    }
  }

  const name = (id: string) => exerciseNames.get(id) ?? 'Exercice';

  // e1RM records per exercise (best Epley over the last 90 days)
  const best = new Map<string, RecordEntry>();
  for (const s of sets) {
    const w = Number(s.weight_kg);
    const r = Number(s.reps);
    const e = epley(w, r);
    if (e === null) continue;
    const n = name(s.exercise_id);
    const cur = best.get(n);
    if (!cur || e > cur.e1rm_kg) best.set(n, { exercise: n, e1rm_kg: e, best_set: `${w} kg x ${r}` });
  }
  const records = [...best.values()].sort((a, b) => b.e1rm_kg - a.e1rm_kg).slice(0, 8);

  const bySession = new Map<string, any[]>();
  for (const s of sets) {
    if (!bySession.has(s.session_id)) bySession.set(s.session_id, []);
    bySession.get(s.session_id)!.push(s);
  }
  const recentSessions: SessionSummary[] = sessions.slice(0, 12).map((s) => {
    const top = new Map<string, { exercise: string; weight_kg: number; reps: number }>();
    for (const set of bySession.get(s.id) ?? []) {
      const n = name(set.exercise_id);
      const cur = top.get(n);
      if (!cur || Number(set.weight_kg) > cur.weight_kg) top.set(n, { exercise: n, weight_kg: Number(set.weight_kg), reps: Number(set.reps) });
    }
    return {
      name: s.name ?? 'Séance',
      date: String(s.started_at ?? '').slice(0, 10),
      total_volume_kg: s.total_volume_kg == null ? null : Number(s.total_volume_kg),
      top_sets: [...top.values()].slice(0, 4),
    };
  });

  const p = profileRes?.data;
  const programs = [
    ...rows(aiProgramsRes).map((r) => ({ name: r.name, goal: r.goal ?? null, is_active: !!r.is_active, created_at: String(r.created_at ?? ''), source: 'ia' as const })),
    ...rows(coachProgramsRes).map((r) => ({ name: r.name, goal: null, is_active: !!r.is_active, created_at: String(r.created_at ?? ''), source: 'coach' as const })),
  ];

  return {
    profile: p
      ? {
          name: p.name ?? null,
          age: p.age ?? null,
          weight_kg: p.weight_kg == null ? null : Number(p.weight_kg),
          height_cm: p.height_cm == null ? null : Number(p.height_cm),
          goal: p.goal ?? null,
        }
      : null,
    sessionsCount: typeof countRes?.count === 'number' ? countRes.count : sessions.length,
    recentSessions,
    records,
    programs,
    measurements: rows(measRes).map((m) => ({
      date: String(m.date ?? '').slice(0, 10),
      weight_kg: m.weight_kg == null ? null : Number(m.weight_kg),
      body_fat_pct: m.body_fat_pct == null ? null : Number(m.body_fat_pct),
    })),
  };
}

/** Counts displayed on A11 ("Ce que l'IA sait de toi") : real data only. */
export function contextCounts(ctx: WorkshopContext) {
  return { sessions: ctx.sessionsCount, programs: ctx.programs.length, records: ctx.records.length };
}

/** Bounded text block injected in the system prompt. */
export function renderContext(ctx: WorkshopContext, maxChars = WORKSHOP_CONTEXT_MAX_CHARS): string {
  const L: string[] = [];
  if (ctx.profile) {
    const p = ctx.profile;
    L.push(`Athlete: ${p.name ?? '?'}, age ${p.age ?? '?'}, ${p.weight_kg ?? '?'} kg, ${p.height_cm ?? '?'} cm, stated goal: ${p.goal ?? 'not set'}`);
  }
  L.push(`Logged workouts (all time): ${ctx.sessionsCount}`);
  if (ctx.records.length) {
    L.push('Estimated 1RM (Epley, last 90 days):');
    ctx.records.forEach((r) => L.push(`- ${r.exercise}: e1RM ${r.e1rm_kg} kg (best set ${r.best_set})`));
  } else L.push('No usable strength records yet: ask for current maxes instead of guessing.');
  if (ctx.recentSessions.length) {
    L.push('Recent sessions:');
    ctx.recentSessions.forEach((s) => {
      const tops = s.top_sets.map((t) => `${t.exercise} ${t.weight_kg}x${t.reps}`).join(', ');
      L.push(`- ${s.date} ${s.name}${s.total_volume_kg ? ` (${s.total_volume_kg} kg vol)` : ''}${tops ? ': ' + tops : ''}`);
    });
  }
  if (ctx.programs.length) {
    L.push('Previous programs:');
    ctx.programs.forEach((g) => L.push(`- ${g.name} [${g.source}${g.is_active ? ', ACTIVE' : ''}] ${g.goal ?? ''} (${g.created_at.slice(0, 10)})`));
  }
  if (ctx.measurements.length) {
    L.push('Recent measurements: ' + ctx.measurements.map((m) => `${m.date} ${m.weight_kg ?? '?'} kg${m.body_fat_pct ? ` ${m.body_fat_pct}% bf` : ''}`).join(' | '));
  }
  const text = L.join('\n');
  return text.length > maxChars ? text.slice(0, maxChars) + '\n…(truncated)' : text;
}
