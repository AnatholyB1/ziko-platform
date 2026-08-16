/**
 * Per-row unit of work for merge.ts (plan 03-05) — the merge loop calls
 * processRow once for each of the 1,324 rows in the approved match report.
 * This module performs all its Supabase I/O through an INJECTED client
 * (mirroring lib/supabase-client.ts's testable-with-a-stub convention, NOT
 * lib/report.ts's pure-function-with-no-I/O rule): it never constructs a
 * client, never reads any environment variables, and never touches the
 * filesystem directly — readMediaBytes is injected so path containment
 * (resolveInsideRoot + the zod path regexes) stays owned by merge.ts.
 *
 * This module contains no delete-call anywhere, by design (IMPORT-03: no
 * existing row in public.exercises is ever DELETEd — a matched row is
 * UPDATEd in place on its original UUID, an unmatched_new row is INSERTed,
 * and a needs_review row is left untouched).
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here (MODULE
 * SYSTEM CONSTRAINT, see README.md "Module System"): no module-url-meta
 * global, no CommonJS directory global, relative imports stay extensionless.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatasetExercise, Phase3Status } from './types';
import { mapDatasetCategory } from './category';

// The Storage bucket every uploaded thumbnail/GIF lands in (Phase 1
// 20260814_exercise_media_schema.sql — public read, service-role write).
export const EXERCISE_MEDIA_BUCKET = 'exercise-media';

// A thrown error's message is truncated to this length before becoming
// result.errorMessage, so one pathological error can't bloat the import
// log's error_message column unboundedly.
const ERROR_MESSAGE_MAX_LENGTH = 500;

export type MergeRowKind = 'matched' | 'unmatched_new' | 'needs_review';

export interface MergeRowInput {
  kind: MergeRowKind;
  sourceId: string; // dataset_id, or the production exercise_id for unmatched_legacy
  exerciseId: string | null; // matched: report exercise_id; unmatched_new: null; legacy: exercise_id; ambiguous: null
  datasetRecord: DatasetExercise | null; // null for needs_review rows
}

export interface MergeRowDeps {
  client: SupabaseClient;
  readMediaBytes: (datasetRelativePath: string) => Promise<Buffer>; // merge.ts supplies a resolveInsideRoot-guarded reader
  capImage: (b: Buffer) => Promise<Buffer>;
  capGif: (b: Buffer) => Promise<Buffer>;
  withRetry: <T>(fn: () => Promise<T>) => Promise<T>;
  newId: () => string; // injectable crypto.randomUUID for deterministic tests
}

export interface MergeRowResult {
  sourceId: string;
  exerciseId: string | null; // non-null ONLY if the row is known to exist in public.exercises
  status: Phase3Status; // never 'skipped' — that is merge.ts's resume marker, not a row outcome
  errorMessage: string | null;
  categoryOmitted: boolean; // true when mapDatasetCategory returned null on a matched row
}

/**
 * Derives this exercise's storage folder-per-exercise_id + fixed-filenames
 * paths (Phase 1 01-CONTEXT.md D-03/D-04). The object key is derived ONLY
 * from the exercise UUID, never from any dataset-supplied string (T-03-11)
 * — no dataset value (media_id, record.image, ...) is ever concatenated
 * into a storage path.
 */
export function storagePaths(exerciseId: string): { thumb: string; gif: string } {
  return {
    thumb: `${exerciseId}/thumb.png`,
    gif: `${exerciseId}/animation.gif`,
  };
}

/**
 * Builds the public.exercises column map to write for one row (D-01
 * full-refresh field list). `forInsert: false` (UPDATE, matched rows) and
 * `forInsert: true` (INSERT, unmatched_new rows) diverge only in the
 * category-guard fallback and in the id/name/is_custom fields appended
 * below — every other field is written identically in both cases.
 */
export function buildExercisePayload(
  record: DatasetExercise,
  exerciseId: string,
  opts: { forInsert: boolean },
): Record<string, unknown> {
  const paths = storagePaths(exerciseId);

  // D-01 full-refresh field list: media paths plus body_part/equipment/
  // target_muscle/secondary_muscles/category plus instructions. This list
  // is deliberately NOT extended with `name`/`name_fr` here — see the
  // D-02 comment below, right where those two fields are handled.
  const payload: Record<string, unknown> = {
    body_part: record.body_part,
    equipment: record.equipment,
    target_muscle: record.target,
    secondary_muscles: record.secondary_muscles,
    instructions: record.instructions.en,
    instructions_fr: record.instructions.fr,
    instruction_steps: record.instruction_steps,
    image: paths.thumb,
    gif: paths.gif,
  };

  const mappedCategory = mapDatasetCategory(record.category);
  if (mappedCategory !== null) {
    payload.category = mappedCategory;
  } else if (opts.forInsert) {
    // exercises.category is NOT NULL, so an INSERT has no existing value to
    // fall back on — fail the row loudly, naming the raw unmappable value.
    throw new Error(
      `Cannot INSERT exercise (dataset_id: ${record.id}): dataset category "${record.category}" is not one of the CHECK-allowed values`,
    );
  }
  // else: forInsert is false (UPDATE) — OMIT the `category` key entirely so
  // production's existing valid value is left untouched. The caller
  // (processRow) reports this omission via result.categoryOmitted.

  if (opts.forInsert) {
    payload.id = exerciseId;
    payload.name = record.name;
    payload.is_custom = false;
  }
  // D-02: production's `name`/`name_fr` are NEVER written on an UPDATE —
  // the dataset has no French name field and production's existing names
  // carry the match signal, so an UPDATE payload must never include them.

  return payload;
}

function toErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.length > ERROR_MESSAGE_MAX_LENGTH ? message.slice(0, ERROR_MESSAGE_MAX_LENGTH) : message;
}

/**
 * Executes the ordered per-row flow for a single match-report row and
 * ALWAYS resolves (never rethrows — D-06 log-and-continue). Any throw
 * anywhere in the flow is caught and converted into a MergeRowResult whose
 * `status` is the row's INTENDED status (Phase 1's CHECK constraint has no
 * `'error'` value) and whose `errorMessage` carries the failure.
 */
export async function processRow(input: MergeRowInput, deps: MergeRowDeps): Promise<MergeRowResult> {
  if (input.kind === 'needs_review') {
    // IMPORT-05: a needs_review row (unmatched_legacy or ambiguous) never
    // touches Storage or public.exercises — it is left alone for manual
    // review, never auto-merged.
    return {
      sourceId: input.sourceId,
      exerciseId: input.exerciseId,
      status: 'needs_review',
      errorMessage: null,
      categoryOmitted: false,
    };
  }

  const intendedStatus: Phase3Status = input.kind === 'matched' ? 'matched' : 'inserted';

  try {
    if (!input.datasetRecord) {
      throw new Error(`Missing datasetRecord for ${input.kind} row (sourceId: ${input.sourceId})`);
    }
    const record = input.datasetRecord;

    let exerciseId: string;
    if (input.kind === 'matched') {
      if (!input.exerciseId) {
        throw new Error(`Matched row (sourceId: ${input.sourceId}) has no exerciseId`);
      }
      exerciseId = input.exerciseId;
    } else {
      exerciseId = deps.newId();
    }

    const paths = storagePaths(exerciseId);

    // 1. Read source media bytes (order matters: image before gif_url).
    const thumbSrc = await deps.readMediaBytes(record.image);
    const gifSrc = await deps.readMediaBytes(record.gif_url);

    // 2. Cap both — NOT wrapped in withRetry (a resize failure is
    // deterministic; retrying only burns time).
    const thumb = await deps.capImage(thumbSrc);
    const gif = await deps.capGif(gifSrc);

    // 3. Upload both, each wrapped in withRetry. upsert: true makes a
    // re-run overwrite instead of throwing (idempotent re-processing).
    await deps.withRetry(async () => {
      const { error } = await deps.client.storage
        .from(EXERCISE_MEDIA_BUCKET)
        .upload(paths.thumb, thumb, { contentType: 'image/png', upsert: true });
      if (error) throw error;
    });

    await deps.withRetry(async () => {
      const { error } = await deps.client.storage
        .from(EXERCISE_MEDIA_BUCKET)
        .upload(paths.gif, gif, { contentType: 'image/gif', upsert: true });
      if (error) throw error;
    });

    if (input.kind === 'matched') {
      // 4. Snapshot the pre-UPDATE row into exercises_merge_backup BEFORE
      // the UPDATE (MEDIA-04). A failed backup aborts this row's UPDATE.
      const { data: currentRow, error: selectError } = await deps.client
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single();
      if (selectError || !currentRow) {
        throw selectError ?? new Error('row vanished before backup');
      }

      const { error: backupError } = await deps.client.from('exercises_merge_backup').insert(currentRow);
      if (backupError) throw backupError;

      const categoryOmitted = mapDatasetCategory(record.category) === null;
      const payload = buildExercisePayload(record, exerciseId, { forInsert: false });

      // 5. Only now perform the UPDATE — never before a successful backup.
      await deps.withRetry(async () => {
        const { error } = await deps.client.from('exercises').update(payload).eq('id', exerciseId);
        if (error) throw error;
      });

      return {
        sourceId: input.sourceId,
        exerciseId,
        status: 'matched',
        errorMessage: null,
        categoryOmitted,
      };
    }

    // unmatched_new: no "before" state to back up — INSERT directly.
    const payload = buildExercisePayload(record, exerciseId, { forInsert: true });

    await deps.withRetry(async () => {
      const { error } = await deps.client.from('exercises').insert(payload);
      if (error) throw error;
    });

    return {
      sourceId: input.sourceId,
      exerciseId,
      status: 'inserted',
      errorMessage: null,
      categoryOmitted: false,
    };
  } catch (err) {
    return {
      sourceId: input.sourceId,
      // A failed unmatched_new row must never carry a UUID that does not
      // exist in public.exercises — that would violate the import log
      // table's FK on exercise_id.
      exerciseId: input.kind === 'matched' ? input.exerciseId : null,
      status: intendedStatus,
      errorMessage: toErrorMessage(err),
      categoryOmitted: false,
    };
  }
}
