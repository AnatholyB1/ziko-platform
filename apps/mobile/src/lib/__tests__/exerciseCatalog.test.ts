import { describe, it, expect, vi } from 'vitest';
import { fetchCatalogCandidates } from '../exerciseCatalog';

function client(result: { data?: any[]; error?: any }) {
  const calls: any = {};
  const chain: any = {
    select: vi.fn((c: string) => ((calls.select = c), chain)),
    or: vi.fn((f: string) => ((calls.or = f), chain)),
    limit: vi.fn((n: number) => ((calls.limit = n), Promise.resolve(result))),
  };
  return { calls, from: vi.fn((t: string) => ((calls.table = t), chain)) };
}

describe('fetchCatalogCandidates', () => {
  it('interroge ziko_exercises avec des motifs EN (alias) et accentues sur name / name_fr', async () => {
    const c = client({ data: [{ id: 'a', name: 'dumbbell bench press', name_fr: null }] });
    const rows = await fetchCatalogCandidates(c, 'Développé couché haltères', {});
    expect(rows).toHaveLength(1);
    expect(c.calls.table).toBe('ziko_exercises');
    expect(c.calls.or).toContain('name.ilike.%press%');
    expect(c.calls.or).toContain('name_fr.ilike.%développé%');
    expect(c.calls.limit).toBe(600);
  });
  it('saisie sans mot exploitable -> aucun appel reseau', async () => {
    const c = client({ data: [] });
    expect(await fetchCatalogCandidates(c, '', {})).toEqual([]);
    expect(c.from).not.toHaveBeenCalled();
  });
  it('erreur Supabase -> exception (l ecran affiche "Catalogue indisponible", jamais un faux "non reconnu")', async () => {
    await expect(fetchCatalogCandidates(client({ error: new Error('x') }), 'squat', {})).rejects.toThrow('x');
  });
});
