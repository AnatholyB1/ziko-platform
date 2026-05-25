import { z } from 'zod';

// ─── ProgramExerciseSchema (D-04) ─────────────────────────────
// Strict schema for a single exercise in an authored coaching program.
// Distinct from ExerciseSchema in imported-program.ts:
//   - field is exercise_name (not name)
//   - reps max is 100 (not 1000), duration_seconds added
//   - no confidence field
//   - all optional/nullable fields are explicitly nullable (no .optional())
export const ProgramExerciseSchema = z.object({
  exercise_id: z.string().uuid().nullable(),
  exercise_name: z.string().min(1).max(100),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100).nullable(),
  duration_seconds: z.number().int().min(1).nullable(),
  target_rpe: z.number().min(1).max(10).nullable(),
  target_rir: z.number().int().min(0).max(5).nullable(),
  rest_seconds: z.number().int().min(0).max(600).nullable(),
  notes: z.string().max(300).nullable(),
}).strict();

export type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;
