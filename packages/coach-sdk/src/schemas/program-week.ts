import { z } from 'zod';
import { ProgramSessionSchema } from './program-session.js';

// ─── ProgramWeekSchema (D-05) ─────────────────────────────────
// Strict schema for a single week in a coaching program.
export const ProgramWeekSchema = z.object({
  week_number: z.number().int().min(1),
  sessions: z.array(ProgramSessionSchema),
}).strict();

export type ProgramWeek = z.infer<typeof ProgramWeekSchema>;
