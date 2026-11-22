import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { streamText, stepCountIs } from 'ai';
import { authMiddleware } from '../middleware/auth.js';
import { creditCheck, creditDeduct } from '../middleware/creditGate.js';
import { userRateLimit } from '../middleware/userRateLimit.js';
import { CREDIT_COSTS } from '../config/credits.js';
import { AGENT_MODEL } from '../config/models.js';
import { clientForUser } from '../tools/db.js';
import { getOrCreateConversation, appendMessages, updateConversationTitle } from '../context/conversation.js';
import * as creditService from '../services/creditService.js';
import { logTokenUsageRow } from '../workshop/usage.js';
import { fetchWorkshopContext, contextCounts, type WorkshopContext } from '../workshop/context.js';
import { applyOps, DraftError, type DraftOp } from '../workshop/draft.js';
import { createDraft, loadDraft, saveDraftProgram, publishDraft, type DraftRecord } from '../workshop/store.js';
import { createWorkshopTools, toolLabel } from '../workshop/tools.js';
import { buildWorkshopSystemPrompt } from '../workshop/prompt.js';
import { WORKSHOP_MAX_MESSAGE_CHARS, WORKSHOP_MAX_STEPS } from '../workshop/limits.js';
import { runRelaunchCheck, runRelaunchPropose, dismissRelaunch, previousResultsBlock, getOpenRelaunch } from '../periodization/relaunch.js';
import { loadCurrentSequence } from '../periodization/store.js';

// ============================================================
// Phase 23 (v1.20) - Atelier IA de creation de programme (ATEL-01..06, ATEL-10)
//
//   GET   /ai/workshop/info               cout reel, solde, contexte connu (A11)
//   POST  /ai/workshop/stream             tour de conversation (SSE) - creditCheck/creditDeduct('chat')
//   GET   /ai/workshop/drafts/:id         brouillon + historique
//   PATCH /ai/workshop/drafts/:id         edition manuelle (AUCUN credit, A-6)
//   POST  /ai/workshop/drafts/:id/publish enregistre (ligne INACTIVE, l'activation = RPC de P7)
// ============================================================

export const workshopRouter = new Hono();
workshopRouter.use('*', authMiddleware);

const bearer = (c: any): string | undefined => c.req.header('Authorization')?.slice(7);

const draftPayload = (d: DraftRecord) => ({
  id: d.id,
  conversation_id: d.conversation_id,
  revision: d.revision,
  status: d.status,
  saved_program_id: d.saved_program_id,
  program: d.program,
});

// ── GET /info ────────────────────────────────────────────────────────
workshopRouter.get('/info', async (c) => {
  const userId = c.get('auth').userId;
  const db = clientForUser(bearer(c));
  const [ctx, quota, latest] = await Promise.all([
    fetchWorkshopContext(db, userId),
    creditService.getQuotaStatus(userId, 'chat').catch(() => null),
    db
      .from('ziko_workshop_drafts')
      .select('id, name, revision, updated_at')
      .eq('user_id', userId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1),
  ]);
  const latestRow = Array.isArray((latest as any)?.data) ? (latest as any).data[0] : null;
  return c.json({
    // D-08 : cout REEL lu dans la config (jamais "1 credit" en dur)
    cost: CREDIT_COSTS.chat,
    balance: quota?.balance ?? null,
    free_left: quota ? Math.max(0, quota.dailyQuota - quota.dailyUsed) : null,
    within_free_quota: quota?.withinFreeQuota ?? null,
    context: contextCounts(ctx),
    latest_draft: latestRow ?? null,
  });
});

// ── GET /drafts/:id ──────────────────────────────────────────────────
workshopRouter.get('/drafts/:id', async (c) => {
  const userId = c.get('auth').userId;
  const db = clientForUser(bearer(c));
  const draft = await loadDraft(db, userId, c.req.param('id'));
  if (!draft) return c.json({ error: 'not_found' }, 404);
  let messages: Array<{ role: string; content: string }> = [];
  if (draft.conversation_id) {
    const { data } = await db
      .from('ziko_ai_messages')
      .select('role, content')
      .eq('conversation_id', draft.conversation_id)
      .order('created_at', { ascending: true })
      .limit(200);
    messages = (data ?? []) as any[];
  }
  return c.json({ draft: draftPayload(draft), messages });
});

