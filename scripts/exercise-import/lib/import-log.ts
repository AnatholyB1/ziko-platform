/**
 * Resume-state reduction over exercise_import_log rows. STUB —
 * implementation pending (TDD RED phase).
 */
export interface ImportLogRow {
  source_id: string;
  exercise_id: string | null;
  status: 'matched' | 'inserted' | 'skipped' | 'needs_review';
  error_message: string | null;
  processed_at: string;
}

export type ResumeState = 'done' | 'retry' | 'unprocessed';

export function computeResumeState(_latest: ImportLogRow | undefined): ResumeState {
  throw new Error('not implemented');
}

export function reduceLatestBySourceId(_rows: ImportLogRow[]): Map<string, ImportLogRow> {
  throw new Error('not implemented');
}

export function buildResumeMap(_rows: ImportLogRow[]): Map<string, ResumeState> {
  throw new Error('not implemented');
}
