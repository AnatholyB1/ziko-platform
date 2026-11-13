/**
 * Audit securite v1.20 (constat 6) - POST /ai/tools/execute.
 * Prouve : auth obligatoire (401) ; un outil sans LLM s'execute sans creditCheck ; les outils LLM
 * (ai_programs_generate / ai_programs_adjust) passent par creditCheck('program') + creditDeduct('program') et un
 * limiteur dedie, l'executeur n'est PAS appele quand le credit est refuse (402) ou le debit depasse (429) ; le message
 * d'erreur interne n'est jamais renvoye au client ; les outils internes restent introuvables.
 * Ne prouve PAS : le vrai creditCheck (voir creditGate.test.ts), Redis, ni le modele.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const h = vi.hoisted(() => ({
  executor: vi.fn(),
  creditCheckSpy: vi.fn(),
  creditDeductSpy: vi.fn(),
  creditResult: { block: false },
  limiterBlocked: { all: false, llm: false },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn(async (t: string) => (t === 'tok' ? { data: { user: { id: 'user-1', email: 'u@example.com' } }, error: null } : { data: { user: null }, error: { message: 'bad' } })) },
  })),
}));
vi.mock('../middleware/creditGate.js', () => ({
  creditCheck: (action: string) => async (c: any, next: () => Promise<void>) => {
    h.creditCheckSpy(action);
    if (h.creditResult.block) return c.json({ error: 'insufficient_credits' }, 402);
    return next();
  },
  creditDeduct: (action: string) => async (_c: unknown, next: () => Promise<void>) => { h.creditDeductSpy(action); return next(); },
}));
vi.mock('../middleware/userRateLimit.js', () => ({
  userRateLimit: (_max: number, _w: string, prefix: string) => async (c: any, next: () => Promise<void>) => {
    const blocked = prefix === 'ai-tools-execute-llm' ? h.limiterBlocked.llm : h.limiterBlocked.all;
    if (blocked) return c.json({ error: 'Rate limit exceeded' }, 429);
    return next();
  },
}));
vi.mock('../tools/registry.js', () => ({
  allToolSchemas: [],
  INTERNAL_ONLY_TOOLS: new Set(['assess_profile']),
  getToolExecutor: (name: string) => (name === 'nope' ? undefined : h.executor),
}));
vi.mock('../context/user.js', () => ({ fetchUserContext: vi.fn(), buildAthleteStateSection: vi.fn() }));
vi.mock('../context/conversation.js', () => ({ getOrCreateConversation: vi.fn(), appendMessages: vi.fn(), updateConversationTitle: vi.fn() }));

import { aiRouter } from './ai.js';

const app = () => { const a = new Hono(); a.route('/ai', aiRouter); return a; };
const exec = (body: unknown, token: string | null = 'tok') =>
  app().request('/ai/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.creditResult.block = false;
  h.limiterBlocked.all = false;
  h.limiterBlocked.llm = false;
  h.executor.mockResolvedValue({ ok: true });
});

describe('POST /ai/tools/execute', () => {
  it('sans jeton valide : 401, executeur non appele', async () => {
    expect((await exec({ tool_name: 'habits_get' }, null)).status).toBe(401);
    expect((await exec({ tool_name: 'habits_get' }, 'nope')).status).toBe(401);
    expect(h.executor).not.toHaveBeenCalled();
  });

  it('outil sans LLM : execute, aucun creditCheck', async () => {
    const res = await exec({ tool_name: 'habits_get', parameters: { a: 1 } });
    expect(res.status).toBe(200);
    expect(h.executor).toHaveBeenCalledWith({ a: 1 }, 'user-1', 'tok');
    expect(h.creditCheckSpy).not.toHaveBeenCalled();
  });

  it.each(['ai_programs_generate', 'ai_programs_adjust'])('outil LLM %s : creditCheck + creditDeduct sur program', async (tool_name) => {
    const res = await exec({ tool_name, parameters: {} });
    expect(res.status).toBe(200);
    expect(h.creditCheckSpy).toHaveBeenCalledWith('program');
    expect(h.creditDeductSpy).toHaveBeenCalledWith('program');
    expect(h.executor).toHaveBeenCalledTimes(1);
  });

  it('outil LLM sans credit : 402, executeur (donc le LLM) non appele', async () => {
    h.creditResult.block = true;
    const res = await exec({ tool_name: 'ai_programs_generate' });
    expect(res.status).toBe(402);
    expect(h.executor).not.toHaveBeenCalled();
    expect(h.creditDeductSpy).not.toHaveBeenCalled();
  });

  it('outil LLM au-dela du debit dedie : 429 avant tout credit ou appel', async () => {
    h.limiterBlocked.llm = true;
    const res = await exec({ tool_name: 'ai_programs_adjust' });
    expect(res.status).toBe(429);
    expect(h.creditCheckSpy).not.toHaveBeenCalled();
    expect(h.executor).not.toHaveBeenCalled();
  });

  it('limiteur global par utilisateur : 429 pour tout outil', async () => {
    h.limiterBlocked.all = true;
    const res = await exec({ tool_name: 'habits_get' });
    expect(res.status).toBe(429);
    expect(h.executor).not.toHaveBeenCalled();
  });

  it('le limiteur dedie ne touche pas les outils sans LLM', async () => {
    h.limiterBlocked.llm = true;
    expect((await exec({ tool_name: 'habits_get' })).status).toBe(200);
  });

  it("erreur d'executeur : message generique, detail interne jamais renvoye", async () => {
    h.executor.mockRejectedValue(new Error('duplicate key value violates unique constraint "secret_idx"'));
    const res = await exec({ tool_name: 'habits_get' });
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).toContain('Tool execution failed');
    expect(text).not.toContain('secret_idx');
  });

  it('outil interne ou inconnu : 404, rien execute ; tool_name manquant : 400', async () => {
    expect((await exec({ tool_name: 'assess_profile' })).status).toBe(404);
    expect((await exec({ tool_name: 'nope' })).status).toBe(404);
    expect((await exec({})).status).toBe(400);
    expect(h.executor).not.toHaveBeenCalled();
  });
});