// ── PATCH /drafts/:id (edition manuelle, zero credit) ────────────────
workshopRouter.patch('/drafts/:id', async (c) => {
  const userId = c.get('auth').userId;
  const db = clientForUser(bearer(c));
  const body = await c.req.json<{ expected_revision?: number; ops?: DraftOp[] }>().catch(() => ({} as any));
  if (typeof body.expected_revision !== 'number') return c.json({ error: 'expected_revision_required' }, 400);
  const draft = await loadDraft(db, userId, c.req.param('id'));
  if (!draft) return c.json({ error: 'not_found' }, 404);
  if (draft.status === 'saved') return c.json({ error: 'already_saved' }, 409);
  if (!draft.program) return c.json({ error: 'empty_draft' }, 409);
  if (draft.revision !== body.expected_revision) return c.json({ error: 'conflict', draft: draftPayload(draft) }, 409);
  const ops = ((body.ops ?? []) as DraftOp[]).filter((o: DraftOp) => o && o.op !== 'set_program'); // manual edits never replace the whole program
  let next;
  try {
    next = applyOps(draft.program, ops);
  } catch (e) {
    return c.json({ error: 'invalid_edit', message: e instanceof DraftError ? e.message : 'invalid' }, 422);
  }
  const res = await saveDraftProgram(db, userId, draft.id, next, draft.revision);
  if (!res.ok) {
    const cur = await loadDraft(db, userId, draft.id);
    return c.json({ error: res.reason, draft: cur ? draftPayload(cur) : null }, 409);
  }
  return c.json({ draft: draftPayload(res.draft) });
});

// ── POST /drafts/:id/publish ─────────────────────────────────────────
workshopRouter.post('/drafts/:id/publish', async (c) => {
  const userId = c.get('auth').userId;
  const db = clientForUser(bearer(c));
  const draft = await loadDraft(db, userId, c.req.param('id'));
  if (!draft) return c.json({ error: 'not_found' }, 404);
  const res = await publishDraft(db, userId, draft);
  if ('error' in res) return c.json({ error: res.error }, res.error === 'empty_draft' ? 409 : 500);
  return c.json({ program_id: res.programId });
});

// ── P24 : periodisation et relance automatique (ATEL-07/08/09) ───────
// Aucun creditCheck/creditDeduct ici : appels automatiques ABSORBES (plafond journalier, ziko_ai_cost_log).

// GET /sequence : suite ordonnee courante + relance ouverte
workshopRouter.get('/sequence', async (c) => {
  const userId = c.get('auth').userId;
  const db = clientForUser(bearer(c));
  const [seq, relaunch] = await Promise.all([loadCurrentSequence(db, userId), getOpenRelaunch(db, userId)]);
  return c.json({ sequence: seq.sequence, items: seq.items, relaunch });
});

// POST /relaunch/check : detection de fin de programme (sans IA), idempotent
// Anti-spam (audit securite v1.20) : 10 appels / minute / utilisateur sur check + propose (plafonds en base inchanges).
const relaunchLimiter = userRateLimit(10, '1 m', 'workshop-relaunch');
workshopRouter.post('/relaunch/check', relaunchLimiter, async (c) => {
  const userId = c.get('auth').userId;
  const userToken = bearer(c);
  const db = clientForUser(userToken);
  try {
    const out = await runRelaunchCheck({
      db,
      userId,
      createConversation: async () => (await getOrCreateConversation(userId, undefined, userToken, { source: 'workshop' })).conversationId,
    });
    const seq = await loadCurrentSequence(db, userId);
    return c.json({ ...out, has_sequence: seq.items.length > 0 });
  } catch (err) {
    console.error('[workshop relaunch check] failed:', err instanceof Error ? err.message : err);
    return c.json({ error: 'relaunch_check_failed' }, 500);
  }
});

// POST /relaunch/:id/propose : UN appel IA automatique (absorbe, plafonne), idempotent
workshopRouter.post('/relaunch/:id/propose', relaunchLimiter, async (c) => {
  const userId = c.get('auth').userId;
  const userToken = bearer(c);
  const db = clientForUser(userToken);
  const out = await runRelaunchPropose({
    db,
    userId,
    relaunchId: c.req.param('id') ?? '',
    appendMessages: (conversationId, msgs) => appendMessages(conversationId, msgs, userToken),
  });
  if (out.status === 'not_found') return c.json({ error: 'not_found' }, 404);
  if (out.status === 'dismissed') return c.json({ error: 'dismissed' }, 409);
  return c.json(out);
});

