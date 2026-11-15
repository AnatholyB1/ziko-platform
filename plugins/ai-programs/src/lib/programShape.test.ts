import { describe, it, expect } from 'vitest';
import { getProgramWeekCount, getProgramSessionsPerWeek, getProgramSessionList } from './programShape';

describe('getProgramWeekCount', () => {
  it('number form', () => expect(getProgramWeekCount({ weeks: 6 })).toBe(6));
  it('numeric string form', () => expect(getProgramWeekCount({ weeks: '12' })).toBe(12));
  it('array form ({ w, sessions }) returns a number, never an object', () => {
    const r = getProgramWeekCount({ weeks: [{ w: 1, sessions: [{}, {}] }, { w: 2, sessions: [{}] }] });
    expect(r).toBe(2);
    expect(typeof r).toBe('number');
  });
  it('object form', () => {
    expect(getProgramWeekCount({ weeks: { count: 10 } })).toBe(10);
    expect(getProgramWeekCount({ weeks: { '1': {}, '2': {}, '3': {} } })).toBe(3);
  });
  it('defaults', () => {
    expect(getProgramWeekCount(null)).toBe(8);
    expect(getProgramWeekCount({})).toBe(8);
    expect(getProgramWeekCount({ weeks: [] })).toBe(8);
  });
});

describe('getProgramSessionsPerWeek / getProgramSessionList', () => {
  it('weeks array', () => {
    const pd = { weeks: [{ w: 1, sessions: [{ completed: true }, {}, {}, {}] }] };
    expect(getProgramSessionsPerWeek(pd)).toBe(4);
    expect(getProgramSessionList(pd)).toHaveLength(4);
  });
  it('flat sessions array / sessions_per_week / default', () => {
    expect(getProgramSessionsPerWeek({ sessions: [{}, {}] })).toBe(2);
    expect(getProgramSessionsPerWeek({ weeks: 8, sessions_per_week: 5 })).toBe(5);
    expect(getProgramSessionsPerWeek({ weeks: 8 })).toBe(3);
  });
});
