/**
 * Revue A #5/#6 : les jours se comptent en date LOCALE. Le fuseau est force a Europe/Paris
 * (UTC+1 en novembre, UTC+2 en ete) pour exercer la fenetre minuit-02h00 ou UTC et local different.
 * Si l'environnement ignorait TZ, le test "UTC != local" l'indiquerait explicitement.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { localDateKey, localDateKeyFromISO, consecutiveDayStreak } from '../localDate';

beforeAll(() => {
  process.env.TZ = 'Europe/Paris';
});

describe('fuseau de test', () => {
  it('Paris est bien applique (sinon les tests de minuit ne prouvent rien)', () => {
    // 23:30Z le 12 = 00:30 le 13 a Paris (hiver, UTC+1)
    expect(new Date('2026-11-12T23:30:00Z').getDate()).toBe(13);
  });
});

describe('localDateKeyFromISO', () => {
  it('une seance a 00:10 locale appartient au jour local, pas a la veille UTC', () => {
    expect(localDateKeyFromISO('2026-11-12T23:10:00Z')).toBe('2026-11-13');
    expect('2026-11-12T23:10:00Z'.split('T')[0]).toBe('2026-11-12'); // l'ancien comportement (UTC)
  });
  it('localDateKey utilise les composants locaux', () => {
    expect(localDateKey(new Date(2026, 10, 13, 0, 5))).toBe('2026-11-13');
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('consecutiveDayStreak (useSessionStreak)', () => {
  it('seance a 00:30 locale (23:30Z la veille) = comptee aujourd\'hui', () => {
    const now = new Date(2026, 10, 13, 0, 45); // 13/11 00:45 Paris
    expect(consecutiveDayStreak(['2026-11-12T23:30:00Z'], now)).toBe(1);
  });
  it('deux jours consecutifs a cheval sur minuit UTC', () => {
    const now = new Date(2026, 10, 13, 9, 0);
    // 12/11 00:30 Paris (= 11/11 23:30Z) et 13/11 00:10 Paris (= 12/11 23:10Z)
    expect(consecutiveDayStreak(['2026-11-11T23:30:00Z', '2026-11-12T23:10:00Z'], now)).toBe(2);
  });
  it('plusieurs seances le meme jour comptent une fois ; un trou coupe la serie', () => {
    const now = new Date(2026, 10, 13, 18, 0);
    expect(consecutiveDayStreak(['2026-11-13T08:00:00Z', '2026-11-13T16:00:00Z', '2026-11-11T10:00:00Z'], now)).toBe(1);
  });
  it('rien aujourd\'hui = 0 (meme si hier existe)', () => {
    expect(consecutiveDayStreak(['2026-11-12T10:00:00Z'], new Date(2026, 10, 13, 12, 0))).toBe(0);
  });
  it('traverse le passage a l\'heure d\'hiver (25 h le 25/10/2026) sans sauter un jour', () => {
    const now = new Date(2026, 9, 26, 12, 0);
    const days = ['2026-10-26T10:00:00Z', '2026-10-25T10:00:00Z', '2026-10-24T10:00:00Z'];
    expect(consecutiveDayStreak(days, now)).toBe(3);
  });
});