// POST /relaunch/:id/dismiss : l'utilisateur ignore la relance (aucune consequence)
workshopRouter.post('/relaunch/:id/dismiss', async (c) => {
  const userId = c.get('auth').userId;
  const db = clientForUser(bearer(c));
  const ok = await dismissRelaunch(db, userId, c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
});

// ── POST /stream ─────────────────────────────────────────────────────
workshopRouter.post('/stream', creditCheck('chat'), creditDeduct('chat'), async (c) => {
  const userId = c.get('auth').userId;
  const userToken = bearer(c);
  const body = await c.req.json<{ message?: string; draft_id?: string }>().catch(() => ({} as any));
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return c.json({ error: 'message_required' }, 400);
  if (message.length > WORKSHOP_MAX_MESSAGE_CHARS) return c.json({ error: 'message_too_long' }, 413);

  const db = clientForUser(userToken);

  // Draft + conversation (created together on the first message)
  let draft: DraftRecord | null = null;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let conversationId: string;
  try {
    if (body.draft_id) {
      draft = await loadDraft(db, userId, body.draft_id);
      if (!draft) return c.json({ error: 'not_found' }, 404);
      if (draft.status === 'saved') return c.json({ error: 'already_saved' }, 409);
    }
    const convo = await getOrCreateConversation(
      userId,
      draft?.conversation_id ?? undefined,
      userToken,
      { source: 'workshop' },
    );
    if (convo.userId !== userId) return c.json({ error: 'not_found' }, 404);
    conversationId = convo.conversationId;
    history = convo.history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    if (!draft) draft = await createDraft(db, userId, conversationId);
    if (history.length === 0) updateConversationTitle(conversationId, message, userToken);
  } catch (err) {
    console.error('[workshop] setup failed:', err instanceof Error ? err.message : err);
    return c.json({ error: 'setup_failed' }, 500);
  }

  const draftId = draft.id;
  let ctxCache: WorkshopContext | null = null;
  const getContext = async () => (ctxCache ??= await fetchWorkshopContext(db, userId));
  const ctx = await getContext();

  const pendingDrafts: DraftRecord[] = [];
  const tools = createWorkshopTools({
    db,
    userId,
    draftId,
    getContext,
    emitDraft: (d) => pendingDrafts.push(d),
  });

  const result = streamText({
    model: AGENT_MODEL,
    system: [buildWorkshopSystemPrompt(ctx, draft.program), await previousResultsBlock(db, userId, draft)].filter(Boolean).join('\n\n'),
    messages: [...history, { role: 'user', content: message }],
    tools,
    stopWhen: stepCountIs(WORKSHOP_MAX_STEPS),
    onFinish: ({ totalUsage }) => logTokenUsageRow(db, userId, 'claude-sonnet-5-5', totalUsage),
  });

  // A14 : on ne s'engage en 200 (donc en debit) qu'apres le premier signal utile du modele. Une panne
  // avant cela repond 502 : creditDeduct ne voit qu'un statut >= 400 et ne debite rien.
  const iterator = result.fullStream[Symbol.asyncIterator]();
  const buffered: any[] = [];
  try {
    for (;;) {
      const { value, done } = await iterator.next();
      if (done) break;
      buffered.push(value);
      if (value.type === 'error') {
        const e = (value as any).error;
        console.error('[workshop] model error before first output:', e instanceof Error ? e.message : e);
        return c.json({ error: 'ai_unavailable' }, 502);
      }
      if (['text-delta', 'tool-call', 'tool-input-start', 'finish'].includes(value.type)) break;
    }
  } catch (e) {
    console.error('[workshop] stream start failed:', e instanceof Error ? e.message : e);
    return c.json({ error: 'ai_unavailable' }, 502);
  }

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const send = (o: unknown) => s.write(`data: ${JSON.stringify(o)}\n\n`);
    const chunks: string[] = [];
    const flushDrafts = async () => {
      while (pendingDrafts.length > 0) {
        const d = pendingDrafts.shift()!;
        await send({ type: 'draft', revision: d.revision, program: d.program });
      }
    };
    const handle = async (part: any) => {
      if (part.type === 'text-delta') {
        const text = part.textDelta ?? part.text ?? '';
        if (text && !text.includes('<invoke') && !text.includes('</invoke>') && !text.includes('<parameter')) {
          chunks.push(text);
          await send({ type: 'chunk', content: text });
        }
      } else if (part.type === 'tool-call') {
        await send({ type: 'tool', id: part.toolCallId, name: part.toolName, state: 'start', label: toolLabel(part.toolName, part.input ?? part.args) });
      } else if (part.type === 'tool-result') {
        const out = part.output ?? part.result;
        const failed = out && typeof out === 'object' && (out as any).ok === false;
        await send({ type: 'tool', id: part.toolCallId, name: part.toolName, state: failed ? 'error' : 'done', label: toolLabel(part.toolName, part.input ?? part.args) });
        await flushDrafts();
      } else if (part.type === 'tool-error') {
        console.error(`[workshop tool error] ${part.toolName}:`, part.error instanceof Error ? part.error.message : part.error);
        await send({ type: 'tool', id: part.toolCallId, name: part.toolName, state: 'error', label: toolLabel(part.toolName) });
      } else if (part.type === 'error') {
        throw part.error instanceof Error ? part.error : new Error('Stream error');
      }
    };

    try {
      await send({ type: 'meta', draft_id: draftId, conversation_id: conversationId, cost: CREDIT_COSTS.chat });
      for (const p of buffered) await handle(p);
      for (;;) {
        const { value, done } = await iterator.next();
        if (done) break;
        await handle(value);
      }
      await flushDrafts();
      await send({ type: 'done' });
      await s.write('data: [DONE]\n\n');
    } catch (err) {
      console.error('[workshop stream error]', err instanceof Error ? err.message : err);
      await send({ type: 'error', error: 'stream_interrupted' });
      await s.write('data: [DONE]\n\n');
    }

    const toSave: Array<{ role: 'user' | 'assistant'; content: string }> = [{ role: 'user', content: message }];
    const full = chunks.join('');
    if (full) toSave.push({ role: 'assistant', content: full });
    await appendMessages(conversationId, toSave, userToken);
  });
});
