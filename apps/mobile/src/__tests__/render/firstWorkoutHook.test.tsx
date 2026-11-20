import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── mocks : aucune requete reelle (Supabase / API) ────────────────────────────────────────────────
const h = vi.hoisted(() => ({
  program: { data: null as any, isLoading: false, isError: false },
  sessionsResult: { count: 0 as number | null, error: null as any },
  getInfo: vi.fn(),
  sessionCalls: 0,
}));

vi.mock('../../lib/supabase', () => {
  const chain: any = {
    select: () => chain, eq: () => chain, not: () => chain,
    or: () => { h.sessionCalls++; return Promise.resolve(h.sessionsResult); },
  };
  return { supabase: { from: () => chain, auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } } };
});
vi.mock('../../stores/authStore', () => ({ useAuthStore: (sel: any) => sel({ user: { id: 'u1' } }) }));
vi.mock('../../hooks/useHomeData', () => ({ useActiveAIProgram: () => h.program }));
vi.mock('../../lib/atelierService', () => ({ createAtelierClient: () => ({ getInfo: h.getInfo }) }));

import { useFirstWorkoutCard, type FirstWorkoutState } from '../../hooks/useFirstWorkout';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let last: FirstWorkoutState;
function Probe() {
  last = useFirstWorkoutCard();
  return null;
}

async function run() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<QueryClientProvider client={qc}><Probe /></QueryClientProvider>);
  });
  // laisse les requetes se resoudre
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return qc;
}

beforeEach(() => {
  h.program = { data: null, isLoading: false, isError: false };
  h.sessionsResult = { count: 0, error: null };
  h.getInfo.mockReset();
  h.sessionCalls = 0;
});

describe('useFirstWorkoutCard (FWKO-01, FWKO-02, FWKO-07, R4)', () => {
  it('compte neuf : show + cout et solde du serveur', async () => {
    h.getInfo.mockResolvedValue({ cost: 3, balance: 5, free_left: 0 });
    await run();
    expect(last.visibility).toBe('show');
    expect(last.credit.aiSimple.label).toBe('3 crédits');
    expect(last.credit.balanceLabel).toBe('5 crédits');
    expect(last.creditFailed).toBe(false);
  });

  it('une seance terminee -> hide, et aucun appel cout/solde (un compte existant ne coute rien de plus)', async () => {
    h.sessionsResult = { count: 2, error: null };
    h.getInfo.mockResolvedValue({ cost: 4, balance: 5 });
    await run();
    expect(last.visibility).toBe('hide');
    expect(h.getInfo).not.toHaveBeenCalled();
  });

  it('programme actif -> hide et aucun appel cout/solde', async () => {
    h.program = { data: { id: 'p1' }, isLoading: false, isError: false };
    h.getInfo.mockResolvedValue({ cost: 4, balance: 5 });
    await run();
    expect(last.visibility).toBe('hide');
    expect(h.getInfo).not.toHaveBeenCalled();
  });

  it('echec de lecture du solde / cout : la carte reste affichee avec le repli et Manuel disponible', async () => {
    h.getInfo.mockRejectedValue(new Error('network'));
    await run();
    await act(async () => { await new Promise((r) => setTimeout(r, 1300)); }); // 1 nouvel essai (delai par defaut 1 s)
    expect(last.visibility).toBe('show');
    expect(last.creditFailed).toBe(true);
    expect(last.credit.aiSimple.label).toBe('Consomme des crédits IA');
    expect(last.credit.balanceLabel).toBe('—');
    expect(last.credit.exhausted).toBe(false);
  });

  it('echec de la requete des seances : la carte reste affichee (programme connu vide), Manuel offert', async () => {
    h.sessionsResult = { count: null, error: { message: 'boom' } };
    h.getInfo.mockResolvedValue({ cost: 4, balance: 5 });
    await run();
    expect(last.visibility).toBe('show');
  });

  it('R4 : erreur de lecture du programme -> hide', async () => {
    h.program = { data: null, isLoading: false, isError: true };
    h.getInfo.mockResolvedValue({ cost: 4, balance: 5 });
    await run();
    expect(last.visibility).toBe('hide');
  });

  it('solde 0 et aucun quota : epuise', async () => {
    h.getInfo.mockResolvedValue({ cost: 4, balance: 0, free_left: 0 });
    await run();
    expect(last.credit.exhausted).toBe(true);
  });
});
