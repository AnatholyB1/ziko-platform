import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';

vi.mock('moti', () => ({ MotiView: ({ children }: any) => React.createElement('div', null, children) }));

import FirstWorkoutCard from '../../components/home/FirstWorkoutCard';
import CreateProgramSheet from '../../components/workout/CreateProgramSheet';
import { computeCreditView } from '../../lib/firstWorkout';
import { routerCalls } from './stubs/expo-router';
import { useCreditStore } from '@ziko/plugin-sdk';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(el: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(el);
  });
  return container;
}
const byId = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="${id}"]`) as HTMLElement;
async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

beforeEach(() => {
  routerCalls.length = 0;
  useCreditStore.setState({ exhaustionVisible: false, exhaustionData: null } as any);
});

describe('FirstWorkoutCard (FWKO-01..07)', () => {
  it('H01 : titre, 3 rangees dans l ordre, livrables, phrases, couts serveur (3, pas 4), badge Conseille', async () => {
    const c = await mount(<FirstWorkoutCard visibility="show" credit={computeCreditView({ cost: 3, balance: 6 })} />);
    const txt = c.textContent ?? '';
    expect(txt).toContain('Premier entraînement');
    expect(txt).toContain('Crée ton premier entraînement');
    expect(txt).toContain('Trois façons de commencer.');
    const manual = txt.indexOf('Manuel');
    const ia = txt.indexOf('IA simple');
    const atelier = txt.indexOf('Atelier IA');
    expect(manual).toBeGreaterThan(-1);
    expect(ia).toBeGreaterThan(manual);
    expect(atelier).toBeGreaterThan(ia);
    expect(txt).toContain('Tu construis ton programme en 4 étapes.');
    expect(txt).toContain('Gratuit');
    expect(txt).toContain('3 crédits');
    expect(txt).toContain('3 crédits par message');
    expect(txt).not.toContain('4 crédits');
    expect(txt).toContain('6 crédits');
    expect(txt).toContain('Conseillé');
    expect(txt).toContain('Séance');
    expect(txt).toContain('Programme');
    expect(txt).not.toContain('Crédits épuisés');
    expect(txt).not.toMatch(/Plus tard|Masquer|Ignorer/);
  });

  it('UAT P3 : le style de chaque rangee est un objet (pas une fonction, ignoree sur Android) avec rangee horizontale et padding', async () => {
    const c = await mount(<FirstWorkoutCard visibility="show" credit={computeCreditView({ cost: 3, balance: 6 })} />);
    for (const id of ['manual', 'ai-simple', 'atelier']) {
      const row = byId(c, `first-workout-${id}`);
      expect(row.getAttribute('data-style-type')).toBe('object');
    }
  });

  it('FWKO-03/04/05 : les 3 taps ouvrent program-builder, ai-generate, atelier', async () => {
    const c = await mount(<FirstWorkoutCard visibility="show" credit={computeCreditView({ cost: 4, balance: 6 })} />);
    await click(byId(c, 'first-workout-manual'));
    await click(byId(c, 'first-workout-ai-simple'));
    await click(byId(c, 'first-workout-atelier'));
    expect(routerCalls.map((r) => r.args[0])).toEqual([
      '/(app)/workout/program-builder', '/(app)/workout/ai-generate', '/(app)/workout/atelier',
    ]);
  });

  it('H02 / FWKO-07 : solde 0 -> "Crédits épuisés" AVANT le tap sur les 2 rangees IA, pas sur Manuel ; tap IA ouvre l ecran d epuisement', async () => {
    const c = await mount(<FirstWorkoutCard visibility="show" credit={computeCreditView({ cost: 4, balance: 0, free_left: 0 })} />);
    expect(byId(c, 'first-workout-ai-simple').textContent).toContain('Crédits épuisés');
    expect(byId(c, 'first-workout-atelier').textContent).toContain('Crédits épuisés');
    expect(byId(c, 'first-workout-manual').textContent).not.toContain('Crédits épuisés');
    expect(byId(c, 'first-workout-manual').textContent).toContain('Gratuit');
    expect(c.textContent).toContain('Tes crédits IA sont épuisés. Le parcours manuel reste gratuit.');
    expect(c.textContent).toContain('0 crédit');
    expect(c.textContent).not.toContain('Conseillé');

    await click(byId(c, 'first-workout-ai-simple'));
    expect(routerCalls).toHaveLength(0);
    expect(useCreditStore.getState().exhaustionVisible).toBe(true);
    expect(useCreditStore.getState().exhaustionData?.required).toBe(4);
    await click(byId(c, 'first-workout-manual'));
    expect(routerCalls.map((r) => r.args[0])).toEqual(['/(app)/workout/program-builder']);
  });

  it('H07 (echec de lecture du solde / du cout) : repli "Consomme des crédits IA", pastille "—", Manuel et IA restent ouvrables', async () => {
    const c = await mount(<FirstWorkoutCard visibility="show" credit={computeCreditView(null)} />);
    const txt = c.textContent ?? '';
    expect(txt).toContain('Consomme des crédits IA');
    expect(txt).toContain('—');
    expect(txt).not.toContain('Crédits épuisés');
    await click(byId(c, 'first-workout-manual'));
    await click(byId(c, 'first-workout-ai-simple'));
    expect(routerCalls.map((r) => r.args[0])).toEqual(['/(app)/workout/program-builder', '/(app)/workout/ai-generate']);
  });

  it('H08 : quota gratuit restant', async () => {
    const c = await mount(<FirstWorkoutCard visibility="show" credit={computeCreditView({ cost: 4, balance: 0, free_left: 1 })} />);
    expect(c.textContent).toContain('1 gratuite aujourd’hui');
    expect(c.textContent).toContain('1 message gratuit aujourd’hui');
    expect(c.textContent).not.toContain('Crédits épuisés');
  });

  it('hide : rien n est rendu (R4, R3)', async () => {
    const c = await mount(<FirstWorkoutCard visibility="hide" credit={computeCreditView(null)} />);
    expect(c.textContent).toBe('');
  });

  it('H03 : chargement -> rien avant 400 ms (pas de clignotement), squelette ensuite', async () => {
    vi.useFakeTimers();
    try {
      const c = await mount(<FirstWorkoutCard visibility="loading" credit={computeCreditView(null)} />);
      expect(byId(c, 'first-workout-skeleton')).toBeNull();
      expect(c.textContent).toBe('');
      await act(async () => {
        vi.advanceTimersByTime(450);
      });
      expect(byId(c, 'first-workout-skeleton')).not.toBeNull();
      expect(c.textContent).not.toContain('Crée ton premier entraînement');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CreateProgramSheet (CLAR-01, D-05)', () => {
  it('T02 : deux rangees (Assistant en 4 etapes, Atelier IA), Annuler ; Assistant -> program-builder, ferme la feuille', async () => {
    const onClose = vi.fn();
    const c = await mount(<CreateProgramSheet visible onClose={onClose} credit={computeCreditView({ cost: 4, balance: 6 })} />);
    const txt = c.textContent ?? '';
    expect(txt).toContain('Créer un programme');
    expect(txt).toContain('Plusieurs séances organisées sur des semaines.');
    expect(txt).toContain('Assistant en 4 étapes');
    expect(txt).toContain('Atelier IA');
    expect(txt).toContain('4 crédits par message');
    expect(txt).toContain('Annuler');
    expect(byId(c, 'create-sheet-session')).toBeNull();
    await click(byId(c, 'create-sheet-manual'));
    expect(routerCalls.map((r) => r.args[0])).toEqual(['/(app)/workout/program-builder']);
    expect(onClose).toHaveBeenCalled();
  });

  it('T02 : Atelier IA -> atelier', async () => {
    const c = await mount(<CreateProgramSheet visible onClose={() => {}} credit={computeCreditView({ cost: 4, balance: 6 })} />);
    await click(byId(c, 'create-sheet-atelier'));
    expect(routerCalls.map((r) => r.args[0])).toEqual(['/(app)/workout/atelier']);
  });

  it('T04 : credits epuises -> Atelier porte "Crédits épuisés" et ouvre l ecran d epuisement ; l Assistant reste ouvert', async () => {
    const c = await mount(<CreateProgramSheet visible onClose={() => {}} credit={computeCreditView({ cost: 4, balance: 0 })} />);
    expect(byId(c, 'create-sheet-atelier').textContent).toContain('Crédits épuisés');
    expect(byId(c, 'create-sheet-manual').textContent).not.toContain('Crédits épuisés');
    await click(byId(c, 'create-sheet-atelier'));
    expect(routerCalls).toHaveLength(0);
    expect(useCreditStore.getState().exhaustionVisible).toBe(true);
    await click(byId(c, 'create-sheet-manual'));
    expect(routerCalls.map((r) => r.args[0])).toEqual(['/(app)/workout/program-builder']);
  });

  it('bouton "+" (withSession) : groupes Programme / Séance seule, la seance IA mene a ai-generate', async () => {
    const c = await mount(<CreateProgramSheet visible onClose={() => {}} withSession credit={computeCreditView({ cost: 4, balance: 6 })} />);
    const txt = c.textContent ?? '';
    expect(txt).toContain('Créer un entraînement');
    expect(txt).toContain('Séance seule');
    expect(txt).toContain('Générer une séance IA');
    await click(byId(c, 'create-sheet-session'));
    expect(routerCalls.map((r) => r.args[0])).toEqual(['/(app)/workout/ai-generate']);
  });

  it('feuille fermee : rien n est rendu', async () => {
    const c = await mount(<CreateProgramSheet visible={false} onClose={() => {}} credit={computeCreditView(null)} />);
    expect(c.textContent).toBe('');
  });
});
