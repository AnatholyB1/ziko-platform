import { describe, it } from 'vitest';
describe('GET /coach/clients/compare — multi-client comparison data', () => {
  it.todo('returns time-series data for requested client IDs (body weight)');
  it.todo('returns aggregate data for sessions metric');
  it.todo('does not include data for unlinked client IDs');
  it.todo('metric=sleep returns sleep_logs duration data');
  it.todo('metric=mood returns journal_entries mood_score data');
});
