/**
 * Phase 26 (v1.20) - service Ligue : la porte IA de la transition Habitudes -> Performance.
 * Prouve (base et modele MOQUES, 0 appel reel) : aucun appel de modele sans `proceed` de la base ; un appel au plus
 * par decision ; cout journalise `league_transition` meme en cas d'echec ; echec du modele = aucune transition ;
 * le modele dit "true" mais la base refuse = aucune transition ; une reponse "false" ne declenche rien ; le contexte
 * du modele est la preuve bornee ; aucune ecriture dans les tables protegees (non punitif).
 * Ne prouve PAS : la base reelle (harnais SQL) ni la qualite de la decision du vrai modele.
 */
import { describe, it, expect, vi } from 'vitest';
import { refreshLeague } from './service.js';

const EVIDENCE = {
  weeks: [{ week_start: '2026-11-02', score: 95 }, { week_start: '2026-10-26', score: 90 }, { week_start: '2026-10-19', score: 88 }, { week_start: '2026-10-12', score: 80 }],
  average_score: 88.25, tier: 3, readiness: 'building', experience_level: 'beginner',
};

function fakeDb(handlers: Record<string, (args: any) => { data?: unknown; error?: { message: string } | null }>) {
  const calls: Array<{ fn: string; args: any }> = [];
  const inserts: Array<{ table: string; row: any }> = [];
  const db: any = {
    rpc: vi.fn(async (fn: string, args: any) => {
      calls.push({ fn, args });
      const h = handlers[fn];
      if (!h) return { data: null, error: { message: `no handler ${fn}` } };
      const r = h(args);
      return { data: r.data ?? null, error: r.error ?? null };
    }),
    from: (table: string) => ({ insert: (row: any) => { inserts.push({ table, row }); return Promise.resolve({ error: null }); } }),
  };
  return { db, calls, inserts };
}

const UNLOCKED = { unlocked: true, track: 'habits', division: 2, recent_weeks: [], pending_celebration: null };
const ELIGIBLE = { proceed: true, reason: 'eligible', evidence: EVIDENCE };

