/**
 * v1.21 Phase 2 (CLAR-02) : la fin d'onboarding n'annonce que ce qui existe. Garde de source : aucune des chaines
 * retirees ne reapparait dans step-7.tsx, handleFinish conserve son comportement (profil, preload, ziko-chat).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ONBOARDING_LOAD_PHASES, ONBOARDING_FORBIDDEN_TEXT, ONBOARDING_READY_COPY, readySubtitle, goalName,
} from '../onboardingEnd';

const step7 = readFileSync(resolve(__dirname, '../../../app/(auth)/onboarding/step-7.tsx'), 'utf8');

describe('readySubtitle (variante B)', () => {
  it('objectif et rythme saisis', () => {
    expect(readySubtitle('muscle_gain', 4)).toBe('Objectif : prendre du muscle, 4 séances par semaine. Voici ce qui vient.');
    expect(readySubtitle('strength', 1)).toBe('Objectif : gagner en force, 1 séance par semaine. Voici ce qui vient.');
  });
  it('rythme inconnu : la partie rythme saute, aucune valeur inventee', () => {
    expect(readySubtitle('fat_loss', null)).toBe('Objectif : perdre du gras. Voici ce qui vient.');
    expect(readySubtitle(null, undefined)).toBe('Objectif : tes objectifs. Voici ce qui vient.');
  });
});

describe('contenu de la fin d onboarding (CLAR-02, D-06)', () => {
  it('3 etapes "La suite" menant a la carte premier entrainement', () => {
    expect(ONBOARDING_READY_COPY.title).toBe('C’est noté');
    expect(ONBOARDING_READY_COPY.steps.map((s) => s.title)).toEqual([
      'Une courte discussion avec Ziko', 'Ta première mission, sur l’accueil', 'Ton premier entraînement',
    ]);
    expect(ONBOARDING_READY_COPY.cta).toBe('Continuer');
  });
  it('chargement : 4 etapes honnetes, plus de "Construction de ton programme"', () => {
    expect(ONBOARDING_LOAD_PHASES).toHaveLength(4);
    expect(ONBOARDING_LOAD_PHASES.join('|')).not.toContain('Construction de ton programme');
    expect(goalName('muscle_gain')).toBe('muscle');
  });
  it('step-7.tsx ne contient aucune chaine interdite (carte plan inventee, "demain matin", fleche texte)', () => {
    for (const forbidden of ONBOARDING_FORBIDDEN_TEXT) {
      expect(step7.includes(forbidden), `chaine interdite : ${forbidden}`).toBe(false);
    }
  });
  it('les chaines affichees (copie) ne contiennent aucune chaine interdite', () => {
    const shown = [
      ONBOARDING_READY_COPY.title, ONBOARDING_READY_COPY.stepsLabel, ONBOARDING_READY_COPY.cta,
      ...ONBOARDING_READY_COPY.steps.flatMap((s) => [s.title, s.sub]), ...ONBOARDING_LOAD_PHASES,
      readySubtitle('muscle_gain', 4),
    ].join('\n');
    for (const forbidden of ONBOARDING_FORBIDDEN_TEXT) expect(shown.includes(forbidden), forbidden).toBe(false);
  });
  it('fond sombre conserve (decision D-06) et handleFinish inchange : profil, onboarding_done, ziko-chat', () => {
    expect(step7).toContain("backgroundColor: '#1C1A17'");
    expect(step7).toContain('onboarding_done: true');
    expect(step7).toContain("router.replace('/(auth)/onboarding/ziko-chat')");
    expect(step7).toContain('preloadMandatory');
    expect(step7).toContain('await refreshProfile()');
  });
});
