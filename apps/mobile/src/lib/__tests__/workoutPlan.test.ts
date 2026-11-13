import { describe, it, expect } from 'vitest';
import {
  jsDayToIndex,
  normalizePlanSessions,
  buildWeekLayout,
  pickSessionForToday,
  parseReps,
  isCountableSession,
  COUNTABLE_SESSION_OR_FILTER,
  resolveDayIndexBase,
  filterCountableSessions,
  shouldPersistSession,
  defaultDayLayout,
} from '../workoutPlan';

const ex = (name: string, extra: any = {}) => ({ name, sets: 3, reps: '8-12', ...extra });

describe('day mapping', () => {
  it('maps JS getDay (Sun=0) to Monday-first index', () => {
    expect(jsDayToIndex(1)).toBe(0); // Monday
    expect(jsDayToIndex(0)).toBe(6); // Sunday
    expect(jsDayToIndex(6)).toBe(5); // Saturday
  });
});

describe('normalizePlanSessions', () => {
  it('reads weeks[].sessions and honours distinct explicit day_of_week (1=Mon..7=Sun)', () => {
    const data = {
      weeks: [{ w: 1, sessions: [
        { name: 'A', day_of_week: 2, exercises: [ex('Squat')] },
        { name: 'B', day_of_week: 5, exercises: [ex('Bench')] },
        { name: 'C', day_of_week: 7, exercises: [ex('Row')] },
      ] }],
    };
    expect(normalizePlanSessions(data).map((s) => s.dayIndex)).toEqual([1, 4, 6]);
  });

  it('ignores stacked weekdays (import defaults every session to day 1) and spreads by frequency', () => {
    const data = { weeks: [{ w: 1, sessions: [
      { name: 'A', day_of_week: 1, exercises: [ex('Squat')] },
      { name: 'B', day_of_week: 1, exercises: [ex('Bench')] },
      { name: 'C', day_of_week: 1, exercises: [ex('Row')] },
    ] }] };
    expect(normalizePlanSessions(data).map((s) => s.dayIndex)).toEqual([0, 2, 4]);
  });

  it('treats 0-based day_index (0=Monday) correctly', () => {
    const data = { sessions: [
      { name: 'A', day_index: 0, exercises: [ex('x')] },
      { name: 'B', day_index: 3, exercises: [ex('y')] },
    ] };
    expect(normalizePlanSessions(data).map((s) => s.dayIndex)).toEqual([0, 3]);
  });

  it('explicit day_index_base wins: 0-based program without Monday session (review A #9)', () => {
    const pd = { day_index_base: 0, sessions: [
      { name: 'A', day_index: 1, exercises: [ex('x')] },
      { name: 'B', day_index: 3, exercises: [ex('y')] },
      { name: 'C', day_index: 5, exercises: [ex('z')] },
    ] };
    expect(normalizePlanSessions(pd).map((s) => s.dayIndex)).toEqual([1, 3, 5]);
    expect(resolveDayIndexBase(pd, pd.sessions)).toBe(0);
    // same data without the declaration follows the repo convention (ISO, 1 = Monday)
    const { day_index_base: _omit, ...legacy } = pd;
    expect(normalizePlanSessions(legacy).map((s) => s.dayIndex)).toEqual([0, 2, 4]);
  });
  it('treats 1-based day_index when no zero is present', () => {
    const data = { sessions: [
      { name: 'A', day_index: 1, exercises: [ex('x')] },
      { name: 'B', day_index: 4, exercises: [ex('y')] },
    ] };
    expect(normalizePlanSessions(data).map((s) => s.dayIndex)).toEqual([0, 3]);
  });

  it('supports the agent tool shape days[] (sequential "day": 1..n)', () => {
    const data = { days: [
      { day: 1, name: 'Push', exercises: [{ name: 'Bench', sets: 4, reps: '6-8', rest_sec: 90 }] },
      { day: 2, name: 'Pull', exercises: [{ name: 'Row', sets: 4, reps: '8-10' }] },
      { day: 3, name: 'Legs', exercises: [{ name: 'Squat', sets: 4, reps: '5' }] },
    ] };
    const out = normalizePlanSessions(data);
    expect(out.map((s) => s.dayIndex)).toEqual([0, 1, 2]);
    expect(out[0].exercises[0].rest_seconds).toBe(90);
  });

  it('spreads sessions with no weekday info by frequency', () => {
    const data = { sessions: [{ name: 'A', exercises: [ex('a')] }, { name: 'B', exercises: [ex('b')] }] };
    expect(normalizePlanSessions(data).map((s) => s.dayIndex)).toEqual([0, 3]);
  });

  it('returns [] for empty / junk program_data', () => {
    expect(normalizePlanSessions(null)).toEqual([]);
    expect(normalizePlanSessions({ raw: 'text' })).toEqual([]);
    expect(normalizePlanSessions({ weeks: [] })).toEqual([]);
  });

  it('drops exercises without a name and defaults sets to 3', () => {
    const out = normalizePlanSessions({ sessions: [{ name: 'A', exercises: [{ name: '  ' }, { name: 'Dips', sets: 0, reps: 10 }] }] });
    expect(out[0].exercises).toEqual([{ name: 'Dips', sets: 3, reps: 10, exercise_id: null, rest_seconds: null }]);
  });
});

