import { z } from 'zod';

// ─── ExerciseSchema ───────────────────────────────────────────
// PROG-02: each exercise has name, sets, reps, optional RPE/RIR/rest
const ExerciseSchema = z.object({
  // From existing exercise library OR free-text (PROG-03)
  exercise_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  sets: z.number().int().min(1).max(50),
  reps: z.number().int().min(1).max(1000),
  // Either RPE (1-10) or RIR (0-5) — at most one
  target_rpe: z.number().min(1).max(10).nullable().optional(),
  target_rir: z.number().int().min(0).max(5).nullable().optional(),
  rest_seconds: z.number().int().min(0).max(3600).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // Confidence score per field (IMPORT-03 — set by AI parser, null when authored manually)
  confidence: z.number().min(0).max(1).nullable().optional(),
}).strict();

// ─── SessionSchema ────────────────────────────────────────────
const SessionSchema = z.object({
  name: z.string().min(1).max(200),
  day_of_week: z.number().int().min(1).max(7).nullable().optional(),
  exercises: z.array(ExerciseSchema).min(1).max(50),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

// ─── WeekSchema ───────────────────────────────────────────────
const WeekSchema = z.object({
  week_number: z.number().int().min(1).max(52),
  sessions: z.array(SessionSchema).min(1).max(14),  // up to 2/day x 7 days
  notes: z.string().max(2000).nullable().optional(),
}).strict();

// ─── ImportedProgramSchema (THE TOP-LEVEL) ────────────────────
export const ImportedProgramSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  goal: z.enum([
    'strength', 'hypertrophy', 'endurance', 'weight_loss',
    'body_recomp', 'hyrox', 'powerlifting', 'general', 'other',
  ]).nullable().optional(),
  equipment: z.array(z.string().max(100)).max(50).nullable().optional(),
  weeks: z.array(WeekSchema).min(1).max(30),  // IMPORT-07: up to 30-page multi-week
  source: z.enum(['ai_import', 'manual', 'template_fork']).nullable().optional(),
  // Confidence aggregate (IMPORT-03)
  overall_confidence: z.number().min(0).max(1).nullable().optional(),
}).strict();
