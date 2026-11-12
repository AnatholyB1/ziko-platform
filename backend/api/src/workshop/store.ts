// Phase 23 (v1.20) - D-02/D-03 : acces a `ziko_workshop_drafts` (service key => filtre user_id partout).
import type { DraftProgram } from './draft.js';
import { normalizeProgram, toProgramRow } from './draft.js';
import type { WorkshopDb } from './context.js';
import { WORKSHOP_MAX_DRAFTS } from './limits.js';

export interface DraftRecord {
  id: string;
  user_id: string;
  conversation_id: string | null;
  name: string | null;
  goal: string | null;
  program: DraftProgram | null;
  revision: number;
  status: 'draft' | 'saved';
  saved_program_id: string | null;
  /** P24 : suite et programme precedent (brouillon issu d'une relance), sinon null. */
  sequence_id: string | null;
  previous_program_id: string | null;
}

export function toRecord(row: any): DraftRecord {
  let program: DraftProgram | null = null;
  const pd = row.program_data;
  if (pd && typeof pd === 'object' && Array.isArray(pd.weeks) && pd.weeks.length > 0) {
    try {
      program = normalizeProgram(pd);
    } catch {
      program = null;
    }
  }
  return {
    id: row.id,
    user_id: row.user_id,
    conversation_id: row.conversation_id ?? null,
    name: row.name ?? null,
    goal: row.goal ?? null,
    program,
    revision: Number(row.revision ?? 0),
    status: row.status === 'saved' ? 'saved' : 'draft',
    saved_program_id: row.saved_program_id ?? null,
    sequence_id: row.sequence_id ?? null,
    previous_program_id: row.previous_program_id ?? null,
  };
}

const COLS =
  'id, user_id, conversation_id, name, goal, program_data, revision, status, saved_program_id, sequence_id, previous_program_id';

export async function loadDraft(db: WorkshopDb, userId: string, id: string): Promise<DraftRecord | null> {
  const { data, error } = await db.from('ziko_workshop_drafts').select(COLS).eq('id', id).eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

export async function createDraft(db: WorkshopDb, userId: string, conversationId: string): Promise<DraftRecord> {
  // G-3 : au plus WORKSHOP_MAX_DRAFTS brouillons actifs ; les plus anciens sont archives ('saved' sans programme).
  const { data: active } = await db
    .from('ziko_workshop_drafts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false });
  const extra = ((active ?? []) as Array<{ id: string }>).slice(WORKSHOP_MAX_DRAFTS - 1).map((r) => r.id);
  if (extra.length > 0) {
    await db.from('ziko_workshop_drafts').update({ status: 'saved' }).eq('user_id', userId).in('id', extra);
  }
  const { data, error } = await db
    .from('ziko_workshop_drafts')
    .insert({ user_id: userId, conversation_id: conversationId, program_data: {}, revision: 0, status: 'draft' })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'draft insert failed');
  return toRecord(data);
}

export type SaveResult = { ok: true; draft: DraftRecord } | { ok: false; reason: 'conflict' | 'not_found' | 'saved' };

/** Optimistic write: succeeds only if `revision` still equals expectedRevision (D-03). */
export async function saveDraftProgram(
  db: WorkshopDb,
  userId: string,
  id: string,
  program: DraftProgram,
  expectedRevision: number,
): Promise<SaveResult> {
  const { data, error } = await db
    .from('ziko_workshop_drafts')
    .update({
      name: program.name,
      goal: program.goal,
      program_data: program,
      revision: expectedRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('revision', expectedRevision)
    .eq('status', 'draft')
    .select(COLS);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    const cur = await loadDraft(db, userId, id);
    if (!cur) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: cur.status === 'saved' ? 'saved' : 'conflict' };
  }
  return { ok: true, draft: toRecord(row) };
}

/** "Enregistrer" : insert d'une ligne INACTIVE dans ziko_ai_generated_programs (D-02). */
export async function publishDraft(
  db: WorkshopDb,
  userId: string,
  draft: DraftRecord,
): Promise<{ programId: string } | { error: string }> {
  if (!draft.program) return { error: 'empty_draft' };
  if (draft.status === 'saved' && draft.saved_program_id) return { programId: draft.saved_program_id };
  // P24 (D-10) : un brouillon de relance rattache le programme a la suite, a la position suivante (INACTIF).
  let sequenceCols: { sequence_id?: string; sequence_position?: number } = {};
  if (draft.sequence_id) {
    const { data: last } = await db
      .from('ziko_ai_generated_programs')
      .select('sequence_position')
      .eq('sequence_id', draft.sequence_id)
      .order('sequence_position', { ascending: false })
      .limit(1);
    const lastPos = Array.isArray(last) && last[0] ? Number(last[0].sequence_position) || 0 : 0;
    sequenceCols = { sequence_id: draft.sequence_id, sequence_position: lastPos + 1 };
  }
  const { data, error } = await db
    .from('ziko_ai_generated_programs')
    .insert({ ...toProgramRow(userId, draft.program), ...sequenceCols })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'insert failed' };
  await db
    .from('ziko_workshop_drafts')
    .update({ status: 'saved', saved_program_id: data.id })
    .eq('id', draft.id)
    .eq('user_id', userId);
  return { programId: data.id };
}
