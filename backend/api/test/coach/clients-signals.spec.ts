import { describe, it } from 'vitest';
describe('signal flag computation — threshold unit tests', () => {
  it.todo('signal_missed: true when no workout_sessions in last 14 days');
  it.todo('signal_stale: true when no body_measurements in last 28 days');
  it.todo('signal_mood: true when last-3 avg < prev-3 avg');
  it.todo('all signals false when data is current');
});
