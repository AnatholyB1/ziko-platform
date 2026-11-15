// P22 (G-03) : journal_log_mood — date calendaire Europe/Paris (pas UTC), contexte valide,
// 1 entree 'general' par jour (mise a jour). Pur unitaire (db mockee).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rows: any[] = [];
const CHECK = ['pre_workout', 'post_workout', 'morning', 'evening', 'general'];

function chainFor() {
  const filters: [string, unknown][] = [];
  let op: 'select' | 'insert' | 'update' = 'select';
  let patch: any;
  const chain: any = {
    select: () => chain,
    eq: (c: string, v: unknown) => (filters.push([c, v]), chain),
    order: () => chain,
    limit: () => chain,
    insert: (r: any) => ((op = 'insert'), (patch = r), chain),
    update: (p: any) => ((op = 'update'), (patch = p), chain),
    single: async () => {
      if (op === 'insert') {
        if (!CHECK.includes(patch.context)) return { data: null, error: { message: 'check violation' } };
        const row = { id: `r${rows.length + 1}`, ...patch };
        rows.push(row);
        return { data: row, error: null };
      }
      const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      hit.forEach((r) => Object.assign(r, patch));
      return { data: hit[0] ?? null, error: null };
    },
    then: (res: any) => res({ data: rows.filter((r) => filters.every(([c, v]) => r[c] === v)), error: null }),
  };
  return chain;
}

vi.mock('../../src/tools/db.js', () => ({ clientForUser: () => ({ from: () => chainFor() }) }));

import { journal_log_mood, localDay, normalizeContext } from '../../src/tools/journal.js';

describe('journal_log_mood (P22)', () => {
  beforeEach(() => {
    rows.length = 0;
    vi.useRealTimers();
  });

  it('localDay suit Europe/Paris, pas UTC (23h30 UTC le 11 nov = 12 nov a Paris)', () => {
    expect(localDay(new Date('2026-11-11T23:30:00Z'))).toBe('2026-11-12');
    expect(localDay(new Date('2026-11-12T10:00:00Z'))).toBe('2026-11-12');
  });

  it('normalise les contextes hors CHECK en general', () => {
    expect(normalizeContext('afternoon')).toBe('general');
    expect(normalizeContext('post_workout')).toBe('post_workout');
  });

  it('un contexte invalide ne viole plus le CHECK', async () => {
    const r: any = await journal_log_mood({ mood: 4, context: 'afternoon' }, 'u1');
    expect(r.success).toBe(true);
    expect(rows[0].context).toBe('general');
  });

  it('1 entree general par jour : le 2e appel met a jour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T23:30:00Z'));
    await journal_log_mood({ mood: 3 }, 'u1');
    const r: any = await journal_log_mood({ mood: 5 }, 'u1');
    expect(r.updated).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mood: 5, date: '2026-11-12' });
  });

  it('un autre moment cree une entree distincte', async () => {
    await journal_log_mood({ mood: 3, context: 'morning' }, 'u1');
    await journal_log_mood({ mood: 3, context: 'evening' }, 'u1');
    expect(rows).toHaveLength(2);
  });
});
