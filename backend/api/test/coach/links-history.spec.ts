// P25 (MCOA-03) : historique des coachs de l'athlete. Pur unitaire (client Supabase mocke).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: { table: string; filters: [string, unknown][]; notNull?: string; limit?: number }[] = [];
let linkRows: any[] = [];
let profileRows: any[] = [];
let linkError: { message: string } | null = null;

vi.mock('../../src/coach/clients/db.js', () => ({
  createUserClient: () => ({
    from: (table: string) => {
      const rec = { table, filters: [] as [string, unknown][], notNull: undefined as string | undefined, limit: undefined as number | undefined };
      calls.push(rec);
      const chain: any = {
        select: () => chain,
        eq: (c: string, v: unknown) => (rec.filters.push([c, v]), chain),
        not: (c: string) => ((rec.notNull = c), chain),
        order: () => chain,
        limit: (n: number) => ((rec.limit = n), chain),
        in: () => chain,
        then: (res: any) =>
          res(
            table === 'ziko_coach_client_links'
              ? { data: linkError ? null : linkRows, error: linkError }
              : { data: profileRows, error: null },
          ),
      };
      return chain;
    },
  }),
}));

import { getLinkHistory, mapLinkHistory, HISTORY_LIMIT } from '../../src/coach/clients/history.js';

beforeEach(() => {
  calls.length = 0;
  linkRows = [];
  profileRows = [];
  linkError = null;
});

const row = (id: string, coach: string, linked: string, revoked: string, by: any = 'client') => ({
  id,
  coach_id: coach,
  created_at: linked,
  revoked_at: revoked,
  revoked_by: by,
});

describe('mapLinkHistory', () => {
  it('trie du plus recent retrait au plus ancien et plafonne a 5', () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      row(`l${i}`, 'c1', '2026-01-01T00:00:00Z', `2026-02-0${i + 1}T00:00:00Z`),
    );
    const out = mapLinkHistory(rows, { c1: 'Marie' });
    expect(out).toHaveLength(HISTORY_LIMIT);
    expect(out[0].link_id).toBe('l6');
    expect(out[4].link_id).toBe('l2');
  });

  it('ignore une ligne non retiree (jamais un lien actif dans l historique)', () => {
    const rows = [row('a', 'c1', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'), { ...row('b', 'c2', '2026-01-01T00:00:00Z', ''), revoked_at: null as any }];
    expect(mapLinkHistory(rows, {}).map((r) => r.link_id)).toEqual(['a']);
  });

  it('nom absent ou vide -> null (le mobile affiche "Ancien coach") ; revoked_by invalide -> null', () => {
    const out = mapLinkHistory([row('a', 'c1', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', 'hacker')], { c1: '   ' });
    expect(out[0].coach_name).toBeNull();
    expect(out[0].revoked_by).toBeNull();
  });
});

describe('getLinkHistory', () => {
  it('filtre sur client_id = utilisateur, uniquement les liens retires, limite 5', async () => {
    linkRows = [row('l1', 'c1', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', 'coach')];
    profileRows = [{ user_id: 'c1', display_name: 'Marie Durand' }];
    const out = await getLinkHistory('jwt', 'athlete-1');
    expect(calls[0].table).toBe('ziko_coach_client_links');
    expect(calls[0].filters).toContainEqual(['client_id', 'athlete-1']);
    expect(calls[0].notNull).toBe('revoked_at');
    expect(calls[0].limit).toBe(5);
    expect(out).toEqual([
      { link_id: 'l1', coach_id: 'c1', coach_name: 'Marie Durand', linked_at: '2026-01-01T00:00:00Z', revoked_at: '2026-02-01T00:00:00Z', revoked_by: 'coach' },
    ]);
  });

  it('aucun historique : ne requete pas les profils', async () => {
    expect(await getLinkHistory('jwt', 'a')).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(['ziko_coach_client_links']);
  });

  it('profil coach indisponible : ligne conservee avec nom null', async () => {
    linkRows = [row('l1', 'c9', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')];
    const out = await getLinkHistory('jwt', 'a');
    expect(out[0].coach_name).toBeNull();
  });

  it('erreur base : leve (la route repond 500, le mobile masque le bloc)', async () => {
    linkError = { message: 'boom' };
    await expect(getLinkHistory('jwt', 'a')).rejects.toThrow('boom');
  });
});
