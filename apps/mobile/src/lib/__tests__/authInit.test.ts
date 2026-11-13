/**
 * Revue A #16 : demarrage de session sans splash infini ni await dans le callback onAuthStateChange.
 */
import { describe, it, expect, vi } from 'vitest';
import { loadInitialSession, deferProfileRefresh } from '../authInit';

describe('loadInitialSession', () => {
  it('session + profil : applique, charge le profil, termine', async () => {
    const calls: string[] = [];
    await loadInitialSession({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      applySession: () => calls.push('apply'),
      refreshProfile: async () => { calls.push('profile'); },
      done: () => calls.push('done'),
    });
    expect(calls).toEqual(['apply', 'profile', 'done']);
  });

  it('getSession rejette : done() est quand meme appele (plus de splash infini)', async () => {
    const done = vi.fn();
    await expect(
      loadInitialSession({
        getSession: async () => { throw new Error('storage unreadable'); },
        applySession: vi.fn(),
        refreshProfile: vi.fn(),
        done,
      }),
    ).resolves.toBeUndefined();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('refreshProfile rejette : l\'app s\'ouvre quand meme', async () => {
    const done = vi.fn();
    await loadInitialSession({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      applySession: vi.fn(),
      refreshProfile: async () => { throw new Error('offline'); },
      done,
    });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('pas de session : pas de chargement de profil', async () => {
    const refreshProfile = vi.fn();
    const done = vi.fn();
    await loadInitialSession({ getSession: async () => ({ data: { session: null } }), applySession: vi.fn(), refreshProfile, done });
    expect(refreshProfile).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalled();
  });
});

describe('deferProfileRefresh', () => {
  it('n\'execute PAS le refresh dans la pile appelante (hors du verrou auth-js)', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    let scheduled: (() => void) | null = null;
    deferProfileRefresh(refresh, (fn) => { scheduled = fn; });
    expect(refresh).not.toHaveBeenCalled(); // synchrone : rien n'a tourne dans le "callback"
    scheduled!();
    await Promise.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('un refresh qui rejette ne produit pas de rejet non gere', async () => {
    let scheduled: (() => void) | null = null;
    deferProfileRefresh(() => Promise.reject(new Error('x')), (fn) => { scheduled = fn; });
    expect(() => scheduled!()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
