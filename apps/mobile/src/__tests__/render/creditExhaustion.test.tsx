import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';

vi.mock('moti', () => ({ MotiView: ({ children }: any) => React.createElement('div', null, children) }));

import CreditExhaustionSheet from '../../components/CreditExhaustionSheet';
import { useCreditStore, useI18nStore } from '@ziko/plugin-sdk';

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

const data = {
  balance: 0,
  required: 4,
  earned_today: ['workout'],
  // texte renvoye tel quel par l'API (anglais fixe) : ne doit PAS etre affiche en locale fr
  earn_hint: 'Log a workout to earn credits',
  reset_timestamp: new Date(Date.now() + 3 * 3600_000).toISOString(),
};

describe('CreditExhaustionSheet (run3 P23 : francisation)', () => {
  it('locale fr : titre, indice, activites et fermeture en francais accentue, aucun anglais', async () => {
    useI18nStore.setState({ locale: 'fr' });
    useCreditStore.setState({ exhaustionVisible: true, exhaustionData: data } as any);
    const c = await mount(<CreditExhaustionSheet />);
    const txt = c.textContent ?? '';
    expect(txt).toContain('Crédits IA épuisés');
    expect(txt).toContain('Enregistrer une séance');
    expect(txt).toContain('Valider tes habitudes du jour');
    expect(txt).toContain('Réinitialisation dans');
    expect(txt).toContain('Fermer');
    expect(txt).not.toMatch(/Log a|Complete a|Credits IA|epuises|Reset dans|earn credits/);
  });

  it('locale en : libelles anglais depuis les memes cles', async () => {
    useI18nStore.setState({ locale: 'en' });
    useCreditStore.setState({ exhaustionVisible: true, exhaustionData: data } as any);
    const c = await mount(<CreditExhaustionSheet />);
    expect(c.textContent).toContain('AI credits used up');
    expect(c.textContent).toContain('Log a workout');
    useI18nStore.setState({ locale: 'fr' });
  });
});