describe('week layout (TRAIN-04)', () => {
  it('shows Repos (null) only on real rest days', () => {
    const data = { weeks: [{ w: 1, sessions: [
      { name: 'A', exercises: [ex('a')] },
      { name: 'B', exercises: [ex('b')] },
      { name: 'C', exercises: [ex('c')] },
    ] }] };
    const slots = buildWeekLayout(normalizePlanSessions(data));
    expect(slots.map((s) => (s ? s.name : 'Repos'))).toEqual(['A', 'Repos', 'B', 'Repos', 'C', 'Repos', 'Repos']);
  });

  it('never drops a session on collision', () => {
    const slots = buildWeekLayout([
      { name: 'A', exercises: [], dayIndex: 2, sourceIndex: 0 },
      { name: 'B', exercises: [], dayIndex: 2, sourceIndex: 1 },
    ]);
    expect(slots.filter(Boolean).length).toBe(2);
  });

  it('default layouts have the right size', () => {
    for (let n = 1; n <= 7; n++) expect(defaultDayLayout(n).length).toBe(n);
  });
});

describe('pickSessionForToday (TRAIN-01/02)', () => {
  const sessions = normalizePlanSessions({ weeks: [{ w: 1, sessions: [
    { name: 'A', exercises: [ex('a')] },
    { name: 'B', exercises: [ex('b')] },
    { name: 'C', exercises: [ex('c')] },
  ] }] }); // Mon, Wed, Fri
  it('picks today session when planned', () => {
    expect(pickSessionForToday(sessions, 2)).toMatchObject({ isToday: true, session: { name: 'B' } });
  });
  it('picks the next planned session on a rest day', () => {
    expect(pickSessionForToday(sessions, 1)).toMatchObject({ isToday: false, session: { name: 'B' } });
  });
  it('wraps around the week', () => {
    expect(pickSessionForToday(sessions, 5)).toMatchObject({ session: { name: 'A' } });
  });
  it('null when no sessions', () => {
    expect(pickSessionForToday([], 0)).toBeNull();
  });
});

describe('parseReps', () => {
  it('parses ranges, singles, numbers and junk', () => {
    expect(parseReps('8-12')).toEqual({ reps: null, reps_min: 8, reps_max: 12 });
    expect(parseReps('12 - 8')).toEqual({ reps: null, reps_min: 8, reps_max: 12 });
    expect(parseReps('10')).toEqual({ reps: 10, reps_min: null, reps_max: null });
    expect(parseReps(5)).toEqual({ reps: 5, reps_min: null, reps_max: null });
    expect(parseReps('AMRAP')).toEqual({ reps: null, reps_min: null, reps_max: null });
    expect(parseReps(null)).toEqual({ reps: null, reps_min: null, reps_max: null });
  });
});

describe('empty sessions are ignored (TRAIN-03)', () => {
  it('counts only sessions with validated sets (or legacy volume)', () => {
    expect(isCountableSession({ total_sets: 0, total_volume_kg: 0 })).toBe(false);
    expect(isCountableSession({ total_sets: null, total_volume_kg: null })).toBe(false);
    expect(isCountableSession({ total_sets: 3, total_volume_kg: 0 })).toBe(true);
    expect(isCountableSession({ total_sets: null, total_volume_kg: 120 })).toBe(true);
  });
  it('legacy finished sessions without totals are kept, open/killed ones are not (review A #8)', () => {
    expect(isCountableSession({ total_sets: null, total_volume_kg: null, ended_at: '2026-01-01T10:00:00Z' })).toBe(true);
    expect(isCountableSession({ total_sets: null, total_volume_kg: null, ended_at: null })).toBe(false);
    expect(isCountableSession({ total_sets: 0, total_volume_kg: 0, ended_at: '2026-01-01T10:00:00Z' })).toBe(false);
  });
  it('server filter mirrors the predicate', () => {
    expect(COUNTABLE_SESSION_OR_FILTER).toContain('and(total_sets.is.null,ended_at.not.is.null)');
  });
  it('filters a week list so the counter (2/4) ignores empty sessions', () => {
    const week = [
      { id: 1, total_sets: 12, total_volume_kg: 3000 },
      { id: 2, total_sets: 0, total_volume_kg: 0 },
      { id: 3, total_sets: 0, total_volume_kg: null },
      { id: 4, total_sets: 8, total_volume_kg: 1500 },
    ];
    expect(filterCountableSessions(week).map((s) => s.id)).toEqual([1, 4]);
  });
  it('write guard', () => {
    expect(shouldPersistSession(0)).toBe(false);
    expect(shouldPersistSession(1)).toBe(true);
  });
});
