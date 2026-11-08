// Phase 47 (v1.18) OPS-01 — athlete_state wired into fetchUserContext as an
// additional parallel query and rendered as a bounded system-prompt section.
// Pure unit spec (mocked db), runs unconditionally.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let stateResult: { data: unknown; error: unknown } = { data: null, error: null };
const fromCalls: string[] = [];

function makeChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => (table === 'ziko_athlete_state' ? stateResult : { data: null, error: null })),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  return chain;
}

vi.mock('../../src/tools/db.js', () => ({
  clientForUser: vi.fn(() => ({
    from: (table: string) => {
      fromCalls.push(table);
      return makeChain(table);
    },
  })),
}));

import {
  fetchUserContext,
  buildAthleteStateSection,
  ATHLETE_STATE_FOCUS_MAX_CHARS,
} from '../../src/context/user.js';

describe('athlete_state context (OPS-01)', () => {
  beforeEach(() => {
    fromCalls.length = 0;
    stateResult = { data: null, error: null };
  });

  it('queries ziko_athlete_state alongside the 7 existing reads (8 total)', async () => {
    await fetchUserContext('u1');
    expect(fromCalls).toHaveLength(8);
    expect(fromCalls).toContain('ziko_athlete_state');
  });

  it('uses fail-safe defaults when no row exists', async () => {
    const ctx = await fetchUserContext('u1');
    expect(ctx.athleteState).toEqual({ level: 1, tier: 1, points: 0, readiness: 'fragile', focus: null });
    const section = buildAthleteStateSection(ctx.athleteState);
    expect(section).toContain('## Coaching State');
    expect(section).toContain('Level: 1 | Tier: 1 | Points: 0');
    expect(section).toContain('Readiness: fragile');
    expect(section).toContain('none set yet');
  });

  it('renders the row values with only the five whitelisted fields', async () => {
    stateResult = {
      data: {
        level: 4, tier: 2, points: 350, readiness: 'ready',
        current_focus_summary: 'Build consistency',
        rolling_summary: 'SECRET-ROLLING', onboarding_profile: { x: 'SECRET-PROFILE' },
      },
      error: null,
    };
    const ctx = await fetchUserContext('u1');
    const section = buildAthleteStateSection(ctx.athleteState);
    expect(section).toContain('Level: 4 | Tier: 2 | Points: 350');
    expect(section).toContain('Readiness: ready');
    expect(section).toContain('Current focus: Build consistency');
    expect(section).not.toContain('SECRET');
  });

  it('bounds the section size and collapses newlines in an oversized focus', async () => {
    stateResult = {
      data: { level: 1, tier: 1, points: 0, readiness: 'building', current_focus_summary: 'x\n'.repeat(5000) },
      error: null,
    };
    const ctx = await fetchUserContext('u1');
    expect(ctx.athleteState.focus!.length).toBeLessThanOrEqual(ATHLETE_STATE_FOCUS_MAX_CHARS);
    const section = buildAthleteStateSection(ctx.athleteState);
    expect(section.length).toBeLessThan(500);
    expect(section.split('\n')).toHaveLength(4);
  });

  it('sanitises invalid column values to defaults', async () => {
    stateResult = { data: { level: -3, tier: 'abc', points: null, readiness: 'bogus' }, error: null };
    const ctx = await fetchUserContext('u1');
    expect(ctx.athleteState).toEqual({ level: 1, tier: 1, points: 0, readiness: 'fragile', focus: null });
  });
});