describe('refreshLeague', () => {
  it('sync en echec : 502-able, aucun appel IA', async () => {
    const { db } = fakeDb({ ziko_league_sync: () => ({ error: { message: 'boom' } }) });
    const gen = vi.fn();
    expect(await refreshLeague('u1', { db, generate: gen })).toEqual({ status: 'error', reason: 'sync_failed' });
    expect(gen).not.toHaveBeenCalled();
  });

  it('verrouille (sous le palier) : aucune reservation, aucun appel IA', async () => {
    const { db, calls } = fakeDb({ ziko_league_sync: () => ({ data: { unlocked: false, required_tier: 3, tier: 2 } }) });
    const gen = vi.fn();
    const out = await refreshLeague('u1', { db, generate: gen });
    expect(out).toMatchObject({ status: 'ok', ai: 'skipped', reason: 'locked' });
    expect(calls.map((c) => c.fn)).toEqual(['ziko_league_sync']);
    expect(gen).not.toHaveBeenCalled();
  });

  it.each(['not_enough_weeks', 'below_threshold', 'not_habits_track', 'recent_transition', 'daily_cap', 'not_unlocked'])(
    'claim %s : 0 appel de modele, 0 ecriture, 0 cout',
    async (reason) => {
      const { db, calls, inserts } = fakeDb({
        ziko_league_sync: () => ({ data: UNLOCKED }),
        ziko_league_ai_claim: () => ({ data: { proceed: false, reason } }),
      });
      const gen = vi.fn();
      const out = await refreshLeague('u1', { db, generate: gen });
      expect(out).toMatchObject({ status: 'ok', ai: 'skipped', reason });
      expect(gen).not.toHaveBeenCalled();
      expect(inserts).toHaveLength(0);
      expect(calls.map((c) => c.fn)).toEqual(['ziko_league_sync', 'ziko_league_ai_claim']);
    },
  );

  it('le plafond quotidien envoye a la base est 1', async () => {
    const { db, calls } = fakeDb({
      ziko_league_sync: () => ({ data: UNLOCKED }),
      ziko_league_ai_claim: () => ({ data: { proceed: false, reason: 'daily_cap' } }),
    });
    await refreshLeague('u1', { db, generate: vi.fn() });
    expect(calls[1].args).toEqual({ p_user: 'u1', p_daily_cap: 1 });
  });

  it('claim en erreur ou de forme inattendue : echec ferme, aucun appel IA', async () => {
    let { db } = fakeDb({ ziko_league_sync: () => ({ data: UNLOCKED }), ziko_league_ai_claim: () => ({ error: { message: 'x' } }) });
    const gen = vi.fn();
    expect(await refreshLeague('u1', { db, generate: gen })).toMatchObject({ ai: 'skipped', reason: 'claim_failed' });
    ({ db } = fakeDb({ ziko_league_sync: () => ({ data: UNLOCKED }), ziko_league_ai_claim: () => ({ data: { proceed: true, reason: 'eligible' } }) }));
    expect(await refreshLeague('u1', { db, generate: gen })).toMatchObject({ ai: 'skipped', reason: 'claim_invalid' });
    expect(gen).not.toHaveBeenCalled();
  });

  it('chemin nominal : modele -> transition=true -> la base applique -> etat frais avec celebration', async () => {
    let syncs = 0;
    const { db, calls, inserts } = fakeDb({
      ziko_league_sync: () => ({ data: ++syncs === 1 ? UNLOCKED : { ...UNLOCKED, track: 'performance', pending_celebration: { id: 't1', to_track: 'performance', reason: 'ok' } } }),
      ziko_league_ai_claim: () => ({ data: ELIGIBLE }),
      ziko_league_apply_transition: () => ({ data: { applied: true, id: 't1' } }),
    });
    const gen = vi.fn(async () => ({ object: { transition: true, reason: 'Ta régularité est solide.' }, usage: { inputTokens: 120, outputTokens: 30 } }));
    const out: any = await refreshLeague('u1', { db, generate: gen });
    expect(out).toMatchObject({ status: 'ok', ai: 'applied', transition_id: 't1' });
    expect(out.league.pending_celebration.id).toBe('t1');
    expect(gen).toHaveBeenCalledTimes(1);
    expect(calls.find((c) => c.fn === 'ziko_league_apply_transition')!.args).toEqual({ p_user: 'u1', p_reason: 'Ta régularité est solide.' });
    expect(inserts).toEqual([{ table: 'ziko_ai_cost_log', row: expect.objectContaining({ user_id: 'u1', source: 'league_transition', input_tokens: 120, output_tokens: 30 }) }]);
  });

  it('le modele ne recoit que la preuve bornee (aucune donnee de sante)', async () => {
    const { db } = fakeDb({
      ziko_league_sync: () => ({ data: UNLOCKED }),
      ziko_league_ai_claim: () => ({ data: { proceed: true, reason: 'eligible', evidence: { ...EVIDENCE, weight_kg: 123, age: 17, email: 'a@b.c' } } }),
    });
    const gen = vi.fn(async () => ({ object: { transition: false, reason: 'pas encore' } }));
    await refreshLeague('u1', { db, generate: gen });
    const arg = (gen.mock.calls[0] as unknown[])[0] as { system: string; prompt: string };
    expect(arg.prompt).not.toMatch(/123|[^0-9]17[^0-9]|weight|poids|email|@|\bage\b/i);
    expect(arg.prompt).toContain('moyenne: 88.25');
  });

  it('modele : transition=false -> declined, aucune ecriture, cout journalise', async () => {
    const { db, calls, inserts } = fakeDb({ ziko_league_sync: () => ({ data: UNLOCKED }), ziko_league_ai_claim: () => ({ data: ELIGIBLE }) });
    const out = await refreshLeague('u1', { db, generate: async () => ({ object: { transition: false, reason: 'plus tard' }, usage: { inputTokens: 10, outputTokens: 5 } }) });
    expect(out).toMatchObject({ status: 'ok', ai: 'declined' });
    expect(calls.some((c) => c.fn === 'ziko_league_apply_transition')).toBe(false);
    expect(inserts).toHaveLength(1);
  });

  it('modele en echec : on reste en habitudes, appel quand meme journalise, aucune transition', async () => {
    const { db, calls, inserts } = fakeDb({ ziko_league_sync: () => ({ data: UNLOCKED }), ziko_league_ai_claim: () => ({ data: ELIGIBLE }) });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await refreshLeague('u1', { db, generate: async () => { throw new Error('timeout'); } });
    err.mockRestore();
    expect(out).toMatchObject({ status: 'ok', ai: 'error', reason: 'generation_failed' });
    expect((out as any).league.track).toBe('habits');
    expect(calls.some((c) => c.fn === 'ziko_league_apply_transition')).toBe(false);
    expect(inserts).toEqual([{ table: 'ziko_ai_cost_log', row: expect.objectContaining({ source: 'league_transition', input_tokens: 0, output_tokens: 0 }) }]);
  });

  it('sortie du modele invalide (pas un booleen) : declined, jamais appliquee', async () => {
    const { db, calls } = fakeDb({ ziko_league_sync: () => ({ data: UNLOCKED }), ziko_league_ai_claim: () => ({ data: ELIGIBLE }) });
    const out = await refreshLeague('u1', { db, generate: async () => ({ object: { transition: 'oui', reason: 'x' } }) });
    expect(out).toMatchObject({ ai: 'declined' });
    expect(calls.some((c) => c.fn === 'ziko_league_apply_transition')).toBe(false);
  });

  it('le modele dit true mais la base refuse (pre-filtre) : aucune transition', async () => {
    const { db } = fakeDb({
      ziko_league_sync: () => ({ data: UNLOCKED }),
      ziko_league_ai_claim: () => ({ data: ELIGIBLE }),
      ziko_league_apply_transition: () => ({ data: { applied: false, reason: 'not_enough_weeks' } }),
    });
    const out: any = await refreshLeague('u1', { db, generate: async () => ({ object: { transition: true, reason: 'ok' } }) });
    expect(out).toMatchObject({ status: 'ok', ai: 'declined' });
    expect(out.league.track).toBe('habits');
  });

  it('apply en erreur : ai=error, etat de ligue renvoye quand meme', async () => {
    const { db } = fakeDb({
      ziko_league_sync: () => ({ data: UNLOCKED }),
      ziko_league_ai_claim: () => ({ data: ELIGIBLE }),
      ziko_league_apply_transition: () => ({ error: { message: 'db down' } }),
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await refreshLeague('u1', { db, generate: async () => ({ object: { transition: true, reason: 'ok' } }) });
    err.mockRestore();
    expect(out).toMatchObject({ status: 'ok', ai: 'error', reason: 'apply_failed' });
  });

  it('non punitif : le service ne touche jamais XP/pieces/serie/tier/journal v1.18 ni le credit', async () => {
    const { db, calls, inserts } = fakeDb({
      ziko_league_sync: () => ({ data: UNLOCKED }),
      ziko_league_ai_claim: () => ({ data: ELIGIBLE }),
      ziko_league_apply_transition: () => ({ data: { applied: true, id: 't' } }),
    });
    await refreshLeague('u1', { db, generate: async () => ({ object: { transition: true, reason: 'ok' } }) });
    const fns = calls.map((c) => c.fn);
    expect(fns.every((f) => f.startsWith('ziko_league_'))).toBe(true);
    expect(inserts.every((i) => i.table === 'ziko_ai_cost_log')).toBe(true);
    expect(fns.join(' ')).not.toMatch(/credit|coin|xp|athlete|decision|gamif/);
  });
});
