/**
 * Phase 23 (v1.20) - ATEL-10 / A-6 / A-7 : route /ai/workshop (mocks, aucun appel reseau ni IA).
 * Prouve :
 *  - POST /stream est derriere creditCheck('chat') : balance insuffisante => 402, le modele n'est PAS appele ;
 *  - succes => flux SSE meta/tool/draft/chunk/done et debit via creditDeduct('chat') ;
 *  - panne du modele avant le premier signal utile => 502 et AUCUN debit (A14) ;
 *  - PATCH (edition manuelle) ne passe par aucun gate et ne debite jamais (A-6), 409 si revision perimee ;
 *  - GET /info renvoie le cout REEL (CREDIT_COSTS.chat), pas un "1 credit" en dur ;
 *  - un brouillon d'un autre utilisateur est introuvable.
 * Ne prouve PAS : le comportement reel de Sonnet, la RPC SQL de debit, ni un flux reseau reel (tests : faux flux).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const h = vi.hoisted(() => ({
  gateFrom: vi.fn(),
  streamParts: { current: [] as any[] },
  streamCalls: vi.fn(),
  db: { current: null as any },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: h.gateFrom,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1', email: 'u@example.com' } }, error: null })) },
  })),
}));
vi.mock('../tools/db.js', () => ({ clientForUser: () => h.db.current }));
vi.mock('../config/models.js', () => ({ AGENT_MODEL: 'test-model' }));
vi.mock('ai', async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    streamText: (args: any) => {
      const pre = h.streamCalls(args); // may be a promise (a tool executing mid-turn): awaited before streaming
      return {
        fullStream: (async function* () {
          await pre;
          const parts = h.streamParts.current;
          for (const p of parts) {
            if (p === '__throw__') throw new Error('network down');
            yield p;
          }
        })(),
      };
    },
  };
});
vi.mock('../services/creditService.js', () => ({
  getQuotaStatus: vi.fn(),
  trackQuotaUsage: vi.fn(async () => undefined),
  deductCredits: vi.fn(async () => ({ success: true, balance: 1 })),
}));
vi.mock('../context/conversation.js', () => ({
  getOrCreateConversation: vi.fn(async (userId: string, id?: string) => ({ conversationId: id ?? 'conv-1', history: [], pluginContext: {}, userId })),
  appendMessages: vi.fn(async () => undefined),
  updateConversationTitle: vi.fn(async () => undefined),
}));

import { workshopRouter } from './workshop.js';
import * as creditService from '../services/creditService.js';
import { createFakeDb } from '../workshop/fakeDb.testutil.js';
import { CREDIT_COSTS } from '../config/credits.js';
import { createDraft } from '../workshop/store.js';

const mockQuota = vi.mocked(creditService.getQuotaStatus);
const mockDeduct = vi.mocked(creditService.deductCredits);
const mockTrack = vi.mocked(creditService.trackQuotaUsage);

function chain(v: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'order', 'gte']) c[m] = vi.fn(() => c);
  c.maybeSingle = vi.fn(() => Promise.resolve(v));
  c.single = vi.fn(() => Promise.resolve(v));
  c.then = (res: any, rej?: any) => Promise.resolve(v).then(res, rej);
  return c;
}

function gateTables() {
  h.gateFrom.mockImplementation((table: string) => {
    if (table === 'ziko_app_config') return chain({ data: { value: false }, error: null });
    if (table === 'ziko_user_profiles') return chain({ data: { tier: 'free' }, error: null });
    if (table === 'ziko_ai_credit_transactions') return chain({ data: [], error: null });
    throw new Error(`unexpected gate table ${table}`);
  });
}

const app = () => {
  const a = new Hono();
  a.route('/ai/workshop', workshopRouter);
  return a;
};
const headers = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' };
const call = (a: Hono, method: string, path: string, body?: unknown) =>
  a.request(`/ai/workshop${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

const PROGRAM = {
  name: 'Peak',
  goal: 'powerlifting',
  weeks: [{ sessions: [{ name: 'Squat', day_of_week: 1, exercises: [{ name: 'Squat', sets: 4, reps: '3', pct_1rm: 85, rpe: 8 }] }] }],
};

async function events(res: Response) {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter((l) => l.startsWith('data: ') && !l.includes('[DONE]'))
    .map((l) => JSON.parse(l.slice(6)));
}

beforeEach(() => {
  vi.clearAllMocks();
  gateTables();
  h.db.current = createFakeDb();
  h.streamParts.current = [];
  mockQuota.mockResolvedValue({ withinFreeQuota: false, dailyUsed: 1, dailyQuota: 1, balance: 20, earnHint: '' });
});

describe('POST /stream', () => {
  it('402 when the balance is below the real chat cost, and the model is not called', async () => {
    mockQuota.mockResolvedValue({ withinFreeQuota: false, dailyUsed: 1, dailyQuota: 1, balance: 1, earnHint: 'x' });
    const res = await call(app(), 'POST', '/stream', { message: 'Fais-moi un programme' });
    expect(res.status).toBe(402);
    const body: any = await res.json();
    expect(body.error).toBe('insufficient_credits');
    expect(body.required).toBe(CREDIT_COSTS.chat);
    expect(h.streamCalls).not.toHaveBeenCalled();
    expect(mockDeduct).not.toHaveBeenCalled();
  });

  it('streams tool chips, the live draft and text, then deducts the chat cost once', async () => {
    const db: any = h.db.current;
    h.streamParts.current = [
      { type: 'start' },
      { type: 'tool-call', toolCallId: 'a', toolName: 'workshop_load_skill', input: { id: 'powerlifting-peaking' } },
      { type: 'tool-result', toolCallId: 'a', toolName: 'workshop_load_skill', input: { id: 'powerlifting-peaking' }, output: { id: 'x' } },
      { type: 'tool-call', toolCallId: 'b', toolName: 'workshop_web_search', input: { query: 'ipf' } },
      { type: 'tool-result', toolCallId: 'b', toolName: 'workshop_web_search', output: { ok: true } },
      { type: 'text-delta', text: 'Voici ton brouillon.' },
      { type: 'finish' },
    ];
    // simulate the draft tool having written the draft during the turn: capture tools and run it
    h.streamCalls.mockImplementationOnce(async () => undefined);
    const res = await call(app(), 'POST', '/stream', { message: 'Programme powerlifting 8 semaines' });
    expect(res.status).toBe(200);
    const ev = await events(res);
    expect(ev[0]).toMatchObject({ type: 'meta', conversation_id: 'conv-1', cost: CREDIT_COSTS.chat });
    expect(ev.filter((e) => e.type === 'tool').map((e) => `${e.name}:${e.state}`)).toEqual([
      'workshop_load_skill:start',
      'workshop_load_skill:done',
      'workshop_web_search:start',
      'workshop_web_search:done',
    ]);
    expect(ev.find((e) => e.type === 'tool')?.label).toContain('Skill');
    // chip appears BEFORE the text (A-6)
    const firstTool = ev.findIndex((e) => e.type === 'tool');
    const firstChunk = ev.findIndex((e) => e.type === 'chunk');
    expect(firstTool).toBeLessThan(firstChunk);
    expect(ev.at(-1)).toMatchObject({ type: 'done' });
    // exactly one debit, tagged with the real chat kind; the system prompt carries skills + context + draft
    expect(mockDeduct).toHaveBeenCalledTimes(1);
    expect(mockDeduct.mock.calls[0][1]).toBe('chat');
    const args = h.streamCalls.mock.calls[0][0];
    expect(args.system).toContain('SKILL LIBRARY');
    expect(args.system).toContain('ATHLETE CONTEXT');
    expect(Object.keys(args.tools)).toEqual(
      expect.arrayContaining(['workshop_set_draft', 'workshop_edit_draft', 'workshop_web_search', 'workshop_load_skill', 'workshop_get_context']),
    );
    expect(db.tables.ziko_workshop_drafts).toHaveLength(1);
  });

  it('draft written by a tool is emitted as a draft event with its revision', async () => {
    h.streamCalls.mockImplementationOnce((args: any) => {
      // run the real tool the way the SDK would, in the middle of the turn
      h.streamParts.current = [
        { type: 'start' },
        { type: 'tool-call', toolCallId: 'a', toolName: 'workshop_set_draft', input: { program: PROGRAM } },
        { type: 'tool-result', toolCallId: 'a', toolName: 'workshop_set_draft', output: { ok: true } },
        { type: 'text-delta', text: 'Fait.' },
      ];
      return args.tools.workshop_set_draft.execute({ program: PROGRAM }, { toolCallId: 'a', messages: [] });
    });
    const res = await call(app(), 'POST', '/stream', { message: 'go' });
    const ev = await events(res);
    const draft = ev.find((e) => e.type === 'draft');
    expect(draft?.revision).toBe(1);
    expect(draft?.program.weeks[0].sessions[0].exercises[0].pct_1rm).toBe(85);
  });

  it('502 and NO debit when the model fails before any useful output (A14)', async () => {
    h.streamParts.current = [{ type: 'start' }, { type: 'error', error: new Error('anthropic 529') }];
    const res = await call(app(), 'POST', '/stream', { message: 'go' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'ai_unavailable' });
    expect(mockDeduct).not.toHaveBeenCalled();
  });

  it('502 when the stream throws before the first useful part', async () => {
    h.streamParts.current = ['__throw__'];
    const res = await call(app(), 'POST', '/stream', { message: 'go' });
    expect(res.status).toBe(502);
    expect(mockDeduct).not.toHaveBeenCalled();
  });

  it('error after output: interrupted event, debit kept (the model did work)', async () => {
    h.streamParts.current = [{ type: 'text-delta', text: 'Debut' }, { type: 'error', error: new Error('cut') }];
    const res = await call(app(), 'POST', '/stream', { message: 'go' });
    expect(res.status).toBe(200);
    const ev = await events(res);
    expect(ev.some((e) => e.type === 'error' && e.error === 'stream_interrupted')).toBe(true);
    expect(mockDeduct).toHaveBeenCalledTimes(1);
  });

  it('free-quota slot: passes through without a balance deduction', async () => {
    mockQuota.mockResolvedValue({ withinFreeQuota: true, dailyUsed: 0, dailyQuota: 1, balance: 0, earnHint: '' });
    h.streamParts.current = [{ type: 'text-delta', text: 'ok' }, { type: 'finish' }];
    const res = await call(app(), 'POST', '/stream', { message: 'go' });
    expect(res.status).toBe(200);
    await res.text();
    expect(mockDeduct).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('validates the message and refuses a draft that is not yours', async () => {
    expect((await call(app(), 'POST', '/stream', { message: '   ' })).status).toBe(400);
    expect((await call(app(), 'POST', '/stream', { message: 'x'.repeat(5000) })).status).toBe(413);
    expect((await call(app(), 'POST', '/stream', { message: 'go', draft_id: 'nope' })).status).toBe(404);
    expect(h.streamCalls).not.toHaveBeenCalled();
  });
});

describe('manual edit (PATCH) costs nothing', () => {
  async function seedDraft() {
    const db: any = h.db.current;
    const d = await createDraft(db, 'user-1', 'conv-1');
    const row = db.tables.ziko_workshop_drafts[0];
    row.program_data = { ...PROGRAM, split_type: 'custom', days_per_week: 1, weeks_count: 1, weeks: PROGRAM.weeks.map((w, i) => ({ ...w, w: i + 1 })) };
    row.revision = 1;
    return d.id;
  }

  it('applies typed ops, bumps the revision, never touches credits or the model', async () => {
    const id = await seedDraft();
    const res = await call(app(), 'PATCH', `/drafts/${id}`, {
      expected_revision: 1,
      ops: [{ op: 'update_exercise', week: 1, session: 0, index: 0, patch: { sets: 6, pct_1rm: 87.5 } }],
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.draft.revision).toBe(2);
    expect(body.draft.program.weeks[0].sessions[0].exercises[0]).toMatchObject({ sets: 6, pct_1rm: 87.5 });
    expect(mockQuota).not.toHaveBeenCalled();
    expect(mockDeduct).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
    expect(h.streamCalls).not.toHaveBeenCalled();
  });

  it('409 with the current draft when the revision is stale; 422 on a bad op; set_program is ignored', async () => {
    const id = await seedDraft();
    const stale: any = await call(app(), 'PATCH', `/drafts/${id}`, { expected_revision: 0, ops: [{ op: 'rename', name: 'x' }] });
    expect(stale.status).toBe(409);
    expect((await stale.json()).draft.revision).toBe(1);
    const bad = await call(app(), 'PATCH', `/drafts/${id}`, { expected_revision: 1, ops: [{ op: 'remove_exercise', week: 1, session: 0, index: 9 }] });
    expect(bad.status).toBe(422);
    const replace = await call(app(), 'PATCH', `/drafts/${id}`, { expected_revision: 1, ops: [{ op: 'set_program', program: {} }] });
    expect(replace.status).toBe(422); // filtered out => empty ops
    expect((await call(app(), 'PATCH', `/drafts/${id}`, { ops: [] })).status).toBe(400);
  });

  it('GET and PATCH on another user\'s draft are 404', async () => {
    const db: any = h.db.current;
    const other = await createDraft(db, 'someone-else', 'c');
    expect((await call(app(), 'GET', `/drafts/${other.id}`)).status).toBe(404);
    expect((await call(app(), 'PATCH', `/drafts/${other.id}`, { expected_revision: 0, ops: [{ op: 'rename', name: 'x' }] })).status).toBe(404);
  });
});

describe('publish and info', () => {
  it('publish inserts an inactive program; empty draft is 409', async () => {
    const db: any = h.db.current;
    const d = await createDraft(db, 'user-1', 'conv-1');
    expect((await call(app(), 'POST', `/drafts/${d.id}/publish`)).status).toBe(409);
    const row = db.tables.ziko_workshop_drafts[0];
    row.program_data = { ...PROGRAM, split_type: 'custom', days_per_week: 1, weeks_count: 1, weeks: PROGRAM.weeks.map((w, i) => ({ ...w, w: i + 1 })) };
    const res = await call(app(), 'POST', `/drafts/${d.id}/publish`);
    expect(res.status).toBe(200);
    expect((await res.json() as any).program_id).toBeTruthy();
    expect(db.tables.ziko_ai_generated_programs[0].is_active).toBe(false);
  });

  it('GET /info exposes the real cost, balance, free quota and the real context counts', async () => {
    const db: any = createFakeDb({
      ziko_workout_sessions: [{ id: 's1', user_id: 'user-1', name: 'A', started_at: new Date().toISOString() }],
      ziko_ai_generated_programs: [{ user_id: 'user-1', name: 'P', goal: 'x', is_active: false, created_at: '2026-01-01' }],
    });
    h.db.current = db;
    mockQuota.mockResolvedValue({ withinFreeQuota: true, dailyUsed: 0, dailyQuota: 1, balance: 7, earnHint: '' });
    const res = await call(app(), 'GET', '/info');
    const body: any = await res.json();
    expect(body.cost).toBe(CREDIT_COSTS.chat);
    expect(body.cost).not.toBe(1);
    expect(body).toMatchObject({ balance: 7, free_left: 1, context: { sessions: 1, programs: 1, records: 0 } });
  });
});
