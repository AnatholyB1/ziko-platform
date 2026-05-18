import { describe, it } from 'vitest';
describe('GET /coach/clients/:id/summary — executive summary aggregates', () => {
  it.todo('returns sessions_this_week count for current week');
  it.todo('returns habits_pct as 7-day average completion rate');
  it.todo('returns last_workout_at relative to now');
  it.todo('returns mood_delta computed from last 14 days');
  it.todo('returns null fields when athlete has no data');
  it.todo('unlinked coach gets empty/403');
});
