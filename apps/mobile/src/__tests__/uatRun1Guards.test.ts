import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Garde-fous de non-regression pour les defauts du run 1 d'UAT emulateur.
// Ce sont des tests au niveau SOURCE : ils prouvent que le code ne retombe pas dans le defaut,
// pas le comportement natif (clavier reel / rendu) qui reste a re-verifier sur emulateur.

const root = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('feuilles avec champ texte : KeyboardAvoidingView (UAT run1 #1)', () => {
  const files = [
    'apps/mobile/app/(app)/index.tsx',
    'plugins/measurements/src/screens/MeasurementsPlugin.tsx',
    'plugins/habits/src/screens/HabitsPlugin.tsx',
    'plugins/hydration/src/screens/HydrationSheets.tsx',
    'plugins/measurements/src/screens/GoalsTab.tsx',
  ];
  it.each(files)('%s enveloppe ses Modal avec KeyboardAvoidingView', (f) => {
    const src = read(f);
    expect(src).toMatch(/<KeyboardAvoidingView/);
    // Chaque <Modal ... transparent> a une fermeture KAV avant </Modal>
    const modals = src.split(/<Modal\b/).slice(1);
    for (const m of modals) {
      const body = m.split(/<\/Modal>/)[0];
      if (/<TextInput/.test(body)) expect(body).toMatch(/<KeyboardAvoidingView/);
    }
  });
});

describe('noms d\'exercices accueil (UAT run1 #3, XCUT-06)', () => {
  it('la carte Mission du jour passe par exerciseDisplayName', () => {
    const src = read('apps/mobile/app/(app)/index.tsx');
    expect(src).toMatch(/exerciseDisplayName\(e\.name \?\? e\.exercise_name/);
    expect(src).not.toMatch(/\{e\.name \?\? e\.exercise_name \?\? 'Exercice'\}/);
  });
});

describe('francais residuel (UAT run1 #5)', () => {
  const session = read('apps/mobile/app/(app)/workout/session.tsx');
  it.each(['Program Overview', 'Reps done', '>TARGET<', 'exercises</Text>', 'Rest Time', "'Start Timer'", '`Next:'])(
    'session.tsx ne contient plus %s',
    (needle) => {
      expect(session).not.toContain(needle);
    },
  );
  it('les noms de plugin affiches sont en francais', () => {
    expect(read('plugins/habits/src/manifest.ts')).not.toMatch(/title: 'Habits'/);
    expect(read('plugins/habits/src/manifest.ts')).toMatch(/title: 'Habitudes'/);
  });
  it('etat vide Habitudes sans emoji', () => {
    expect(read('plugins/habits/src/screens/HabitsPlugin.tsx')).not.toContain('\u{1F331}');
  });
});

describe('grille Quick Log (UAT run1 #6)', () => {
  it('chaque tuile reserve sa hauteur (pas de decalage apres un log)', () => {
    const src = read('apps/mobile/app/(app)/index.tsx');
    expect((src.match(/minHeight: 88/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
