// Phase 43 plan 03 (v1.18, conversational-onboarding) — route-level coverage
// for POST /ai/onboarding/stream: credit exemption, tool scoping, and the
// ownership + plugin_context tag gate.
//
// Pure unit spec — no live database, no real Anthropic call, no
// conditional live-DB skip guard, so it runs unconditionally in CI. Mocks
// context/conversation.js,
// middleware/auth.js, the 'ai' SDK, and @supabase/supabase-js so the SSE
// assertions are fully deterministic.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mutable mock state (declared before vi.mock calls, following
// the house pattern already proven in test/tools/onboarding.spec.ts) ───────
const mockGetOrCreateConversation = vi.fn();
const mockAppendMessages = vi.fn();

vi.mock('../../src/context/conversation.js', () => ({
  getOrCreateConversation: (...args: unknown[]) => mockGetOrCreateConversation(...args),
  appendMessages: (...args: unknown[]) => mockAppendMessages(...args),
}));

vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing Authorization header' }, 401);
    }
    c.set('auth', { userId: 'athlete-1', email: 'athlete@example.com' });
    await next();
  }),
}));

let scriptedParts: any[] = [];
let capturedStreamTextArgs: any = null;

vi.mock('ai', () => ({
  streamText: vi.fn((args: any) => {
    capturedStreamTextArgs = args;
    return {
      fullStream: (async function* () {
        for (const part of scriptedParts) {
          yield part;
        }
      })(),
    };
  }),
  // Pass-throughs — identifiable markers only where the route asserts shape.
  tool: vi.fn((def: any) => def),
  jsonSchema: vi.fn((schema: any) => schema),
  stepCountIs: vi.fn((n: number) => ({ __marker: 'stepCountIs', n })),
  hasToolCall: vi.fn((name: string) => ({ __marker: 'hasToolCall', name })),
}));

// Never hit a real Supabase project from the onFinish token-cost logger.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// ─── Import after mocks are registered ────────────────────────────────────
import { onboardingRouter, buildOnboardingSystemPrompt } from '../../src/routes/onboarding.js';
import { ONBOARDING_MAX_STEPS } from '../../src/config/models.js';

function makeRequest(opts: {
  authHeader?: string | null;
  body?: Record<string, unknown>;
} = {}) {
  const { authHeader = 'Bearer test-jwt-token', body = {} } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== null) headers.Authorization = authHeader;

  return onboardingRouter.request('/onboarding/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const OWNED_ZIKO_CONVO = {
  conversationId: 'convo-owned',
  history: [],
  pluginContext: { type: 'ziko_onboarding', locale: 'fr' },
  userId: 'athlete-1',
};

