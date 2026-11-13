import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatLitersFr } from './formatFr';
import { formatLitres as quickLogLitres } from '../../../apps/mobile/src/lib/quickLog';
import { formatLitres as hydrationLitres } from '../../../plugins/hydration/src/settings';
import { displayStreak } from '../../../plugins/gamification/src/streak';

// UAT run 9, defaut 4 : l'accueil affichait `14,8 L` (carte Forme du jour) et `14,75 L` (tuile Quick Log).
describe('un seul formatage des litres (1 decimale FR) sur tous les ecrans', () => {
  const samples = [0, 50, 250, 1000, 1250, 1750, 2000, 14500, 14750, 14800, 15500, 99999];
  it.each(samples)('%i ml : SDK = Quick Log = hydratation', (ml) => {
    expect(quickLogLitres(ml)).toBe(formatLitersFr(ml));
    expect(hydrationLitres(ml)).toBe(formatLitersFr(ml));
  });
  it('14 750 ml -> `14,8 L` partout (plus jamais `14,75 L`)', () => {
    expect(formatLitersFr(14750)).toBe('14,8 L');
    expect(quickLogLitres(14750)).toBe('14,8 L');
    expect(hydrationLitres(14750)).toBe('14,8 L');
  });
});

describe('displayStreak : une seule serie (gamification) pour accueil / Recompenses / Profil (defaut 4)', () => {
  const now = new Date(2026, 10, 13, 12, 0, 0); // 13 nov. 2026 midi, heure locale
  it('derniere activite aujourd\'hui ou hier : la serie courante', () => {
    expect(displayStreak({ current_streak: 5, last_activity_date: '2026-11-13' }, now)).toBe(5);
    expect(displayStreak({ current_streak: 5, last_activity_date: '2026-11-12' }, now)).toBe(5);
  });
  it('serie rompue (activite plus ancienne qu\'hier) : 0, jamais l\'ancien chiffre', () => {
    expect(displayStreak({ current_streak: 5, last_activity_date: '2026-11-10' }, now)).toBe(0);
  });
  it('profil absent / jamais d\'activite : 0', () => {
    expect(displayStreak(null, now)).toBe(0);
    expect(displayStreak({ current_streak: 0, last_activity_date: null }, now)).toBe(0);
    expect(displayStreak({ current_streak: 3, last_activity_date: null }, now)).toBe(0);
  });
  it('les trois ecrans lisent displayStreak (plus de calcul local de serie)', () => {
    const root = resolve(__dirname, '../../..');
    const src = (p: string) => readFileSync(resolve(root, p), 'utf8');
    expect(src('apps/mobile/src/hooks/useHomeData.ts')).toMatch(/displayStreak\(/);
    expect(src('apps/mobile/app/(app)/profile/index.tsx')).toMatch(/displayStreak\(/);
    expect(src('plugins/gamification/src/screens/GamificationPlugin.tsx')).toMatch(/displayStreak\(/);
    expect(src('apps/mobile/app/(app)/index.tsx')).toMatch(/useGamificationStreak\(\)/);
    expect(src('apps/mobile/src/hooks/useHomeData.ts')).not.toMatch(/useSessionStreak|consecutiveDayStreak/);
  });
});
