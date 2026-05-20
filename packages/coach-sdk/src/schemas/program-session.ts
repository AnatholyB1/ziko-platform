import { z } from 'zod';
import { ProgramExerciseSchema } from './program-exercise.js';

// ─── ProgramSessionSchema (D-05) ──────────────────────────────
// Strict schema for a single training session in a coaching program.
export const ProgramSessionSchema = z.object({
  session_id: z.string().uuid(),
  session_name: z.string().min(1).max(100),
  day_of_week: z.number().int().min(1).max(7),
  exercises: z.array(ProgramExerciseSchema),
}).strict();

export type ProgramSession = z.infer<typeof ProgramSessionSchema>;