describe('POST /ai/onboarding/stream', () => {
  beforeEach(() => {
    mockGetOrCreateConversation.mockReset();
    mockAppendMessages.mockReset();
    scriptedParts = [];
    capturedStreamTextArgs = null;
  });

  // ── Credit exemption ─────────────────────────────────────────────────
  it('does not reject a zero-credit user with 402 — no credit middleware is mounted', async () => {
    mockGetOrCreateConversation.mockResolvedValue(OWNED_ZIKO_CONVO);
    scriptedParts = []; // stream ends immediately with no tool-result → cap_reached path

    const res = await makeRequest({ body: { messages: [{ role: 'user', content: 'salut' }] } });

    expect(res.status).not.toBe(402);
    const text = await res.text();
    expect(text).not.toContain('insufficient_credits');
  });

  // ── Auth gate ─────────────────────────────────────────────────────────
  it('rejects a request with no Authorization header before reaching the model', async () => {
    const res = await makeRequest({ authHeader: null });

    expect([401, 403]).toContain(res.status);
    const json = await res.json();
    expect(json).toHaveProperty('error');
    expect(capturedStreamTextArgs).toBeNull();
    expect(mockGetOrCreateConversation).not.toHaveBeenCalled();
  });

  // ── Ownership + tag gate ─────────────────────────────────────────────
  it('returns 403 conversation_forbidden when the conversation user_id differs from the authenticated user', async () => {
    mockGetOrCreateConversation.mockResolvedValue({
      conversationId: 'convo-foreign',
      history: [],
      pluginContext: { type: 'ziko_onboarding', locale: 'fr' },
      userId: 'someone-else',
    });

    const res = await makeRequest({ body: { conversation_id: 'convo-foreign' } });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('conversation_forbidden');
    expect(capturedStreamTextArgs).toBeNull();
  });

  it('returns 403 conversation_forbidden when the conversation plugin_context.type is not ziko_onboarding', async () => {
    mockGetOrCreateConversation.mockResolvedValue({
      conversationId: 'convo-wrong-tag',
      history: [],
      pluginContext: { type: 'general_chat' },
      userId: 'athlete-1',
    });

    const res = await makeRequest({ body: { conversation_id: 'convo-wrong-tag' } });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('conversation_forbidden');
    expect(capturedStreamTextArgs).toBeNull();
  });

  it('allows a request with a conversation_id that is owned and correctly tagged', async () => {
    mockGetOrCreateConversation.mockResolvedValue({
      ...OWNED_ZIKO_CONVO,
      conversationId: 'convo-owned-2',
    });
    scriptedParts = [];

    const res = await makeRequest({ body: { conversation_id: 'convo-owned-2' } });

    expect(res.status).not.toBe(403);
    expect(capturedStreamTextArgs).not.toBeNull();
  });

  // ── Narrowed tool surface + stopWhen ─────────────────────────────────
  it('hands streamText a tools object with exactly the key set [assess_profile]', async () => {
    mockGetOrCreateConversation.mockResolvedValue(OWNED_ZIKO_CONVO);
    scriptedParts = [];

    await makeRequest({ body: { messages: [{ role: 'user', content: 'salut' }] } });

    expect(capturedStreamTextArgs).not.toBeNull();
    expect(Object.keys(capturedStreamTextArgs.tools)).toEqual(['assess_profile']);
  });

  it('builds stopWhen as an array of [stepCountIs(ONBOARDING_MAX_STEPS), hasToolCall(assess_profile)]', async () => {
    mockGetOrCreateConversation.mockResolvedValue(OWNED_ZIKO_CONVO);
    scriptedParts = [];

    await makeRequest({ body: {} });

    expect(Array.isArray(capturedStreamTextArgs.stopWhen)).toBe(true);
    expect(capturedStreamTextArgs.stopWhen).toEqual([
      { __marker: 'stepCountIs', n: ONBOARDING_MAX_STEPS },
      { __marker: 'hasToolCall', name: 'assess_profile' },
    ]);
  });

  // ── System prompt contract ───────────────────────────────────────────
  it('buildOnboardingSystemPrompt("en") instructs English and names all three signal categories, forbidding emoji', () => {
    const prompt = buildOnboardingSystemPrompt('en');
    expect(prompt).toContain('English');
    expect(prompt).toMatch(/experience level/i);
    expect(prompt).toMatch(/confidence/i);
    expect(prompt).toMatch(/adherence risk/i);
    expect(prompt).toMatch(/emoji/i);
  });

  it('buildOnboardingSystemPrompt("fr") instructs French and names all three signal categories, forbidding emoji', () => {
    const prompt = buildOnboardingSystemPrompt('fr');
    expect(prompt).toContain('French');
    expect(prompt).toMatch(/experience level/i);
    expect(prompt).toMatch(/confidence/i);
    expect(prompt).toMatch(/adherence risk/i);
    expect(prompt).toMatch(/emoji/i);
  });

  // ── SSE mission / cap_reached events ─────────────────────────────────
  it('emits a mission SSE event carrying micro_action and mission_title on a successful assess_profile tool-result', async () => {
    mockGetOrCreateConversation.mockResolvedValue(OWNED_ZIKO_CONVO);
    scriptedParts = [
      {
        type: 'tool-result',
        toolName: 'assess_profile',
        output: {
          success: true,
          decision_id: 'decision-1',
          micro_action: 'hydration_log',
          mission_title: 'Bois un verre d\'eau',
        },
      },
    ];

    const res = await makeRequest({ body: { messages: [{ role: 'user', content: 'salut' }] } });
    const text = await res.text();

    expect(text).toContain('"type":"mission"');
    expect(text).toContain('"micro_action":"hydration_log"');
    expect(text).toContain('"mission_title":"Bois un verre d\'eau"');
    expect(text).not.toContain('"type":"cap_reached"');
  });

  it('emits an error SSE event (never a mission) when assess_profile resolves a failure shape', async () => {
    mockGetOrCreateConversation.mockResolvedValue(OWNED_ZIKO_CONVO);
    scriptedParts = [
      {
        type: 'tool-result',
        toolName: 'assess_profile',
        output: { success: false, error: 'evidence_required' },
      },
    ];

    const res = await makeRequest({ body: {} });
    const text = await res.text();

    expect(text).toContain('"type":"error"');
    expect(text).toContain('evidence_required');
    expect(text).not.toContain('"type":"mission"');
    expect(text).not.toContain('"type":"cap_reached"');
  });

  it('emits a cap_reached SSE event when the stream ends with no assess_profile tool-result', async () => {
    mockGetOrCreateConversation.mockResolvedValue(OWNED_ZIKO_CONVO);
    scriptedParts = [{ type: 'text-delta', textDelta: 'Salut, prêt à commencer ?' }];

    const res = await makeRequest({ body: { messages: [{ role: 'user', content: 'salut' }] } });
    const text = await res.text();

    expect(text).toContain('"type":"chunk"');
    expect(text).toContain('"type":"cap_reached"');
    expect(text).not.toContain('"type":"mission"');
  });

  it('emits meta with the conversation id first and terminates with [DONE]', async () => {
    mockGetOrCreateConversation.mockResolvedValue(OWNED_ZIKO_CONVO);
    scriptedParts = [];

    const res = await makeRequest({ body: {} });
    const text = await res.text();

    const lines = text.split('\n\n').filter((l) => l.startsWith('data: '));
    expect(lines[0]).toContain('"type":"meta"');
    expect(lines[0]).toContain(OWNED_ZIKO_CONVO.conversationId);
    expect(text.trim().endsWith('data: [DONE]')).toBe(true);
  });
});
