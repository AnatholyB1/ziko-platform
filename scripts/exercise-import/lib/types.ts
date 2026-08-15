/**
 * Zod v4 contracts for the exercise-import pipeline.
 *
 * Two deliberately different strictness policies (per 02-PATTERNS.md
 * §Zod `.strict()` composition):
 *  - EXTERNAL input (the upstream dataset) -> plain `z.object({...})`.
 *    Unknown keys are stripped, not rejected, so a benign upstream field
 *    addition does not break the pipeline.
 *  - INTERNAL contract (this pipeline's hand-off to Phase 3, i.e. the
 *    match report) -> `.strict()`. Phase 3 depends on this shape exactly;
 *    an unexpected key should fail loudly, not be silently ignored.
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */
import { z } from 'zod';

// ─── Dataset record (external input) ──────────────────────────────────────

// Verified live against exercises.schema.json ($defs.exercise, JSON Schema
// Draft 2020-12, additionalProperties: false upstream). All 15 fields are
// required upstream.
export const BODY_PART_VALUES = [
  'back',
  'cardio',
  'chest',
  'lower arms',
  'lower legs',
  'neck',
  'shoulders',
  'upper arms',
  'upper legs',
  'waist',
] as const;

export const BodyPartEnum = z.enum(BODY_PART_VALUES);

// EXTERNAL — plain z.object (unknown keys stripped, not rejected): tolerate
// a benign upstream field addition without breaking the pipeline.
export const DatasetExerciseSchema = z.object({
  id: z.string().regex(/^[0-9]{4}$/),
  name: z.string().min(1), // ENGLISH ONLY — there is no translated name field upstream
  category: z.string().min(1),
  body_part: BodyPartEnum,
  equipment: z.string().min(1),
  instructions: z.record(z.string(), z.string()),
  instruction_steps: z.record(z.string(), z.array(z.string())),
  muscle_group: z.string().min(1),
  secondary_muscles: z.array(z.string()),
  target: z.string().min(1),
  media_id: z.string().min(1),
  // Path regexes are a security control, not cosmetic — reject path
  // traversal payloads (e.g. '../../etc/passwd') at parse time, before
  // these strings are ever joined onto a filesystem path (see threat
  // model T-02-01). Built via RegExp(string) rather than a /regex/
  // literal so the 'images/' / 'videos/' prefixes stay grep-able as
  // plain substrings in this file (a JS regex literal must escape the
  // delimiter slash, which would otherwise read as 'images\/').
  image: z.string().regex(new RegExp('^images/.+\\.(jpg|jpeg|png)$')),
  gif_url: z.string().regex(new RegExp('^videos/.+\\.gif$')),
  attribution: z.string().min(1),
  created_at: z.string().min(1),
});

export const DatasetExerciseArraySchema = z.array(DatasetExerciseSchema);

export type DatasetExercise = z.infer<typeof DatasetExerciseSchema>;

// ─── Production row (public.exercises) ────────────────────────────────────

export const ProductionExerciseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_fr: z.string().nullable(),
  category: z.string().nullable(),
  body_part: z.string().nullable(),
  equipment: z.string().nullable(),
  target_muscle: z.string().nullable(),
  secondary_muscles: z.array(z.string()).nullable(),
  is_custom: z.boolean(),
});

export type ProductionExercise = z.infer<typeof ProductionExerciseSchema>;

// ─── Match report contract with Phase 3 (internal — strict) ───────────────

export const MatchTierEnum = z.enum(['tier1', 'tier2', 'tier3']);
export type MatchTier = z.infer<typeof MatchTierEnum>;

export const MatchedOnEnum = z.enum(['name', 'name_fr', 'attributes']);
export type MatchedOn = z.infer<typeof MatchedOnEnum>;

// D-10: the reviewer edits ambiguous rows in place in the JSON report, and
// Phase 3 reads this field directly.
export const HumanDecisionSchema = z
  .discriminatedUnion('action', [
    z
      .object({
        action: z.literal('match'),
        exercise_id: z.string(),
        note: z.string().optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal('insert_new'),
        note: z.string().optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal('skip'),
        note: z.string().optional(),
      })
      .strict(),
  ])
  .nullable();

