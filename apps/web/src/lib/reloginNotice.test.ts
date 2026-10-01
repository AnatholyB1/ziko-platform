import { describe, expect, it } from 'vitest';
import { getReloginNoticeState, NOTICE_LEAD_DAYS, NOTICE_TAIL_DAYS } from './reloginNotice';

const NOT_VISIBLE = { visible: false, cutover: null, phase: null };

describe('getReloginNoticeState', () => {
  const now = new Date('2026-10-24T00:00:00Z');

  it('exposes the window constants', () => {
    expect(NOTICE_LEAD_DAYS).toBe(21);
    expect(NOTICE_TAIL_DAYS).toBe(7);
  });

  it('is hidden when no cutover date is configured', () => {
    expect(getReloginNoticeState(now, undefined)).toEqual(NOT_VISIBLE);
    expect(getReloginNoticeState(now, '')).toEqual(NOT_VISIBLE);
  });

  it('is hidden for malformed or non YYYY-MM-DD values', () => {
    expect(getReloginNoticeState(now, 'not-a-date')).toEqual(NOT_VISIBLE);
    expect(getReloginNoticeState(now, '2026-11-15T00:00:00Z')).toEqual(NOT_VISIBLE);
    expect(getReloginNoticeState(now, '15/11/2026')).toEqual(NOT_VISIBLE);
    expect(getReloginNoticeState(now, '2026-13-45')).toEqual(NOT_VISIBLE);
    expect(getReloginNoticeState(now, '2026-02-31')).toEqual(NOT_VISIBLE);
  });

  it('is hidden 22 days before the cutover', () => {
    expect(getReloginNoticeState(new Date('2026-10-24T00:00:00Z'), '2026-11-15').visible).toBe(false);
  });

  it('is visible (before) exactly 21 days before the cutover', () => {
    const s = getReloginNoticeState(new Date('2026-10-25T00:00:00Z'), '2026-11-15');
    expect(s.visible).toBe(true);
    expect(s.phase).toBe('before');
    expect(s.cutover?.toISOString()).toBe('2026-11-15T00:00:00.000Z');
  });

  it('is visible (after) once the cutover has passed', () => {
    const s = getReloginNoticeState(new Date('2026-11-20T00:00:00Z'), '2026-11-15');
    expect(s.visible).toBe(true);
    expect(s.phase).toBe('after');
  });

  it('is hidden just over 7 days after the cutover day starts', () => {
    expect(getReloginNoticeState(new Date('2026-11-22T00:00:00Z'), '2026-11-15').visible).toBe(true);
    expect(getReloginNoticeState(new Date('2026-11-22T00:00:01Z'), '2026-11-15').visible).toBe(false);
  });
});
