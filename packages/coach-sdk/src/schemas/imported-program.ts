import { z } from 'zod';

// ─── ExerciseSchema ───────────────────────────────────────────
// PROG-02: each exercise has name, sets, reps, optional RPE/RIR/rest
//
// Note: Anthropic structured output rejects most JSON Schema validation keywords
// (minimum, maximum, minLength, maxLength, minItems, maxItems, format).
// All range constraints are stripped here — validation happens after parsing.
const ExerciseSchema = z.object({
  // From existing exercise library OR free-text (PROG-03)
  exercise_id: z.string().nullable().optional(),
  name: z.string(),
  sets: z.number().int(),
  reps: z.number().int(),
  // Either RPE (1-10) or RIR (0-5) — at most one
  target_rpe: z.number().nullable().optional(),
  target_rir: z.number().int().nullable().optional(),
  rest_seconds: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Confidence score per field (IMPORT-03 — set by AI parser, null when authored manually)
  confidence: z.number().nullable().optional(),
}).strict();

// ─── SessionSchema ────────────────────────────────────────────
const SessionSchema = z.object({
  name: z.string(),
  day_of_week: z.number().int().nullable().optional(),
  exercises: z.array(ExerciseSchema),
  notes: z.string().nullable().optional(),
}).strict();

// ─── WeekSchema ───────────────────────────────────────────────
const WeekSchema = z.object({
  week_number: z.number().int(),
  sessions: z.array(SessionSchema),
  notes: z.string().nullable().optional(),
}).strict();

// ─── ImportedProgramSchema (THE TOP-LEVEL) ────────────────────
export const ImportedProgramSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  goal: z.enum([
    'strength', 'hypertrophy', 'endurance', 'weight_loss',
    'body_recomp', 'hyrox', 'powerlifting', 'general', 'other',
  ]).nullable().optional(),
  equipment: z.array(z.string()).nullable().optional(),
  weeks: z.array(WeekSchema),
  source: z.enum(['ai_import', 'manual', 'template_fork']).nullable().optional(),
  // Confidence aggregate (IMPORT-03)
  overall_confidence: z.number().nullable().optional(),
}).strict();
