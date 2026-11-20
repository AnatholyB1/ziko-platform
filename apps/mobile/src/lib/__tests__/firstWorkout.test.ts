/**
 * v1.21 Phase 2 (FWKO-01..07, CLAR-01) : visibilite de la carte "Crée ton premier entraînement", etats de credit,
 * actions de tap. Logique pure : le cout vient TOUJOURS du serveur (valeur de test 3 != 4 : aucun chiffre en dur).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  firstWorkoutVisibility, hideEmptyMissionVariant, computeCreditView, pathAction, pathCostView, pathA11yLabel,
  sessionButtonBadge, FIRST_WORKOUT_PATHS, FIRST_WORKOUT_COPY,
} from '../firstWorkout';

const ok = { isLoading: false, isError: false };
const noProgram = { ...ok, hasActive: false };
const noSessions = { ...ok, finishedCount: 0 };

describe('firstWorkoutVisibility (FWKO-01, FWKO-06, R1/R3/R4)', () => {
  it('aucun programme ET zero seance terminee -> show', () => {
    expect(firstWorkoutVisibility({ program: noProgram, sessions: noSessions })).toBe('show');
  });
  it('un programme actif -> hide (meme sans seance)', () => {
    expect(firstWorkoutVisibility({ program: { ...ok, hasActive: true }, sessions: noSessions })).toBe('hide');
  });
  it('une seance terminee -> hide (meme sans programme)', () => {
    expect(firstWorkoutVisibility({ program: noProgram, sessions: { ...ok, finishedCount: 1 } })).toBe('hide');
  });
  it('programme actif connu : hide meme si les seances chargent encore (pas de squelette pour un compte existant)', () => {
    expect(firstWorkoutVisibility({ program: { ...ok, hasActive: true }, sessions: { isLoading: true, isError: false, finishedCount: undefined } })).toBe('hide');
  });
  it('seance terminee connue : hide meme si le programme charge encore', () => {
    expect(firstWorkoutVisibility({ program: { isLoading: true, isError: false, hasActive: false }, sessions: { ...ok, finishedCount: 3 } })).toBe('hide');
  });
  it('lecture en cours -> loading (squelette differe par la vue)', () => {
    expect(firstWorkoutVisibility({ program: { isLoading: true, isError: false, hasActive: false }, sessions: { isLoading: true, isError: false, finishedCount: undefined } })).toBe('loading');
    expect(firstWorkoutVisibility({ program: noProgram, sessions: { isLoading: true, isError: false, finishedCount: undefined } })).toBe('loading');
  });
  it('R4 : lecture du PROGRAMME en erreur -> hide (jamais une carte comme si le compte etait vide)', () => {
    expect(firstWorkoutVisibility({ program: { isLoading: false, isError: true, hasActive: false }, sessions: noSessions })).toBe('hide');
  });
  it('lecture des SEANCES en erreur, programme connu vide -> la carte reste offerte (Manuel disponible)', () => {
    expect(firstWorkoutVisibility({ program: noProgram, sessions: { isLoading: false, isError: true, finishedCount: undefined } })).toBe('show');
  });
  it('R3 : des que le programme devient actif ou une seance terminee, la carte disparait', () => {
    expect(firstWorkoutVisibility({ program: noProgram, sessions: noSessions })).toBe('show');
    expect(firstWorkoutVisibility({ program: { ...ok, hasActive: true }, sessions: noSessions })).toBe('hide');
    expect(firstWorkoutVisibility({ program: noProgram, sessions: { ...ok, finishedCount: 1 } })).toBe('hide');
  });
});

describe('hideEmptyMissionVariant (D-04 / R5)', () => {
  it('masque la variante vide tant que la carte occupe la place (affichee ou en chargement)', () => {
    expect(hideEmptyMissionVariant('show')).toBe(true);
    expect(hideEmptyMissionVariant('loading')).toBe(true);
    expect(hideEmptyMissionVariant('hide')).toBe(false);
  });
});

describe('computeCreditView (FWKO-02, FWKO-07)', () => {
  it('H01 : le cout affiche est celui du serveur (3, pas 4), jamais un chiffre en dur', () => {
    const v = computeCreditView({ cost: 3, balance: 6, free_left: 0 });
    expect(v.aiSimple.label).toBe('3 crédits');
    expect(v.atelier.label).toBe('3 crédits par message');
    expect(v.balanceLabel).toBe('6 crédits');
    expect(v.exhausted).toBe(false);
    const v4 = computeCreditView({ cost: 4, balance: 6, free_left: 0 });
    expect(v4.aiSimple.label).toBe('4 crédits');
    expect(sessionButtonBadge(v)).toBe('3 crédits');
  });
  it('H02 : solde < cout et aucun quota gratuit -> Credits epuises sur les deux chemins IA', () => {
    const v = computeCreditView({ cost: 4, balance: 0, free_left: 0 });
    expect(v.exhausted).toBe(true);
    expect(v.aiSimple.label).toBe('Crédits épuisés');
    expect(v.atelier.label).toBe('Crédits épuisés');
    expect(v.balanceLabel).toBe('0 crédit');
    expect(sessionButtonBadge(v)).toBeNull();
  });
  it('solde 3 < cout 4 sans quota : epuise aussi (solde non nul mais insuffisant)', () => {
    expect(computeCreditView({ cost: 4, balance: 3, free_left: 0 }).exhausted).toBe(true);
  });
  it('H08 : quota gratuit restant -> pas epuise meme a solde 0, libelles gratuits (singulier / pluriel)', () => {
    const one = computeCreditView({ cost: 4, balance: 0, free_left: 1 });
    expect(one.exhausted).toBe(false);
    expect(one.aiSimple.label).toBe('1 gratuite aujourd’hui');
    expect(one.atelier.label).toBe('1 message gratuit aujourd’hui');
    const two = computeCreditView({ cost: 4, balance: 0, free_left: 2 });
    expect(two.atelier.label).toBe('2 messages gratuits aujourd’hui');
  });
  it('H07 : cout inconnu -> repli "Consomme des crédits IA", jamais un chiffre invente', () => {
    for (const info of [null, undefined, {}, { cost: null, balance: 5 }, { cost: 0, balance: 5 }, { cost: Number.NaN }]) {
      const v = computeCreditView(info as any);
      expect(v.aiSimple.label).toBe('Consomme des crédits IA');
      expect(v.atelier.label).toBe('Consomme des crédits IA');
      expect(v.exhausted).toBe(false);
    }
  });
  it('H07 : solde inconnu -> pastille "—", jamais epuise a l aveugle (ne bloque pas l ouverture)', () => {
    const v = computeCreditView({ cost: 4, balance: null, free_left: null });
    expect(v.balanceLabel).toBe('—');
    expect(v.balanceA11y).toBe('Solde indisponible');
    expect(v.exhausted).toBe(false);
    expect(v.aiSimple.label).toBe('4 crédits');
  });
  it('pastille de solde : 1 crédit / 0 crédit au singulier', () => {
    expect(computeCreditView({ cost: 4, balance: 1 }).balanceLabel).toBe('1 crédit');
    expect(computeCreditView({ cost: 4, balance: 0, free_left: 1 }).balanceLabel).toBe('0 crédit');
  });
});

describe('chemins et taps (FWKO-03, 04, 05)', () => {
  const [manual, aiSimple, atelier] = FIRST_WORKOUT_PATHS;
  it('ordre fixe Manuel, IA simple, Atelier IA vers les routes du contrat', () => {
    expect(FIRST_WORKOUT_PATHS.map((p) => p.name)).toEqual(['Manuel', 'IA simple', 'Atelier IA']);
    expect(manual.route).toBe('/(app)/workout/program-builder');
    expect(aiSimple.route).toBe('/(app)/workout/ai-generate');
    expect(atelier.route).toBe('/(app)/workout/atelier');
    expect(FIRST_WORKOUT_PATHS.map((p) => p.deliverable)).toEqual(['Programme', 'Séance', 'Programme']);
  });
  it('credits disponibles : chaque rangee navigue vers sa route', () => {
    const v = computeCreditView({ cost: 4, balance: 6 });
    expect(pathAction(manual, v)).toEqual({ type: 'navigate', route: '/(app)/workout/program-builder' });
    expect(pathAction(aiSimple, v)).toEqual({ type: 'navigate', route: '/(app)/workout/ai-generate' });
    expect(pathAction(atelier, v)).toEqual({ type: 'navigate', route: '/(app)/workout/atelier' });
  });
  it('credits epuises : IA ouvre l ecran d epuisement (required = cout serveur), Manuel navigue toujours', () => {
    const v = computeCreditView({ cost: 4, balance: 0, free_left: 0 });
    expect(pathAction(aiSimple, v)).toEqual({ type: 'exhausted', balance: 0, required: 4 });
    expect(pathAction(atelier, v)).toEqual({ type: 'exhausted', balance: 0, required: 4 });
    expect(pathAction(manual, v)).toEqual({ type: 'navigate', route: '/(app)/workout/program-builder' });
    expect(pathCostView(manual, v)).toEqual({ label: 'Gratuit', tone: 'free' });
  });
  it('libelles accessibles du contrat (section 6)', () => {
    const v = computeCreditView({ cost: 4, balance: 6 });
    expect(pathA11yLabel(manual, v)).toBe('Manuel, programme. Tu construis ton programme en 4 étapes. Gratuit.');
    expect(pathA11yLabel(aiSimple, v)).toBe('IA simple, séance. L’IA prépare une séance unique en quelques secondes. 4 crédits.');
    expect(pathA11yLabel(atelier, v)).toBe('Atelier IA, programme. Tu discutes, l’IA construit un programme complet. 4 crédits par message.');
    const ex = computeCreditView({ cost: 4, balance: 0 });
    expect(pathA11yLabel(aiSimple, ex)).toContain('Crédits épuisés. Ouvre l’explication.');
  });
});

describe('aucun montant de credit en dur (P2-5)', () => {
  it('ni firstWorkout.ts ni les composants ne codent un nombre de credits', () => {
    const files = [
      '../firstWorkout.ts',
      '../../components/home/FirstWorkoutCard.tsx',
      '../../components/workout/CreateProgramSheet.tsx',
      '../../hooks/useFirstWorkout.ts',
    ];
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, f), 'utf8');
      expect(src, f).not.toMatch(/['"`]\s*\d+\s+crédits?/);
      expect(src, f).not.toMatch(/\bCREDIT_COSTS\b/);
    }
  });
  it('copie du contrat : coût inconnu et bandeau', () => {
    expect(FIRST_WORKOUT_COPY.unknownCost).toBe('Consomme des crédits IA');
    expect(FIRST_WORKOUT_COPY.exhaustedBanner).toBe('Tes crédits IA sont épuisés. Le parcours manuel reste gratuit.');
  });
});
