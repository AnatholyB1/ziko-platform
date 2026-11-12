/**
 * Phase 14 (v1.20) - QUEST-03/04 : route POST /quests/refresh et enregistrement des outils.
 * Prouve : auth obligatoire (401), l'identite vient du jeton (jamais du corps), aucun creditCheck/creditDeduct
 * sur la generation automatique, 502 seulement en cas d'erreur ; quests_get / quests_create sont exposes a l'agent
 * (allToolSchemas + executor) sans outil de suppression ni de refus (QUEST-06), quests_create exige une duree.
 * Ne prouve PAS : le service reel (voir service.test.ts) ni la base.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn(async (t: string) => (t === 'tok' ? { data: { user: { id: 'user-1', email: 'u@example.com' } }, error: null } : { data: { user: null }, error: { message: 'bad' } })) },
  })),
}));
vi.mock('../quests/service.js', () => ({ refreshQuestsAuto: mockRefresh, listQuestsForChat: vi.fn(), createQuestFromChat: vi.fn() }));
vi.mock('../middleware/creditGate.js', () => ({
  creditCheck: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
  creditDeduct: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { questsRouter } from './quests.js';
import { creditCheck, creditDeduct } from '../middleware/creditGate.js';
import { allToolSchemas, getToolExecutor, INTERNAL_ONLY_TOOLS } from '../tools/registry.js';

function app() {
  const a = new Hono();
  a.route('/quests', questsRouter);
  return a;
}
const post = (a: Hono, token = 'tok', body: unknown = {}) =>
  a.request('/quests/refresh', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /quests/refresh', () => {
  it('sans jeton valide : 401, service non appele', async () => {
    expect((await app().request('/quests/refresh', { method: 'POST' })).status).toBe(401);
    expect((await post(app(), 'nope')).status).toBe(401);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("utilise l'identifiant du jeton, ignore un user_id du corps, renvoie le resultat", async () => {
    mockRefresh.mockResolvedValue({ status: 'created', reason: 'level_up', created: 2, skipped: 0, level: 4 });
    const res = await post(app(), 'tok', { user_id: 'attacker' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'created', created: 2 });
    expect(mockRefresh).toHaveBeenCalledWith('user-1');
  });

  it('appel automatique : jamais derriere le gate de credits', async () => {
    mockRefresh.mockResolvedValue({ status: 'skipped', reason: 'not_needed' });
    const res = await post(app());
    expect(await res.json()).toEqual({ status: 'skipped', reason: 'not_needed' });
    expect(creditCheck).not.toHaveBeenCalled();
    expect(creditDeduct).not.toHaveBeenCalled();
  });

  it('erreur de generation : 502 avec la raison', async () => {
    mockRefresh.mockResolvedValue({ status: 'error', reason: 'generation_failed' });
    const res = await post(app());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ status: 'error', reason: 'generation_failed' });
  });
});

describe('registre des outils (QUEST-03)', () => {
  it('quests_get et quests_create sont exposes a l\'agent et executables', () => {
    const names = allToolSchemas.map((t) => t.name);
    expect(names).toContain('quests_get');
    expect(names).toContain('quests_create');
    expect(getToolExecutor('quests_get')).toBeTypeOf('function');
    expect(getToolExecutor('quests_create')).toBeTypeOf('function');
    expect(INTERNAL_ONLY_TOOLS.has('quests_create')).toBe(false);
  });
  it("aucun outil de suppression ni de refus de quete (QUEST-06)", () => {
    expect(allToolSchemas.map((t) => t.name).filter((n) => /quest/.test(n) && /delete|remove|decline|refuse|cancel|skip/.test(n))).toEqual([]);
  });
  it('quests_create : duree obligatoire, metriques en liste blanche, noms uniques', () => {
    const s = allToolSchemas.find((t) => t.name === 'quests_create')!;
    expect(s.parameters.required).toEqual(expect.arrayContaining(['title', 'metric', 'target', 'scope', 'duration_hours']));
    expect(s.parameters.properties.metric!.enum).toEqual(['workout_sessions', 'hydration_ml', 'nutrition_logs', 'habit_logs']);
    const all = allToolSchemas.map((t) => t.name);
    expect(new Set(all).size).toBe(all.length);
  });
});
