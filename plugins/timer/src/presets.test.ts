import { describe, it, expect } from 'vitest';
import {
  totalDuration, formatTotal, formatDurationShort, tabForType, typeForTab, rowToPreset, presetSummary,
  validatePreset, fieldsForTab, stepField, clampField, defaultsForTab, normalizeForTab, toDbPayload,
  buildPhases, phaseAt, duplicateName, type PresetFields,
} from './presets';

const C22: PresetFields = {
  name: 'Côtes 400 m', type: 'hiit', warmup_sec: 300, work_sec: 90, rest_sec: 60, sets: 6, rounds: 3, round_rest_sec: 120,
};

describe('totalDuration (D-03, TI-3)', () => {
  it('cas maquette C22 = 54 min, ecart 0 s', () => {
    expect(totalDuration(C22)).toBe(54 * 60);
    expect(formatTotal(totalDuration(C22))).toBe('54 min');
  });
  it('rounds = 1 : aucun repos entre rounds', () => {
    expect(totalDuration({ ...C22, rounds: 1, round_rest_sec: 120 })).toBe(300 + 6 * 150);
  });
  it('ancien preset (sets 1, warmup 0, round_rest 0) = rounds x (effort+repos)', () => {
    expect(totalDuration({ warmup_sec: 0, work_sec: 20, rest_sec: 10, sets: 1, rounds: 8, round_rest_sec: 0 })).toBe(240);
  });
});

describe('formats', () => {
  it('formatDurationShort', () => {
    expect(formatDurationShort(90)).toBe('1 min 30');
    expect(formatDurationShort(60)).toBe('1 min');
    expect(formatDurationShort(45)).toBe('45 s');
    expect(formatDurationShort(125)).toBe('2 min 05');
  });
  it('formatTotal', () => {
    expect(formatTotal(45)).toBe('45 s');
    expect(formatTotal(3900)).toBe('1 h 05');
    expect(formatTotal(3600)).toBe('1 h');
  });
});

describe('mapping type -> onglet (Q-P20b)', () => {
  it('custom=Séance, tabata=Tabata, le reste=Intervalle', () => {
    expect(tabForType('custom')).toBe('Séance');
    expect(tabForType('tabata')).toBe('Tabata');
    for (const t of ['hiit', 'emom', 'hyrox', 'functional', 'rest']) expect(tabForType(t)).toBe('Intervalle');
  });
  it('typeForTab produit un type qui revient sur le meme onglet', () => {
    for (const tab of ['Séance', 'Tabata', 'Intervalle'] as const) expect(tabForType(typeForTab(tab))).toBe(tab);
  });
});

describe('rowToPreset (lignes anciennes sans nouvelles colonnes)', () => {
  it('applique les defauts 0 / 1 / 0', () => {
    const p = rowToPreset({ id: 'a', name: 'Old', type: 'emom', work_sec: 60, rest_sec: 0, rounds: 10 });
    expect(p).toMatchObject({ warmup_sec: 0, sets: 1, round_rest_sec: 0, rounds: 10, exercises: [] });
  });
  it('null -> valeurs sures', () => {
    const p = rowToPreset({ id: 'a', name: 'X', type: 'custom', work_sec: null, rest_sec: null, rounds: null, exercises: null });
    expect(p.work_sec).toBe(0);
    expect(p.rounds).toBe(1);
  });
});

describe('presetSummary', () => {
  it('Séance : repos + séries', () => {
    expect(presetSummary({ ...defaultsForTab('Séance'), name: 'x' })).toBe('1 min 30 repos · 4 séries');
  });
  it('Tabata : effort/repos/rounds', () => {
    expect(presetSummary({ ...defaultsForTab('Tabata'), name: 'x' })).toBe('20 s effort · 10 s repos · 8 rounds');
  });
  it('Intervalle avec séries', () => {
    expect(presetSummary(C22)).toBe('1 min 30 effort · 1 min repos · 3 rounds · 6 séries');
  });
});

