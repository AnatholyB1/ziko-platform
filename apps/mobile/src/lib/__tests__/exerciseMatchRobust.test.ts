import { describe, it, expect } from 'vitest';
import { resolveExercise, matchExercise, searchPatternsFor, suggestExercises, checkWizardExerciseEntry } from '../exerciseMatch';

// Lignes reelles du catalogue (scripts/exercise_names.txt) pour la seance IA du faux Anthropic (UAT phase 3 rerun).
const NAMES = [
  'dumbbell goblet squat', 'kettlebell goblet squat', 'dumbbell bench press', 'barbell bench press',
  'dumbbell incline bench press', 'dumbbell neutral grip bench press', 'cable bench press', 'lever unilateral row',
  'lever one arm bent over row', 'dumbbell bent over row', 'barbell bent over row', 'cable seated row',
  'weighted front plank', 'front plank with twist', 'power point plank', 'bodyweight incline side plank',
  'barbell full squat', 'barbell deadlift', 'walking lunge', 'dumbbell lunge', 'inverted row',
];
const CAT = NAMES.map((name, i) => ({ id: 'c' + i, name, name_fr: null as string | null }));
const WITH_FR = CAT.map((r) =>
  r.name === 'dumbbell goblet squat'
    ? { ...r, name_fr: 'goblet squat haltère' }
    : r.name === 'lever unilateral row'
      ? { ...r, name_fr: 'rowing unilatéral machine' }
      : r,
);
const nameOf = (q: string, rows: any[] = CAT) => resolveExercise(q, rows, {})?.name ?? null;

describe('seance IA generee : les 4 exercices du faux Anthropic (UAT phase 3 rerun)', () => {
  it('"Squat goblet" -> goblet squat haltere (preference de materiel a egalite avec kettlebell)', () => {
    expect(nameOf('Squat goblet')).toBe('dumbbell goblet squat');
    expect(nameOf('Squat goblet', WITH_FR)).toBe('dumbbell goblet squat');
  });
  it('"Développé couché haltères" -> dumbbell bench press (alias FR, accents, pluriel)', () => {
    expect(nameOf('Développé couché haltères')).toBe('dumbbell bench press');
    expect(nameOf('developpe couche halteres')).toBe('dumbbell bench press');
  });
  it('"Rowing unilatéral" -> lever unilateral row', () => {
    expect(nameOf('Rowing unilatéral')).toBe('lever unilateral row');
  });
  it('"Gainage planche" -> front plank (approx proche), jamais une variante lointaine', () => {
    expect(nameOf('Gainage planche')).toBe('weighted front plank');
  });
});

describe('matching robuste : accents, ordre des mots, FR <-> EN', () => {
  it('ordre des mots et casse ignores', () => {
    expect(nameOf('GOBLET SQUAT DUMBBELL')).toBe('dumbbell goblet squat');
    expect(nameOf('press bench dumbbell')).toBe('dumbbell bench press');
    expect(matchExercise('bench press barbell', CAT, {})?.kind).toBe('exact');
  });
  it('alias FR -> EN : développé couché = bench press, soulevé de terre = deadlift, fentes = lunge', () => {
    expect(nameOf('Développé couché barre')).toBe('barbell bench press');
    expect(nameOf('Soulevé de terre barre')).toBe('barbell deadlift');
    expect(nameOf('Fentes haltères')).toBe('dumbbell lunge');
  });
  it('libelle francais du catalogue (name_fr) : ordre et accents', () => {
    expect(nameOf('haltère goblet squat', WITH_FR)).toBe('dumbbell goblet squat');
    expect(nameOf('Rowing machine unilatéral', WITH_FR)).toBe('lever unilateral row');
  });
  it('cas NEGATIFS : aucun faux positif', () => {
    expect(nameOf('Zercher carry')).toBeNull();
    expect(nameOf('Curl marteau')).toBeNull();
    expect(nameOf('xyz')).toBeNull();
    expect(nameOf('Tractions lestées')).toBeNull();
    expect(nameOf('Rowing barre penché')).toBeNull(); // "penché" sans equivalent : pas de devinette
    expect(nameOf('Fentes marchées')).toBeNull();
  });
  it('un mot commun ne suffit pas', () => {
    expect(nameOf('squat bulgare')).toBeNull();
    expect(nameOf('row bulgare')).toBeNull();
    // une variante lointaine (plank lateral, twist) n'est jamais choisie pour "plank" seul
    expect(nameOf('plank')).toBeNull();
  });
  it('la requete qui precise le materiel gagne sur la preference', () => {
    expect(nameOf('Squat goblet kettlebell')).toBe('kettlebell goblet squat');
  });
  it('repli par couverture partielle (>= 75 %) pour une requete de 4 tokens et plus', () => {
    expect(nameOf('dumbbell neutral grip bench press cambre')).toBe('dumbbell neutral grip bench press');
  });
  it('plus de 25 % de tokens inconnus -> refus', () => {
    expect(nameOf('dumbbell neutral bench press cambre special')).toBeNull();
  });
});

describe('suggestExercises (program-builder)', () => {
  it('prefixe du dernier mot, materiel de base d abord', () => {
    const s = suggestExercises('squ', CAT, {}).map((r) => r.name);
    expect(s[0]).toBe('barbell full squat');
    expect(s).toContain('dumbbell goblet squat');
  });
  it('saisie francaise partielle -> equivalent anglais', () => {
    expect(suggestExercises('dévelop couch', CAT, {}).map((r) => r.name)).toContain('barbell bench press');
  });
  it('moins de 2 caracteres ou rien de proche -> aucune suggestion', () => {
    expect(suggestExercises('s', CAT, {})).toEqual([]);
    expect(suggestExercises('qqqq', CAT, {})).toEqual([]);
  });
});

describe('checkWizardExerciseEntry (texte libre bloque)', () => {
  it('vide', () => expect(checkWizardExerciseEntry('  ', CAT, {}).status).toBe('empty'));
  it('resolu : libelle du catalogue', () => {
    const r = checkWizardExerciseEntry('squat goblet', WITH_FR, {});
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.label).toBe('goblet squat haltère');
  });
  it('texte libre hors catalogue : message d erreur francais', () => {
    const r = checkWizardExerciseEntry('Zercher carry', CAT, {});
    expect(r.status).toBe('unresolved');
    if (r.status === 'unresolved') expect(r.message).toContain('Zercher carry');
  });
});

describe('searchPatternsFor : pre-filtre accents et alias', () => {
  it('"Développé couché haltères" cible l anglais (press/bench) ET le mot accentue de name_fr', () => {
    const p = searchPatternsFor('Développé couché haltères', {});
    expect(p).toContain('%press%');
    expect(p).toContain('%développé%');
  });
  it('le materiel seul ne pre-filtre pas quand un mot specifique existe', () => {
    expect(searchPatternsFor('Squat goblet', {})).not.toContain('%dumbbell%');
    expect(searchPatternsFor('Squat goblet', {})).toContain('%goblet%');
  });
});
