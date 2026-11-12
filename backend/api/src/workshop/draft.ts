// Phase 23 (v1.20) - ATEL-05/06 : modele du brouillon de programme de l'atelier IA.
//
// Module PUR (aucun I/O) : normalisation tolerante de ce que renvoie le modele ou l'utilisateur,
// operations d'edition typees (communes a l'IA et a l'edition manuelle, D-03) et conversion vers
// la ligne `ziko_ai_generated_programs` (D-02). Forme = celle que `workoutPlan.ts` (P6) sait
// demarrer : weeks[].sessions[].exercises[] avec day_of_week ISO (1 = lundi) distincts (D-04).

export const LIMITS = {
  maxWeeks: 16,
  maxSessionsPerWeek: 7,
  maxExercisesPerSession: 15,
  maxSets: 20,
  maxRestSeconds: 900,
} as const;

export interface DraftExercise {
  name: string;
  sets: number;
  reps: string | number;
  rest_seconds?: number;
  /** Pourcentage du 1RM (powerlifter), 1..120. */
  pct_1rm?: number;
  rpe?: number;
  tempo?: string;
  note?: string;
}

export interface DraftSession {
  name: string;
  /** ISO : 1 = lundi ... 7 = dimanche. */
  day_of_week: number;
  focus?: string;
  exercises: DraftExercise[];
}

export interface DraftWeek {
  w: number;
  label?: string;
  sessions: DraftSession[];
}

export interface DraftProgram {
  name: string;
  goal: string;
  split_type: string;
  days_per_week: number;
  weeks_count: number;
  weeks: DraftWeek[];
  notes?: string;
}

export class DraftError extends Error {}

const str = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

function num(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

export function normalizeExercise(raw: unknown): DraftExercise {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = str(r.name, 80);
  if (!name) throw new DraftError('exercise.name is required');
  const sets = Math.round(num(r.sets, 1, LIMITS.maxSets) ?? 3);
  let reps: string | number = 10;
  if (typeof r.reps === 'number' && Number.isFinite(r.reps)) reps = Math.round(Math.min(100, Math.max(1, r.reps)));
  else if (typeof r.reps === 'string' && r.reps.trim()) reps = str(r.reps, 16);
  const out: DraftExercise = { name, sets, reps };
  const rest = num(r.rest_seconds ?? r.rest_sec ?? r.rest, 0, LIMITS.maxRestSeconds);
  if (rest !== undefined) out.rest_seconds = Math.round(rest);
  const pct = num(r.pct_1rm, 1, 120);
  if (pct !== undefined) out.pct_1rm = Math.round(pct * 10) / 10;
  const rpe = num(r.rpe, 1, 10);
  if (rpe !== undefined) out.rpe = Math.round(rpe * 2) / 2;
  const tempo = str(r.tempo, 12);
  if (tempo) out.tempo = tempo;
  const note = str(r.note, 160);
  if (note) out.note = note;
  return out;
}

export function normalizeSession(raw: unknown, index: number): DraftSession {
  const r = (raw ?? {}) as Record<string, unknown>;
  const exercisesRaw = Array.isArray(r.exercises) ? r.exercises : [];
  const exercises = exercisesRaw.slice(0, LIMITS.maxExercisesPerSession).map(normalizeExercise);
  const day = Math.round(num(r.day_of_week ?? r.day, 1, 7) ?? 0);
  const out: DraftSession = {
    name: str(r.name ?? r.title, 60) || `Séance ${index + 1}`,
    day_of_week: day >= 1 && day <= 7 ? day : 0,
    exercises,
  };
  const focus = str(r.focus, 60);
  if (focus) out.focus = focus;
  return out;
}

/** Days actually used must be distinct (workoutPlan ignores explicit days otherwise). */
function assignDays(sessions: DraftSession[]): DraftSession[] {
  const used = new Set<number>();
  const layouts: Record<number, number[]> = {
    1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7],
  };
  const layout = layouts[Math.min(7, Math.max(1, sessions.length))] ?? [];
  return sessions.map((s, i) => {
    let d = s.day_of_week;
    if (d < 1 || used.has(d)) {
      d = layout.find((x) => !used.has(x)) ?? ([1, 2, 3, 4, 5, 6, 7].find((x) => !used.has(x)) ?? 7);
    }
    used.add(d);
    return { ...s, day_of_week: d };
  });
}

export function normalizeWeek(raw: unknown, index: number): DraftWeek {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sessionsRaw = Array.isArray(r.sessions) ? r.sessions : [];
  const sessions = assignDays(sessionsRaw.slice(0, LIMITS.maxSessionsPerWeek).map(normalizeSession));
  const out: DraftWeek = { w: index + 1, sessions };
  const label = str(r.label, 40);
  if (label) out.label = label;
  return out;
}

/** Lenient normalisation of a full program. Throws DraftError when nothing usable. */
export function normalizeProgram(raw: unknown): DraftProgram {
  const r = (raw ?? {}) as Record<string, unknown>;
  let weeksRaw: unknown[] = Array.isArray(r.weeks) ? r.weeks : [];
  // Accept a flat `sessions` list as a 1-week template repeated weeks_count times.
  if (weeksRaw.length === 0 && Array.isArray(r.sessions)) {
    const count = Math.round(num(r.weeks_count, 1, LIMITS.maxWeeks) ?? 4);
    weeksRaw = Array.from({ length: count }, () => ({ sessions: r.sessions }));
  }
  const weeks = weeksRaw.slice(0, LIMITS.maxWeeks).map(normalizeWeek);
  if (weeks.length === 0 || weeks.every((w) => w.sessions.length === 0)) {
    throw new DraftError('program needs at least one week with one session');
  }
  const perWeek = Math.max(...weeks.map((w) => w.sessions.length));
  return {
    name: str(r.name, 80) || 'Programme sur mesure',
    goal: str(r.goal, 120) || 'custom',
    split_type: str(r.split_type, 30) || 'custom',
    days_per_week: Math.min(7, Math.max(1, perWeek)),
    weeks_count: weeks.length,
    weeks,
    ...(str(r.notes, 400) ? { notes: str(r.notes, 400) } : {}),
  };
}

