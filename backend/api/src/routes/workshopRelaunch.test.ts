/**
 * Phase 24 (v1.20) - ATEL-09 : routes /ai/workshop/relaunch/* et /sequence (mocks, aucun appel reseau ni IA).
 * Prouve : check -> propose ne passent par AUCUN gate de credits (creditService jamais appele : appel
 * automatique absorbe), le modele est appele une seule fois, le brouillon est rempli, /sequence renvoie la
 * suite ordonnee, une relance d'un autre utilisateur est introuvable, dismiss ne coute rien.
 * Ne prouve PAS : le vrai modele, le SQL, ni la reponse de l'app mobile.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const h = vi.hoisted(() => ({ db: { current: null as any }, generate: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => {
      throw new Error('gate table must not be read by relaunch routes');
    }),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1', email: 'u@example.com' } }, error: null })) },
  })),
}));
vi.mock('../tools/db.js', () => ({ clientForUser: () => h.db.current }));
vi.mock('../config/models.js', () => ({ AGENT_MODEL: 'test-model' }));
vi.mock('ai', async (orig) => {
  const actual: any = await orig();
  return { ...actual, generateText: (args: any) => h.generate(args) };
});
vi.mock('../services/creditService.js', () => ({
  getQuotaStatus: vi.fn(),
  trackQuotaUsage: vi.fn(),
  deductCredits: vi.fn(),
}));
vi.mock('../context/conversation.js', () => ({
  getOrCreateConversation: vi.fn(async (userId: string) => ({ conversationId: 'conv-1', history: [], pluginContext: {}, userId })),
  appendMessages: vi.fn(async () => undefined),
  updateConversationTitle: vi.fn(async () => undefined),
}));

import { workshopRouter } from './workshop.js';
import * as creditService from '../services/creditService.js';
import { createFakeDb } from '../workshop/fakeDb.testutil.js';

const headers = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' };
const app = () => {
  const a = new Hono();
  a.route('/ai/workshop', workshopRouter);
  return a;
};
const call = (method: string, path: string) => app().request(`/ai/workshop${path}`, { method, headers });
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const PD = { weeks: [{ sessions: [{ name: 'A', day_of_week: 1, exercises: [] }] }, { sessions: [{ name: 'A', day_of_week: 1, exercises: [] }] }] };

beforeEach(() => {
  vi.clearAllMocks();
  h.db.current = createFakeDb({
    ziko_ai_generated_programs: [
      { id: 'p1', user_id: 'user-1', name: 'Bloc 1', goal: 'strength', days_per_week: 1, is_active: true, completed_at: null, started_at: daysAgo(20), created_at: daysAgo(21), program_data: PD },
    ],
    ziko_workout_sessions: [{ id: 's1', user_id: 'user-1', started_at: daysAgo(15), ended_at: daysAgo(15), total_volume_kg: 3000 }],
    ziko_session_sets: [{ session_id: 's1', exercise_id: 'e1', reps: 5, weight_kg: 100, completed: true }],
    ziko_exercises: [{ id: 'e1', name: 'Squat' }],
  });
  h.generate.mockImplementation(async (args: any) => {
    await args.tools.workshop_set_draft.execute(
      { program: { name: 'Bloc 2', goal: 'strength', weeks: [{ sessions: [{ name: 'S', day_of_week: 2, exercises: [{ name: 'Squat', sets: 3, reps: '5' }] }] }] } },
      { toolCallId: 't', messages: [] },
    );
    return { text: 'Suite proposee.', totalUsage: { inputTokens: 100, outputTokens: 50 } };
  });
});

describe('relance automatique via HTTP', () => {
  it('check puis propose : programme clos, brouillon rempli, 1 appel modele, AUCUN credit touche', async () => {
    const check = await call('POST', '/relaunch/check');
    expect(check.status).toBe(200);
    const cb: any = await check.json();
    expect(cb.closed_program_id).toBe('p1');
    expect(cb.relaunch).toMatchObject({ status: 'pending', program_name: 'Bloc 1' });
    expect(cb.relaunch.results.sessions_done).toBe(1);

    const prop = await call('POST', `/relaunch/${cb.relaunch.id}/propose`);
    expect(prop.status).toBe(200);
    expect(await prop.json()).toMatchObject({ status: 'proposed', draft_id: cb.relaunch.draft_id });
    expect(h.generate).toHaveBeenCalledTimes(1);
    expect(Object.keys(h.generate.mock.calls[0][0].tools)).not.toContain('workshop_web_search');
    expect(h.db.current.tables.ziko_workshop_drafts[0].program_data.weeks).toHaveLength(1);

    // second appel : idempotent, pas de second appel modele
    const again = await call('POST', `/relaunch/${cb.relaunch.id}/propose`);
    expect(await again.json()).toMatchObject({ status: 'proposed', already: true });
    expect(h.generate).toHaveBeenCalledTimes(1);

    expect(creditService.getQuotaStatus).not.toHaveBeenCalled();
    expect(creditService.trackQuotaUsage).not.toHaveBeenCalled();
    expect(creditService.deductCredits).not.toHaveBeenCalled();
  });

  it('GET /sequence : suite ordonnee avec le programme termine et la relance ouverte', async () => {
    await call('POST', '/relaunch/check');
    const res = await call('GET', '/sequence');
    const body: any = await res.json();
    expect(body.items).toEqual([expect.objectContaining({ id: 'p1', position: 1, status: 'done' })]);
    expect(body.relaunch).toMatchObject({ status: 'pending' });
  });

  it('propose sur une relance inconnue : 404 ; dismiss : ok, puis 409 sur propose', async () => {
    expect((await call('POST', '/relaunch/nope/propose')).status).toBe(404);
    const cb: any = await (await call('POST', '/relaunch/check')).json();
    expect((await call('POST', `/relaunch/${cb.relaunch.id}/dismiss`)).status).toBe(200);
    expect((await call('POST', `/relaunch/${cb.relaunch.id}/propose`)).status).toBe(409);
    expect(h.generate).not.toHaveBeenCalled();
  });

  it('panne du modele : 200 pending ai_error (rien de debite, la relance reste utilisable)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.generate.mockRejectedValueOnce(new Error('529'));
    const cb: any = await (await call('POST', '/relaunch/check')).json();
    const prop = await call('POST', `/relaunch/${cb.relaunch.id}/propose`);
    expect(await prop.json()).toMatchObject({ status: 'pending', skipped: 'ai_error' });
    expect(creditService.deductCredits).not.toHaveBeenCalled();
  });
});
