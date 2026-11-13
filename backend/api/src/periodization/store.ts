// Phase 24 (v1.20) - acces base de la periodisation (service key => filtre user_id PARTOUT).
// Tables touchees : ziko_ai_generated_programs, ziko_program_sequences, ziko_program_relaunches,
// ziko_workout_sessions / ziko_session_sets / ziko_exercises (lecture), ziko_ai_cost_log (lecture).
// Aucune table de credits, de gamification ou de serie (D-06 : relance non punitive).
import type { WorkshopDb } from '../workshop/context.js';
import type { ProgramResults, ResultSession, ResultSet } from './results.js';
import { PROGRAM_RELAUNCH_COST_SOURCE, PROGRAM_RELAUNCH_STALE_MS } from './limits.js';
import { buildSequenceItems, type SequenceItem, type SequenceProgramRow } from './sequence.js';

const rows = (res: any): any[] => (res && !res.error && Array.isArray(res.data) ? res.data : []);

export interface ActiveProgramRow {
  id: string;
  name: string;
  goal: string | null;
  days_per_week: number | null;
  program_data: unknown;
  created_at: string;
  started_at: string | null;
  sequence_id: string | null;
  sequence_position: number | null;
  /** Renseigne par closeProgram : un programme actif qui en porte deja un a ete REACTIVE apres sa cloture. */
  results?: unknown;
}

const PROGRAM_COLS = 'id, name, goal, days_per_week, program_data, created_at, started_at, sequence_id, sequence_position';

export async function loadActiveProgram(db: WorkshopDb, userId: string): Promise<ActiveProgramRow | null> {
  const res = await db
    .from('ziko_ai_generated_programs')
    .select(PROGRAM_COLS + ', completed_at, results')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  const r = rows(res).find((x) => !x.completed_at);
  return r ?? null;
}

