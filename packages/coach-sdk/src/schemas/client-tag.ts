import { z } from 'zod';

export const CoachClientTagSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  client_id: z.string().uuid(),
  tag: z.string().min(1).max(50),
  created_at: z.string(),
});
export type CoachClientTag = z.infer<typeof CoachClientTagSchema>;
