import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Scans de fichiers : le defaut de 5 s depasse sous charge parallele (turbo run test) ; verts en isolation.
vi.setConfig({ testTimeout: 20_000 });

// Revue A #11 #12 #27 : garde de langue/charte sur TOUS les fichiers visibles (remplace les 7 aiguilles de
// uatRun1Guards, qui laissaient passer "Target reached!"). Chaque .tsx visible (ecrans, composants, plugins)
// est analyse : texte JSX + chaines litterales + corps de notifications.
// Limite : garde STATIQUE. Elle ne voit ni un texte construit a l'execution, ni un libelle venu de la base.

const root = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const rel = (f: string) => relative(root, f).split('\\').join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

const VISIBLE_FILES: string[] = [
  ...walk(resolve(root, 'apps/mobile/app')),
  ...walk(resolve(root, 'apps/mobile/src/components')),
  ...readdirSync(resolve(root, 'plugins')).flatMap((p) => {
    try { return walk(resolve(root, 'plugins', p, 'src')); } catch { return []; }
  }),
  // corps de notifications (.ts)
  resolve(root, 'plugins/habits/src/notifications.ts'),
  resolve(root, 'plugins/hydration/src/reminders.ts'),
];

/** Retire commentaires et expressions `${...}` (du code, pas du texte visible). */
function stripCode(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/\$\{[^}]*\}/g, ' ');
}

/** Texte visible probable : texte JSX d'une ligne + litteraux avec espace (hors logs, erreurs, tags [X]). */
function visibleStrings(src: string): string[] {
  const out: string[] = [];
  for (const line of stripCode(src).split('\n')) {
    if (/console\.|throw new Error|new Error\(|\.select\(|\.from\(|import /.test(line)) continue;
    for (const m of line.matchAll(/>([^<>{}\n]{3,})</g)) out.push(m[1]);
    for (const m of line.matchAll(/(?<![\w$])(?:'([^'\n]{3,})'|"([^"\n]{3,})"|`([^`\n]{3,})`)/g)) {
      const str = m[1] ?? m[2] ?? m[3];
      if (str && /\s/.test(str.trim()) && !str.startsWith('[')) out.push(str);
    }
  }
  return out;
}

const ENGLISH = new RegExp(
  "(?<![\\p{L}])(?:the|your|please|here|reached|don't|didn't|can't|welcome|tomorrow|yesterday|try again|loading|rest time|start timer|reps done|min reached|you (?:can|have|are|did|need|will))(?![\\p{L}'])",
  'iu',
);
// Prompt envoye au modele (jamais affiche).
const ENGLISH_ALLOW = [/Please wrap up now and give me my mission/];

const EMOJI = /[\p{Extended_Pictographic}\u2713\u2714\u2716\uFE0F]/u;
// Dette connue HORS perimetre revue A (autres phases). Ne doit pas grandir ; retirer une entree des qu'un fichier est nettoye.
const EMOJI_DEBT = [
  'apps/mobile/app/(app)/ai/chat.tsx',
  'apps/mobile/app/(app)/ai/index.tsx',
  'apps/mobile/app/(auth)/onboarding/step-6.tsx',
  'apps/mobile/app/(auth)/welcome.tsx',
  'apps/mobile/src/components/ExercisePicker.tsx',
  'apps/mobile/src/components/forms/QuestionYesNo.tsx',
  'plugins/ai-programs/src/screens/GenerateProgram.tsx',
  'plugins/cardio/src/screens/CardioTracker.tsx',
  'plugins/community/src/screens/ChallengeDetailScreen.tsx',
  'plugins/community/src/screens/ChallengesScreen.tsx',
  'plugins/community/src/screens/ConversationScreen.tsx',
  'plugins/community/src/screens/CreateChallengeScreen.tsx',
  'plugins/community/src/screens/GroupsScreen.tsx',
  'plugins/community/src/screens/InviteScreen.tsx',
  'plugins/habits/src/screens/HabitLogScreen.tsx', // pickers d'emoji d'habitude : donnee utilisateur (revue A #31)
  'plugins/persona/src/screens/CoachIAPlugin.tsx',
];

describe('texte visible : francais, sans emoji (scan de tous les fichiers)', () => {
  it('le scan couvre bien les ecrans (garde contre un glob vide)', () => {
    expect(VISIBLE_FILES.length).toBeGreaterThan(100);
  });

  it('detecte bien un texte anglais (le scan n\'est pas aveugle)', () => {
    expect(visibleStrings('<Text>Target reached!</Text>').some((s) => ENGLISH.test(s))).toBe(true); // le defaut #11
    expect(visibleStrings("<Text>Don't forget your habit</Text>").some((s) => ENGLISH.test(s))).toBe(true);
    expect(visibleStrings("showAlert('Oops', 'Please try again later')").some((s) => ENGLISH.test(s))).toBe(true);
    expect(visibleStrings('<Text>Thé vert, fais ta pause</Text>').some((s) => ENGLISH.test(s))).toBe(false);
    expect(EMOJI.test('Prêt \uD83D\uDCAA')).toBe(true);
    expect(EMOJI.test('\u2713 fait')).toBe(true);
    expect(EMOJI.test('3 \u00D7 10 kg')).toBe(false);
  });

  it('aucun mot anglais courant dans le texte visible', () => {
    const offenders: string[] = [];
    for (const f of VISIBLE_FILES) {
      let src: string;
      try { src = readFileSync(f, 'utf8'); } catch { continue; }
      for (const str of visibleStrings(src)) {
        if (ENGLISH.test(str) && !ENGLISH_ALLOW.some((re) => re.test(str))) {
          offenders.push(`${rel(f)} : ${str.trim().slice(0, 70)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('anciens defauts de session.tsx absents', () => {
    const session = read('apps/mobile/app/(app)/workout/session.tsx');
    for (const needle of ['Program Overview', 'Reps done', '>TARGET<', 'exercises</Text>', 'Rest Time', "'Start Timer'", '`Next:', 'Target reached', 'Min reached']) {
      expect(session).not.toContain(needle);
    }
  });

  it('pas d\'emoji dans le texte visible (hors dette connue)', () => {
    const offenders: string[] = [];
    for (const f of VISIBLE_FILES) {
      if (EMOJI_DEBT.includes(rel(f))) continue;
      let src: string;
      try { src = readFileSync(f, 'utf8'); } catch { continue; }
      stripCode(src).split('\n').forEach((line, i) => {
        if (EMOJI.test(line)) offenders.push(`${rel(f)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('ton non culpabilisant (regle non punitive v1.18) : plus de "Tu rates"', () => {
    expect(read('plugins/habits/src/screens/HabitsPlugin.tsx')).not.toMatch(/Tu rates/);
  });
});
