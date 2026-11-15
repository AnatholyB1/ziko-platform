/**
 * Revue A #6 : la serie gamification suit la date LOCALE (fuseau force a Europe/Paris, UTC+1 en novembre).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { computeNextStreak, localDay } from './streak';

beforeAll(() => {
  process.env.TZ = 'Europe/Paris';
});

const p = (last: string | null, cur = 3, longest = 5) => ({ current_streak: cur, longest_streak: longest, last_activity_date: last });

describe('computeNextStreak', () => {
  it('activite a 00:30 locale (23:30Z la veille) : date du jour LOCAL, pas la veille UTC', () => {
    const now = new Date(2026, 10, 13, 0, 30);
    expect(now.toISOString().startsWith('2026-11-12')).toBe(true); // l'ancien code aurait ecrit le 12
    expect(computeNextStreak(p('2026-11-12'), now)).toMatchObject({ changed: true, today: '2026-11-13', current_streak: 4 });
  });
  it('deja compte aujourd\'hui : inchange', () => {
    expect(computeNextStreak(p('2026-11-13'), new Date(2026, 10, 13, 0, 30))).toMatchObject({ changed: false, current_streak: 3 });
  });
  it('un jour manque : repart a 1, longest conserve', () => {
    expect(computeNextStreak(p('2026-11-10'), new Date(2026, 10, 13, 12, 0))).toMatchObject({ current_streak: 1, longest_streak: 5 });
  });
  it('met a jour longest quand la serie le depasse', () => {
    expect(computeNextStreak(p('2026-11-12', 5, 5), new Date(2026, 10, 13, 12, 0))).toMatchObject({ current_streak: 6, longest_streak: 6 });
  });
  it('premiere activite (null)', () => {
    expect(computeNextStreak(p(null, 0, 0), new Date(2026, 10, 13, 12, 0))).toMatchObject({ current_streak: 1, longest_streak: 1 });
  });
  it('passage a l\'heure d\'hiver : le 26/10 suit bien le 25/10', () => {
    expect(computeNextStreak(p('2026-10-25'), new Date(2026, 9, 26, 12, 0))).toMatchObject({ current_streak: 4 });
  });
  it('localDay utilise les composants locaux', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
