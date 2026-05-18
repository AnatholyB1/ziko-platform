import { z } from 'zod';

export const ClientSummarySchema = z.object({
  sessions_this_week: z.number().int().min(0),
  habits_pct: z.number().min(0).max(100).nullable(),
  last_workout_at: z.string().nullable(),
  latest_weight_kg: z.number().positive().nullable(),
  mood_delta: z.number().nullable(),       // curr_avg - prev_avg; null if insufficient data
  mood_prev_avg: z.number().nullable(),
  mood_curr_avg: z.number().nullable(),
});
export type ClientSummary = z.infer<typeof ClientSummarySchema>;
