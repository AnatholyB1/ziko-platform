/**
 * Revue A #4/#6 : plus de date de jour calculee en UTC (`toISOString().split('T')[0]` / `.slice(0, 10)`)
 * dans les ecrans corriges. Garde STATIQUE (lecture de source) : la logique elle-meme est prouvee par
 * localDate.test.ts / streak.test.ts ; ce test empeche seulement le retour du motif sur ces fichiers.
 * Les fichiers non listes (cardio, coach, community, stats, wearables, calendar, profile...) restent a migrer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'plugins/habits/src/screens/HabitsPlugin.tsx',
  'plugins/habits/src/store.ts',
  'plugins/measurements/src/screens/MeasurementsLog.tsx',
  'plugins/measurements/src/screens/MeasurementsPlugin.tsx',
  'plugins/gamification/src/store.ts',
  'plugins/hydration/src/store.ts',
  'plugins/nutrition/src/store.ts',
  'plugins/nutrition/src/screens/NutritionPlugin.tsx',
  'apps/mobile/app/(app)/workout/session.tsx',
  'apps/mobile/src/hooks/useHomeData.ts',
];

describe('dates locales (jamais UTC) pour les jours calendaires', () => {
  for (const rel of FILES) {
    it(rel, () => {
      const src = readFileSync(resolve(__dirname, '../../../../../', rel), 'utf8');
      expect(src).not.toMatch(/toISOString\(\)\s*\.\s*(split\(\s*['"]T['"]\s*\)|slice\(\s*0\s*,\s*10\s*\)|substring\(\s*0\s*,\s*10\s*\))/);
    });
  }
});