export type HumanDecision = z.infer<typeof HumanDecisionSchema>;

export const CandidateSchema = z
  .object({
    exercise_id: z.string(),
    production_name: z.string(),
    production_name_fr: z.string().nullable(),
    score: z.number(),
    tier: MatchTierEnum,
    matched_on: MatchedOnEnum,
  })
  .strict();

export type Candidate = z.infer<typeof CandidateSchema>;

// field_conflicts lists any of body_part/equipment/target whose dataset
// value disagrees with the production value on an otherwise-confident name
// match. Per D-02 a conflict is REPORTED, not a downgrade to ambiguous —
// production `name` carries the signal.
export const MatchedRowSchema = z
  .object({
    dataset_id: z.string(),
    dataset_name: z.string(),
    exercise_id: z.string(),
    production_name: z.string(),
    tier: MatchTierEnum,
    score: z.number(),
    matched_on: MatchedOnEnum,
    field_conflicts: z.array(z.string()),
  })
  .strict();

export type MatchedRow = z.infer<typeof MatchedRowSchema>;

export const UnmatchedNewRowSchema = z
  .object({
    dataset_id: z.string(),
    dataset_name: z.string(),
    body_part: z.string(),
    equipment: z.string(),
    target: z.string(),
  })
  .strict();

export type UnmatchedNewRow = z.infer<typeof UnmatchedNewRowSchema>;

export const UnmatchedLegacyRowSchema = z
  .object({
    exercise_id: z.string(),
    production_name: z.string(),
    production_name_fr: z.string().nullable(),
    body_part: z.string().nullable(),
    equipment: z.string().nullable(),
    target_muscle: z.string().nullable(),
  })
  .strict();

export type UnmatchedLegacyRow = z.infer<typeof UnmatchedLegacyRowSchema>;

// D-09: top-N (3) candidates with scores for ambiguous rows.
export const AmbiguousRowSchema = z
  .object({
    dataset_id: z.string(),
    dataset_name: z.string(),
    reason: z.string(),
    candidates: z.array(CandidateSchema).max(3),
    human_decision: HumanDecisionSchema,
  })
  .strict();

export type AmbiguousRow = z.infer<typeof AmbiguousRowSchema>;

// INTERNAL contract — this pipeline's hand-off to Phase 3. Grouped by
// category (never a flat array — D-06's readability floor).
export const MatchReportSchema = z
  .object({
    generated_at: z.string(),
    dataset_commit: z.string(),
    dataset_count: z.number().int(),
    production_count: z.number().int(),
    thresholds: z
      .object({
        tier2: z.number(),
      })
      .strict(),
    warnings: z
      .object({
        // Pitfall-4 safety check: production `name` has no DB-level
        // uniqueness constraint. Any group of production rows sharing a
        // normalized name is surfaced here rather than silently collapsed.
        duplicate_production_names: z.array(
          z
            .object({
              normalized_name: z.string(),
              exercise_ids: z.array(z.string()),
            })
            .strict(),
        ),
      })
      .strict(),
    counts: z
      .object({
        matched: z.number().int(),
        unmatched_new: z.number().int(),
        unmatched_legacy: z.number().int(),
        ambiguous: z.number().int(),
      })
      .strict(),
    matched: z.array(MatchedRowSchema),
    unmatched_new: z.array(UnmatchedNewRowSchema),
    unmatched_legacy: z.array(UnmatchedLegacyRowSchema),
    ambiguous: z.array(AmbiguousRowSchema),
  })
  .strict();

export type MatchReport = z.infer<typeof MatchReportSchema>;

// Maps a match-report category onto the Phase 1 `exercise_import_log`
// status enum (matched | inserted | skipped | needs_review — 01-CONTEXT.md
// D-06) that Phase 3 will read/write. `'skipped'` is intentionally unused
// here: it is Phase 3's resumability marker (a row already processed in a
// prior run), not a match outcome Phase 2 can produce.
export const PHASE3_STATUS_HINT = Object.freeze({
  matched: 'matched',
  unmatched_new: 'inserted',
  unmatched_legacy: 'needs_review',
  ambiguous: 'needs_review',
} as const);

export type Phase3StatusHintKey = keyof typeof PHASE3_STATUS_HINT;
