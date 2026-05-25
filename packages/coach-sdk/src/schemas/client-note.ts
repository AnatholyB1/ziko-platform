import { z } from 'zod';

export const CoachClientNoteSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  client_id: z.string().uuid(),
  content: z.string(),
  updated_at: z.string(),
});
export type CoachClientNote = z.infer<typeof CoachClientNoteSchema>;