// ── Edition ───────────────────────────────────────────────────────────

export type WeekRef = number | 'all';

export type DraftOp =
  | { op: 'set_program'; program: unknown }
  | { op: 'rename'; name: string }
  | { op: 'update_exercise'; week: WeekRef; session: number; index: number; patch: Record<string, unknown> }
  | { op: 'add_exercise'; week: WeekRef; session: number; exercise: unknown; index?: number }
  | { op: 'remove_exercise'; week: WeekRef; session: number; index: number }
  | { op: 'remove_session'; week: WeekRef; session: number };

function targetWeeks(p: DraftProgram, week: WeekRef): DraftWeek[] {
  if (week === 'all') return p.weeks;
  const w = p.weeks[Math.round(Number(week)) - 1];
  if (!w) throw new DraftError(`week ${String(week)} does not exist`);
  return [w];
}

function sessionAt(w: DraftWeek, session: number): DraftSession {
  const s = w.sessions[Math.round(Number(session))];
  if (!s) throw new DraftError(`session index ${String(session)} does not exist in week ${w.w}`);
  return s;
}

/** `session` is a 0-based index into the week's sessions; `week` is 1-based or 'all'. */
export function applyOp(program: DraftProgram, op: DraftOp): DraftProgram {
  if (op.op === 'set_program') return normalizeProgram(op.program);
  const p: DraftProgram = JSON.parse(JSON.stringify(program));
  switch (op.op) {
    case 'rename': {
      const name = str(op.name, 80);
      if (!name) throw new DraftError('name is required');
      p.name = name;
      return p;
    }
    case 'update_exercise':
      for (const w of targetWeeks(p, op.week)) {
        const s = sessionAt(w, op.session);
        const cur = s.exercises[Math.round(Number(op.index))];
        if (!cur) throw new DraftError(`exercise index ${String(op.index)} does not exist`);
        s.exercises[Math.round(Number(op.index))] = normalizeExercise({ ...cur, ...op.patch });
      }
      return p;
    case 'add_exercise': {
      const ex = normalizeExercise(op.exercise);
      for (const w of targetWeeks(p, op.week)) {
        const s = sessionAt(w, op.session);
        if (s.exercises.length >= LIMITS.maxExercisesPerSession) throw new DraftError('too many exercises in session');
        const at = op.index === undefined ? s.exercises.length : Math.min(s.exercises.length, Math.max(0, Math.round(op.index)));
        s.exercises.splice(at, 0, { ...ex });
      }
      return p;
    }
    case 'remove_exercise':
      for (const w of targetWeeks(p, op.week)) {
        const s = sessionAt(w, op.session);
        if (!s.exercises[Math.round(Number(op.index))]) throw new DraftError(`exercise index ${String(op.index)} does not exist`);
        s.exercises.splice(Math.round(Number(op.index)), 1);
      }
      return p;
    case 'remove_session':
      for (const w of targetWeeks(p, op.week)) {
        sessionAt(w, op.session);
        w.sessions.splice(Math.round(Number(op.session)), 1);
      }
      p.days_per_week = Math.min(7, Math.max(1, Math.max(...p.weeks.map((w) => w.sessions.length))));
      if (p.weeks.every((w) => w.sessions.length === 0)) throw new DraftError('program needs at least one session');
      return p;
    default:
      throw new DraftError('unknown op');
  }
}

export function applyOps(program: DraftProgram, ops: DraftOp[]): DraftProgram {
  if (!Array.isArray(ops) || ops.length === 0) throw new DraftError('ops must be a non-empty array');
  if (ops.length > 50) throw new DraftError('too many ops');
  return ops.reduce(applyOp, program);
}

/** Row for ziko_ai_generated_programs (inactive : activation goes through ziko_set_active_program). */
export function toProgramRow(userId: string, p: DraftProgram) {
  return {
    user_id: userId,
    name: p.name,
    goal: p.goal,
    split_type: p.split_type,
    days_per_week: p.days_per_week,
    is_active: false,
    program_data: {
      generated: true,
      workshop: true,
      weeks_count: p.weeks_count,
      weeks: p.weeks,
      ...(p.notes ? { notes: p.notes } : {}),
    },
  };
}

/** Compact text view of the draft for the system prompt (bounded). */
export function renderDraftForPrompt(p: DraftProgram | null, maxChars = 6000): string {
  if (!p) return 'No draft yet.';
  const lines: string[] = [`name: ${p.name} | goal: ${p.goal} | ${p.weeks_count} weeks | ${p.days_per_week} sessions/week`];
  p.weeks.forEach((w) => {
    lines.push(`W${w.w}${w.label ? ` (${w.label})` : ''}`);
    w.sessions.forEach((s, si) => {
      lines.push(`  [${si}] ${s.name} (day ${s.day_of_week})`);
      s.exercises.forEach((e, ei) => {
        const extra = [e.pct_1rm ? `${e.pct_1rm}%1RM` : '', e.rpe ? `RPE${e.rpe}` : '', e.rest_seconds ? `rest ${e.rest_seconds}s` : '']
          .filter(Boolean)
          .join(' ');
        lines.push(`    [${ei}] ${e.name} ${e.sets}x${e.reps}${extra ? ' ' + extra : ''}`);
      });
    });
  });
  const text = lines.join('\n');
  return text.length > maxChars ? text.slice(0, maxChars) + '\n…(truncated)' : text;
}
