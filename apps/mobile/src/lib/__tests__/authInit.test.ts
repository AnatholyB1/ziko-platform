/**
 * Revue A #16 : demarrage de session sans splash infini ni await dans le callback onAuthStateChange.
 */
import { describe, it, expect, vi } from 'vitest';
import { loadInitialSession, deferProfileRefresh, readPersistedSession, supabaseStorageKey } from '../authInit';

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

describe('demarrage a froid HORS LIGNE (run5 : Bienvenue au lieu de la session persistee)', () => {
  const persisted = { user: { id: 'u1' }, refresh_token: 'r', access_token: 'a' };
  const networkErr = { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 };
  const perm = (e: any) => e?.code === 'refresh_token_not_found';

  it('erreur reseau + session persistee : l\'app s\'ouvre avec la session (mode degrade), profil tente', async () => {
    const applySession = vi.fn();
    const refreshProfile = vi.fn().mockRejectedValue(new Error('offline'));
    const done = vi.fn();
    await loadInitialSession({
      getSession: async () => ({ data: { session: null }, error: networkErr }),
      readPersistedSession: async () => persisted,
      isPermanentError: perm,
      applySession,
      refreshProfile,
      done,
    });
    expect(applySession).toHaveBeenCalledWith(persisted);
    expect(refreshProfile).toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('erreur PERMANENTE (jeton revoque) : vraie deconnexion, la session persistee n\'est PAS reutilisee', async () => {
    const applySession = vi.fn();
    const readPersisted = vi.fn().mockResolvedValue(persisted);
    await loadInitialSession({
      getSession: async () => ({ data: { session: null }, error: { code: 'refresh_token_not_found' } }),
      readPersistedSession: readPersisted,
      isPermanentError: perm,
      applySession,
      refreshProfile: vi.fn(),
      done: vi.fn(),
    });
    expect(readPersisted).not.toHaveBeenCalled();
    expect(applySession).toHaveBeenCalledWith(null);
  });

  it('aucune erreur et aucune session : pas de session persistee ressuscitee (premier lancement)', async () => {
    const applySession = vi.fn();
    await loadInitialSession({
      getSession: async () => ({ data: { session: null } }),
      readPersistedSession: async () => persisted,
      applySession,
      refreshProfile: vi.fn(),
      done: vi.fn(),
    });
    expect(applySession).toHaveBeenCalledWith(null);
  });

  it('readPersistedSession : cle supabase-js, format direct ou currentSession, refus sans refresh_token', async () => {
    const url = 'https://abcd1234.supabase.co';
    const key = supabaseStorageKey(url);
    expect(key).toBe('sb-abcd1234-auth-token');
    const mk = (v: any) => ({ getItem: async (k: string) => (k === key && v !== null ? JSON.stringify(v) : null) });
    expect(await readPersistedSession(mk(persisted), url)).toMatchObject({ user: { id: 'u1' } });
    expect(await readPersistedSession(mk({ currentSession: persisted }), url)).toMatchObject({ user: { id: 'u1' } });
    expect(await readPersistedSession(mk({ user: { id: 'u1' } }), url)).toBeNull();
    expect(await readPersistedSession(mk(null), url)).toBeNull();
  });
});
