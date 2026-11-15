// Phase 24 (v1.20) - ATEL-08 / D-05 : resultats d'un programme termine. Module PUR.
// Langage NEUTRE : aucune notion d'echec. Une adherence faible produit un conseil de reprise
// (`reentry`), jamais un malus. Les valeurs sont stockees dans ziko_ai_generated_programs.results.
import { epley } from '../workshop/context.js';

export interface ResultSession {
  id: string;
  started_at: string;
  total_volume_kg: number | null;
}
export interface ResultSet {
  session_id: string;
  exercise: string;
  weight_kg: number;
  reps: number;
}
export interface LiftChange {
  exercise: string;
  start_e1rm_kg: number;
  end_e1rm_kg: number;
  delta_kg: number;
  delta_pct: number;
}
export type NextPhaseHint = 'progress' | 'consolidate' | 'reentry';

export interface ProgramResults {
  version: 1;
  window: { from: string; to: string };
  sessions_done: number;
  sessions_planned: number | null;
  adherence_pct: number | null;
  total_volume_kg: number;
  lifts: LiftChange[];
  records: Array<{ exercise: string; e1rm_kg: number; best_set: string }>;
  hint: NextPhaseHint;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function hintFor(adherencePct: number | null, sessionsDone: number): NextPhaseHint {
  if (sessionsDone === 0) return 'reentry';
  if (adherencePct === null) return 'consolidate';
  if (adherencePct >= 80) return 'progress';
  if (adherencePct >= 50) return 'consolidate';
  return 'reentry';
}

export function computeResults(input: {
  from: string;
  to: string;
  sessions: ResultSession[];
  sets: ResultSet[];
  plannedSessions: number | null;
}): ProgramResults {
  const sessions = [...input.sessions].sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  const done = sessions.length;
  const adherence =
    input.plannedSessions && input.plannedSessions > 0 ? Math.min(100, Math.round((done / input.plannedSessions) * 100)) : null;

  const half = Math.ceil(sessions.length / 2);
  const firstIds = new Set(sessions.slice(0, half).map((s) => s.id));
  const secondIds = new Set(sessions.slice(half).map((s) => s.id));
  const bestFirst = new Map<string, number>();
  const bestSecond = new Map<string, number>();
  const bestAll = new Map<string, { e1rm: number; set: string }>();
  for (const s of input.sets) {
    const e = epley(s.weight_kg, s.reps);
    if (e === null) continue;
    const bucket = firstIds.has(s.session_id) ? bestFirst : secondIds.has(s.session_id) ? bestSecond : null;
    if (bucket && e > (bucket.get(s.exercise) ?? 0)) bucket.set(s.exercise, e);
    const cur = bestAll.get(s.exercise);
    if (!cur || e > cur.e1rm) bestAll.set(s.exercise, { e1rm: e, set: `${s.weight_kg} kg x ${s.reps}` });
  }

  const lifts: LiftChange[] = [];
  for (const [exercise, start] of bestFirst) {
    const end = bestSecond.get(exercise);
    if (end === undefined) continue;
    lifts.push({
      exercise,
      start_e1rm_kg: start,
      end_e1rm_kg: end,
      delta_kg: round1(end - start),
      delta_pct: round1(((end - start) / start) * 100),
    });
  }
  lifts.sort((a, b) => b.end_e1rm_kg - a.end_e1rm_kg);

  return {
    version: 1,
    window: { from: input.from, to: input.to },
    sessions_done: done,
    sessions_planned: input.plannedSessions,
    adherence_pct: adherence,
    total_volume_kg: Math.round(sessions.reduce((n, s) => n + (Number(s.total_volume_kg) || 0), 0)),
    lifts: lifts.slice(0, 6),
    records: [...bestAll.entries()]
      .map(([exercise, v]) => ({ exercise, e1rm_kg: v.e1rm, best_set: v.set }))
      .sort((a, b) => b.e1rm_kg - a.e1rm_kg)
      .slice(0, 6),
    hint: hintFor(adherence, done),
  };
}

/** Bloc texte (anglais, instructions modele) injecte dans le prompt de relance. Borne. */
export function renderResultsForPrompt(programName: string, goal: string | null, r: ProgramResults, maxChars = 2500): string {
  const L: string[] = [];
  L.push(`Finished program: "${programName}"${goal ? ` (goal: ${goal})` : ''}, ${r.window.from.slice(0, 10)} to ${r.window.to.slice(0, 10)}.`);
  L.push(
    `Sessions logged: ${r.sessions_done}${r.sessions_planned ? ` of ${r.sessions_planned} planned (${r.adherence_pct}%)` : ''}. Total volume: ${r.total_volume_kg} kg.`,
  );
  if (r.lifts.length) {
    L.push('Strength change (estimated 1RM, first half -> second half of the program):');
    r.lifts.forEach((l) => L.push(`- ${l.exercise}: ${l.start_e1rm_kg} -> ${l.end_e1rm_kg} kg (${l.delta_kg >= 0 ? '+' : ''}${l.delta_kg} kg, ${l.delta_pct}%)`));
  } else L.push('Not enough logged sets to compare strength between the two halves.');
  if (r.records.length) L.push('Best estimated 1RM: ' + r.records.map((x) => `${x.exercise} ${x.e1rm_kg} kg`).join(', '));
  L.push(`Suggested direction for the next phase: ${r.hint} (progress = build on it; consolidate = repeat a similar level; reentry = easier, lower-volume return).`);
  const text = L.join('\n');
  return text.length > maxChars ? text.slice(0, maxChars) + '\n…(truncated)' : text;
}
