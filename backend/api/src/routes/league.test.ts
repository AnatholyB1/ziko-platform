/**
 * Phase 26 (v1.20) - routes /league/refresh et /league/collective.
 * Prouve : auth obligatoire (401), identite issue du jeton (jamais du corps), aucun creditCheck/creditDeduct sur le
 * refresh automatique, 502 seulement si la synchronisation echoue ; la creation de defi collectif utilise le JWT DU
 * COACH (la base verifie le role) et traduit les erreurs metier ; corps invalide = 400 sans appel base ; metrique de
 * sante refusee.
 * Ne prouve PAS : le service reel (service.test.ts) ni la base (harnais SQL p26-league-sql).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockRefresh, mockRpc, mockCreateUserClient } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  return { mockRefresh: vi.fn(), mockRpc, mockCreateUserClient: vi.fn(() => ({ rpc: mockRpc })) };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn(async (t: string) => (t === 'tok' ? { data: { user: { id: 'user-1', email: 'u@example.com' } }, error: null } : { data: { user: null }, error: { message: 'bad' } })) },
  })),
}));
vi.mock('../league/service.js', () => ({ refreshLeague: mockRefresh }));
vi.mock('../coach/clients/db.js', () => ({ createUserClient: mockCreateUserClient }));
vi.mock('../middleware/creditGate.js', () => ({
  creditCheck: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
  creditDeduct: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { leagueRouter } from './league.js';
import { creditCheck, creditDeduct } from '../middleware/creditGate.js';

const app = () => { const a = new Hono(); a.route('/league', leagueRouter); return a; };
const post = (path: string, token = 'tok', body: unknown = {}) =>
  app().request(`/league${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /league/refresh', () => {
  it('sans jeton valide : 401, service non appele', async () => {
    expect((await app().request('/league/refresh', { method: 'POST' })).status).toBe(401);
    expect((await post('/refresh', 'nope')).status).toBe(401);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
  it("utilise l'identifiant du jeton et ignore un user_id du corps", async () => {
    mockRefresh.mockResolvedValue({ status: 'ok', ai: 'skipped', reason: 'not_enough_weeks', league: { unlocked: true } });
    const res = await post('/refresh', 'tok', { user_id: 'attacker' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', ai: 'skipped' });
    expect(mockRefresh).toHaveBeenCalledWith('user-1');
  });
  it('appel automatique : jamais derriere le gate de credits', async () => {
    mockRefresh.mockResolvedValue({ status: 'ok', ai: 'applied', transition_id: 't', league: {} });
    await post('/refresh');
    expect(creditCheck).not.toHaveBeenCalled();
    expect(creditDeduct).not.toHaveBeenCalled();
  });
  it('synchronisation en echec : 502', async () => {
    mockRefresh.mockResolvedValue({ status: 'error', reason: 'sync_failed' });
    const res = await post('/refresh');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ status: 'error', reason: 'sync_failed' });
  });
});

const GOOD = { title: 'Defi eau du groupe', metric: 'hydration_ml', target_total: 10000, start_date: '2026-11-16', end_date: '2026-11-22' };

describe('POST /league/collective', () => {
  it('sans jeton : 401', async () => {
    expect((await app().request('/league/collective', { method: 'POST', body: JSON.stringify(GOOD) })).status).toBe(401);
    expect(mockCreateUserClient).not.toHaveBeenCalled();
  });
  it('cree via le JWT du coach (pas la cle service) et renvoie 201', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'c1', invited: 3 }, error: null });
    const res = await post('/collective', 'tok', GOOD);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'created', id: 'c1', invited: 3 });
    expect(mockCreateUserClient).toHaveBeenCalledWith('tok');
    expect(mockRpc).toHaveBeenCalledWith('ziko_create_collective_challenge', {
      p_title: GOOD.title, p_metric: 'hydration_ml', p_target: 10000, p_start: '2026-11-16', p_end: '2026-11-22',
    });
  });
  it.each([
    ['not_a_coach', 403],
    ['no_clients', 409],
    ['too_many_active_challenges', 409],
    ['invalid_arguments', 400],
  ])('erreur de la base %s -> %i', async (msg, status) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: msg } });
    const res = await post('/collective', 'tok', GOOD);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: msg });
  });
  it('erreur inconnue : 502 sans fuite du message', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'secret internal detail' } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post('/collective', 'tok', GOOD);
    err.mockRestore();
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret/);
  });
  it.each([
    ['metrique de sante', { ...GOOD, metric: 'weight_kg' }],
    ['titre trop court', { ...GOOD, title: 'ab' }],
    ['cible negative', { ...GOOD, target_total: -1 }],
    ['date mal formee', { ...GOOD, start_date: 'demain' }],
    ['corps vide', {}],
  ])('corps invalide (%s) : 400, aucun appel base', async (_n, body) => {
    const res = await post('/collective', 'tok', body);
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
