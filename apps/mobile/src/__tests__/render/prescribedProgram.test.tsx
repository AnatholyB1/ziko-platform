import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';
import PrescribedProgramCard from '../../../../../plugins/coach/src/screens/PrescribedProgramCard';
import type { PrescribedView } from '../../../../../plugins/coach/src/screens/prescribedProgram';

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

const noop = () => {};
const view = (o: Partial<PrescribedView> = {}): PrescribedView => ({
  id: 'p1',
  name: 'Force 8 semaines',
  status: 'available',
  subtitle: '3 séances par semaine · semaine 2/8',
  replacesName: null,
  ...o,
});
const base = { loading: false, error: false, view: null, actionColor: '#CF4509', resuming: false, onRetry: noop, onOpen: noop, onResume: noop };
const btn = (c: HTMLElement, label: string) => Array.from(c.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLElement | undefined;

describe('PrescribedProgramCard (MCOA-04, M25-C)', () => {
  it('aucun programme : carte presente avec message, jamais vide, aucun bouton', async () => {
    const c = await mount(<PrescribedProgramCard {...base} />);
    expect(c.textContent).toContain('Programme de ton coach');
    expect(c.textContent).toContain("Ton coach n'a pas encore prescrit de programme.");
    expect(c.querySelectorAll('button')).toHaveLength(0);
  });

  it('chargement : squelette, pas de message vide ni de bouton', async () => {
    const c = await mount(<PrescribedProgramCard {...base} loading />);
    expect(c.textContent).toContain('Programme de ton coach');
    expect(c.textContent).not.toContain("n'a pas encore prescrit");
    expect(c.textContent).not.toContain('Impossible de charger');
    expect(c.querySelectorAll('button')).toHaveLength(0);
  });

  it('erreur : message + Reessayer (appelle onRetry), pas de faux programme', async () => {
    const onRetry = vi.fn();
    const c = await mount(<PrescribedProgramCard {...base} error onRetry={onRetry} />);
    expect(c.textContent).toContain('Impossible de charger le programme');
    await act(async () => { btn(c, 'Réessayer')!.click(); });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('actif : statut Actif (icone + libelle), Voir le programme, PAS de Reprendre', async () => {
    const onOpen = vi.fn();
    const c = await mount(<PrescribedProgramCard {...base} view={view({ status: 'active' })} onOpen={onOpen} />);
    expect(c.textContent).toContain('Actif');
    expect(c.textContent).toContain('Force 8 semaines');
    expect(c.textContent).toContain('3 séances par semaine · semaine 2/8');
    expect(c.querySelector('[data-icon="checkmark-circle"]')).not.toBeNull();
    expect(btn(c, 'Reprendre ce programme')).toBeUndefined();
    await act(async () => { btn(c, 'Voir le programme')!.click(); });
    expect(onOpen).toHaveBeenCalledWith('p1');
  });

  it('remplace par le programme de l athlete : libelle + Reprendre appelle onResume avec la vue', async () => {
    const onResume = vi.fn();
    const v = view({ status: 'replaced', replacesName: 'Mon split' });
    const c = await mount(<PrescribedProgramCard {...base} view={v} onResume={onResume} />);
    expect(c.textContent).toContain('Remplacé par ton programme');
    expect(c.querySelector('[data-icon="swap-horizontal"]')).not.toBeNull();
    await act(async () => { btn(c, 'Reprendre ce programme')!.click(); });
    expect(onResume).toHaveBeenCalledWith(v);
  });

  it('disponible : libelle Disponible + Reprendre ; sous-titre vide non rendu', async () => {
    const c = await mount(<PrescribedProgramCard {...base} view={view({ subtitle: '' })} />);
    expect(c.textContent).toContain('Disponible');
    expect(btn(c, 'Reprendre ce programme')).toBeDefined();
    expect(c.textContent).not.toMatch(/undefined|NaN/);
  });
});