describe('validation des bornes (TIMR-02)', () => {
  it('C22 valide', () => expect(validatePreset(C22, 'Intervalle').ok).toBe(true));
  it('nom vide ou trop long refuse', () => {
    expect(validatePreset({ ...C22, name: '   ' }, 'Intervalle').errors.name).toBeDefined();
    expect(validatePreset({ ...C22, name: 'a'.repeat(61) }, 'Intervalle').errors.name).toBeDefined();
  });
  it('rounds 0, sets 0, effort < 5 refuses', () => {
    const r = validatePreset({ ...C22, rounds: 0, sets: 0, work_sec: 2 }, 'Intervalle');
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['rounds', 'sets', 'work_sec']);
  });
  it('Séance : seuls repos + séries sont controles, repos > 0', () => {
    expect(fieldsForTab('Séance')).toEqual(['rest_sec', 'sets']);
    expect(validatePreset({ ...defaultsForTab('Séance'), name: 'a', work_sec: 0, rounds: 1 }, 'Séance').ok).toBe(true);
    expect(validatePreset({ ...defaultsForTab('Séance'), name: 'a', rest_sec: 0 }, 'Séance').errors.rest_sec).toBeDefined();
  });
  it('entier non fini ou decimal refuse', () => {
    expect(validatePreset({ ...C22, sets: 1.5 }, 'Intervalle').errors.sets).toBeDefined();
    expect(validatePreset({ ...C22, rest_sec: NaN }, 'Intervalle').errors.rest_sec).toBeDefined();
  });
});

describe('steppers', () => {
  it('pas par champ et bornes', () => {
    expect(stepField('work_sec', 90, 1)).toBe(95);
    expect(stepField('warmup_sec', 0, -1)).toBe(0);
    expect(stepField('rounds', 99, 1)).toBe(99);
    expect(stepField('sets', 5, 1, 5)).toBe(10);
    expect(clampField('work_sec', 1)).toBe(5);
    expect(clampField('rounds', Number.NaN)).toBe(1);
  });
});

describe('normalizeForTab / payload', () => {
  it('Séance remet effort 0, 1 round, pas d\'echauffement', () => {
    const n = normalizeForTab({ ...C22, name: '  Push  ', type: 'custom' }, 'Séance');
    expect(n).toMatchObject({ name: 'Push', warmup_sec: 0, work_sec: 0, rounds: 1, round_rest_sec: 0, rest_sec: 60, sets: 6 });
  });
  it('payload ne contient jamais exercises ni id', () => {
    expect(Object.keys(toDbPayload(C22)).sort()).toEqual(
      ['name', 'type', 'warmup_sec', 'work_sec', 'rest_sec', 'sets', 'rounds', 'round_rest_sec'].sort(),
    );
  });
  it('duplicateName borne a 60', () => {
    expect(duplicateName('Push')).toBe('Push (copie)');
    expect(duplicateName('a'.repeat(60)).length).toBeLessThanOrEqual(60);
  });
});

describe('moteur de decompte (G-06)', () => {
  it('somme des phases = totalDuration', () => {
    const phases = buildPhases(C22);
    expect(phases.reduce((s, p) => s + p.seconds, 0)).toBe(totalDuration(C22));
    expect(phases[0]).toMatchObject({ kind: 'warmup', seconds: 300 });
    expect(phases.filter((p) => p.kind === 'round_rest')).toHaveLength(2);
    expect(phases.filter((p) => p.kind === 'work')).toHaveLength(18);
  });
  it('pas de repos entre rounds apres le dernier round', () => {
    const phases = buildPhases(C22);
    expect(phases[phases.length - 1].kind).toBe('rest');
  });
  it('phaseAt : positions et fin', () => {
    const phases = buildPhases(C22);
    expect(phaseAt(phases, 0)).toMatchObject({ done: false, secondsLeft: 300 });
    expect(phaseAt(phases, 299).secondsLeft).toBe(1);
    expect(phaseAt(phases, 300).phase?.kind).toBe('work');
    expect(phaseAt(phases, 390).phase?.kind).toBe('rest');
    expect(phaseAt(phases, totalDuration(C22) - 1).done).toBe(false);
    expect(phaseAt(phases, totalDuration(C22)).done).toBe(true);
  });
  it('Séance (effort 0) : uniquement des phases de repos', () => {
    const phases = buildPhases(defaultsForTab('Séance'));
    expect(phases.every((p) => p.kind === 'rest')).toBe(true);
    expect(phases).toHaveLength(4);
  });
});