export async function loadProgram(db: WorkshopDb, userId: string, id: string): Promise<(ActiveProgramRow & { results: ProgramResults | null; is_active?: boolean; completed_at?: string | null }) | null> {
  const { data, error } = await db
    .from('ziko_ai_generated_programs')
    .select(PROGRAM_COLS + ', results, is_active, completed_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export interface WindowData {
  sessions: ResultSession[];
  sets: ResultSet[];
}

/** Seances TERMINEES de l'athlete depuis `from` (les series sont chargees pour ces seances seulement). */
export async function fetchSessionsSince(db: WorkshopDb, userId: string, from: Date): Promise<Array<ResultSession & { ended_at: string }>> {
  const res = await db
    .from('ziko_workout_sessions')
    .select('id, started_at, ended_at, total_volume_kg')
    .eq('user_id', userId)
    .gte('started_at', from.toISOString())
    .order('started_at', { ascending: true })
    .limit(400);
  return rows(res)
    .filter((s) => s.ended_at)
    .map((s) => ({
      id: s.id,
      started_at: String(s.started_at),
      ended_at: String(s.ended_at),
      total_volume_kg: s.total_volume_kg == null ? null : Number(s.total_volume_kg),
    }));
}

export async function fetchSets(db: WorkshopDb, sessionIds: string[]): Promise<ResultSet[]> {
  if (sessionIds.length === 0) return [];
  const setsRes = await db
    .from('ziko_session_sets')
    .select('session_id, exercise_id, reps, weight_kg, completed')
    .in('session_id', sessionIds)
    .limit(5000);
  const sets = rows(setsRes).filter((s) => s.completed !== false && Number(s.weight_kg) > 0 && Number(s.reps) >= 1);
  const exIds = [...new Set(sets.map((s) => s.exercise_id))];
  const names = new Map<string, string>();
  if (exIds.length > 0) {
    for (const e of rows(await db.from('ziko_exercises').select('id, name').in('id', exIds))) names.set(e.id, e.name);
  }
  return sets.map((s) => ({
    session_id: s.session_id,
    exercise: names.get(s.exercise_id) ?? 'Exercice',
    weight_kg: Number(s.weight_kg),
    reps: Number(s.reps),
  }));
}

/** Cloture : le programme n'est plus actif (le suivant n'est JAMAIS active automatiquement, D-02). */
export async function closeProgram(db: WorkshopDb, userId: string, programId: string, results: ProgramResults, now: Date): Promise<void> {
  const { error } = await db
    .from('ziko_ai_generated_programs')
    .update({ completed_at: now.toISOString(), is_active: false, results })
    .eq('id', programId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Suite du programme (creee a la volee, position 1) : idempotent si le programme en a deja une. */
export async function ensureSequence(db: WorkshopDb, userId: string, program: ActiveProgramRow): Promise<string> {
  if (program.sequence_id) return program.sequence_id;
  const { data, error } = await db
    .from('ziko_program_sequences')
    .insert({ user_id: userId, name: program.name, goal: program.goal })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'sequence insert failed');
  const { error: upErr } = await db
    .from('ziko_ai_generated_programs')
    .update({ sequence_id: data.id, sequence_position: 1 })
    .eq('id', program.id)
    .eq('user_id', userId);
  if (upErr) throw new Error(upErr.message);
  return data.id;
}

export type RelaunchStatus = 'pending' | 'proposing' | 'proposed' | 'dismissed';

export interface RelaunchRow {
  id: string;
  user_id: string;
  program_id: string;
  sequence_id: string | null;
  draft_id: string | null;
  status: RelaunchStatus;
  results: ProgramResults | null;
  proposed_at: string | null;
  created_at: string;
  updated_at: string;
}

const RELAUNCH_COLS = 'id, user_id, program_id, sequence_id, draft_id, status, results, proposed_at, created_at, updated_at';

export async function loadRelaunch(db: WorkshopDb, userId: string, id: string): Promise<RelaunchRow | null> {
  const { data, error } = await db.from('ziko_program_relaunches').select(RELAUNCH_COLS).eq('id', id).eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function loadRelaunchByProgram(db: WorkshopDb, userId: string, programId: string): Promise<RelaunchRow | null> {
  const { data, error } = await db
    .from('ziko_program_relaunches')
    .select(RELAUNCH_COLS)
    .eq('program_id', programId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function listRecentRelaunches(db: WorkshopDb, userId: string): Promise<RelaunchRow[]> {
  return rows(
    await db
      .from('ziko_program_relaunches')
      .select(RELAUNCH_COLS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  );
}

/** Idempotent : program_id UNIQUE (ligne existante renvoyee, y compris apres une course 23505). */
export async function createRelaunch(
  db: WorkshopDb,
  userId: string,
  row: { program_id: string; sequence_id: string; draft_id: string; results: ProgramResults },
): Promise<RelaunchRow> {
  const existing = await loadRelaunchByProgram(db, userId, row.program_id);
  if (existing) return existing;
  const { data, error } = await db
    .from('ziko_program_relaunches')
    .insert({ user_id: userId, ...row, status: 'pending' })
    .select(RELAUNCH_COLS)
    .single();
  if (error || !data) {
    const again = await loadRelaunchByProgram(db, userId, row.program_id);
    if (again) return again;
    throw new Error(error?.message ?? 'relaunch insert failed');
  }
  return data;
}

export async function setRelaunchStatus(
  db: WorkshopDb,
  userId: string,
  id: string,
  status: RelaunchStatus,
  extra: Record<string, unknown> = {},
  now = new Date(),
): Promise<void> {
  await db
    .from('ziko_program_relaunches')
    .update({ status, updated_at: now.toISOString(), ...extra })
    .eq('id', id)
    .eq('user_id', userId);
}

/** Compare-and-set pending -> proposing (reprise d'un `proposing` perime). Un seul appelant gagne. */
export async function claimPropose(db: WorkshopDb, userId: string, current: RelaunchRow, now = new Date()): Promise<boolean> {
  const nowIso = now.toISOString();
  if (current.status === 'pending') {
    const res = await db
      .from('ziko_program_relaunches')
      .update({ status: 'proposing', updated_at: nowIso })
      .eq('id', current.id)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select('id');
    return rows(res).length > 0;
  }
  if (current.status === 'proposing' && now.getTime() - new Date(current.updated_at).getTime() > PROGRAM_RELAUNCH_STALE_MS) {
    const res = await db
      .from('ziko_program_relaunches')
      .update({ updated_at: nowIso })
      .eq('id', current.id)
      .eq('user_id', userId)
      .eq('status', 'proposing')
      .eq('updated_at', current.updated_at)
      .select('id');
    return rows(res).length > 0;
  }
  return false;
}

export async function countAutoCallsToday(db: WorkshopDb, userId: string, now = new Date()): Promise<number> {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count } = await db
    .from('ziko_ai_cost_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', PROGRAM_RELAUNCH_COST_SOURCE)
    .gte('created_at', day);
  return typeof count === 'number' ? count : 0;
}

export async function attachDraftSequence(
  db: WorkshopDb,
  userId: string,
  draftId: string,
  sequenceId: string,
  previousProgramId: string,
): Promise<void> {
  await db
    .from('ziko_workshop_drafts')
    .update({ sequence_id: sequenceId, previous_program_id: previousProgramId })
    .eq('id', draftId)
    .eq('user_id', userId);
}

/** Suite courante : celle du programme actif, sinon la plus recente ; programmes ordonnes avec statuts. */
export async function loadCurrentSequence(
  db: WorkshopDb,
  userId: string,
): Promise<{ sequence: { id: string; name: string; goal: string | null } | null; items: SequenceItem[] }> {
  const active = await loadActiveProgram(db, userId);
  let seqId = active?.sequence_id ?? null;
  let seq: { id: string; name: string; goal: string | null } | null = null;
  if (seqId) {
    const { data } = await db.from('ziko_program_sequences').select('id, name, goal').eq('id', seqId).eq('user_id', userId).maybeSingle();
    seq = data ?? null;
  }
  if (!seq) {
    const list = rows(
      await db.from('ziko_program_sequences').select('id, name, goal').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    );
    seq = list[0] ?? null;
    seqId = seq?.id ?? null;
  }
  if (!seq || !seqId) return { sequence: null, items: [] };
  const progs = rows(
    await db
      .from('ziko_ai_generated_programs')
      .select('id, name, goal, sequence_position, is_active, completed_at, started_at, results, program_data')
      .eq('user_id', userId)
      .eq('sequence_id', seqId)
      .order('sequence_position', { ascending: true })
      .limit(30),
  ) as SequenceProgramRow[];
  return { sequence: seq, items: buildSequenceItems(progs) };
}
