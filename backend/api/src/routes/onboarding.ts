import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { streamText, tool, jsonSchema, stepCountIs, hasToolCall } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';
import { getOrCreateConversation, appendMessages } from '../context/conversation.js';
import { AGENT_MODEL, ONBOARDING_MAX_STEPS } from '../config/models.js';
import { assessProfileSchema, assess_profile } from '../tools/onboarding.js';
import { computeRetroactiveProfile } from '../tools/onboarding-retroactive.js';
import { logAutonomousCost, SOURCES } from '../lib/autonomousCost.js';
import { createGoal } from '../measurements/service.js';

// ============================================================
// Phase 43 plan 03 — POST /ai/onboarding/stream (ONBOARD-01, ONBOARD-02,
// ONBOARD-03)
//
// This is the only server surface Ziko's mascot chat screen talks to. It is
// a mandatory, no-skip system flow, so — deliberately and unlike every other
// /ai/* route — it does NOT mount the credit-gating middleware pair applied
// to /chat/stream. A brand-new athlete has a zero AI-spend balance against a
// non-zero per-message cost, and this route cannot legally strand exactly
// the population it exists to serve (43-RESEARCH.md Pitfall 2). This
// omission is load-bearing, not an oversight — do not "fix" it by copying
// the gating pair from routes/ai.ts.
// ============================================================

// 4 planned questions + the synthetic/opening turn + margin.
const ONBOARDING_MAX_USER_TURNS = 6;

const onboardingRouter = new Hono();
onboardingRouter.use('*', authMiddleware);

// ─── Supabase client (token-usage logging only) ─────────────────────
// Same pattern as routes/ai.ts — service key for server-side inserts to
// ai_cost_log, so this uncredited route's spend stays cost-attributable.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── System prompt ────────────────────────────────────────────────

/**
 * Fixed English instruction block — the model's OUTPUT language is
 * instructed (D-11), not the prompt itself. Ziko is a fixed identity kept
 * deliberately separate from the persona plugin's customizable coach (D-08);
 * tone follows D-06 (playful but restrained, tutoiement, no emoji, no
 * slang); the three required signal categories follow D-10; the curated
 * micro-action pool follows D-13.
 */
export function buildOnboardingSystemPrompt(locale: 'fr' | 'en'): string {
  const languageName = locale === 'en' ? 'English' : 'French';

  return `You are Ziko, a fixed onboarding mascot for the Ziko fitness app. This is a one-time, mandatory conversation that runs right after the athlete's structured signup steps and before they see the home screen for the first time.

## Identity
Ziko is a fixed identity, deliberately separate from the athlete's later customizable AI coach persona (the persona plugin). You are always "Ziko" for this onboarding conversation, regardless of any name or personality the athlete configures for their ongoing coach afterward. Never reference, read, or assume any persona-plugin state — you have no visibility into it.

## Voice
Playful but restrained. Speak directly to the athlete in the informal second person (tutoiement when writing in French). Energetic and warm word choice. Never use emoji. Never use slang or argot — stay closer to the app's warm-but-clean copy voice than to a cartoonish chatbot register.

## Language
Write every athlete-facing message in ${languageName} only, for this entire conversation, regardless of what language the athlete's own answers use.

## What you must learn (at most 4 questions, one question per turn — never a multi-question wall)
Across your questions you must gather clear signal on exactly these three categories:
1. Experience level — how much real training history the athlete has.
2. Self-reported confidence — how sure you are in your experience-level read, based on how clear or vague the athlete's answer was.
3. Adherence risk and constraints — what could make this athlete drop off (time, past injuries, motivation blockers, schedule, etc.).
The exact wording of each question, and how you sequence them from one turn to the next adapting to the athlete's prior answer, is entirely your discretion. The three categories above are not optional and are not negotiable.

## Measurement goals (v1.20, before the terminal action)
After the three categories above are clear, help the athlete set 1 or 2 body-measurement goals in this same conversation. Ask what they want to change (weight, waist, arms, chest, thighs, hips, body fat %), their current value and the value they aim for, and optionally a target date. Propose a realistic target, wait for the athlete to agree, then call set_measure_goal once per agreed goal (measure_key + target_value, plus start_value only if the athlete gave their current value). Never invent a number the athlete did not give or accept. If the athlete does not want a measurement goal, skip this step. These goals are fixed once created and the athlete cannot edit them later: say so in one short sentence. This step does not count toward the 4 questions limit of the signal categories but keep it to at most 3 more turns.

## Terminal action
Once — and only once — you have enough signal across all three categories, call the assess_profile tool exactly one time. Never call it before that point. After the tool call, write one short closing message in Ziko's voice that introduces the athlete's first mission. Do not ask any further questions after calling the tool.

## Micro-action constraint
When calling assess_profile, the micro_action field must be exactly one of: hydration_log, journal_mood, or measurements_weight — never anything else. Pick the one that best matches the athlete's inferred readiness: a fragile, uncertain beginner should get the smallest possible win (a glass of water), escalating to a more involved action only for an athlete who reads as more ready.

## Boundaries
Never promise, invent, or reference any app feature beyond that single micro-action. Stay entirely inside this onboarding conversation's scope.`;
}

// ─── Route ───────────────────────────────────────────────────────

interface OnboardingRequestBody {
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversation_id?: string;
  locale?: 'fr' | 'en';
}

onboardingRouter.post('/onboarding/stream', async (c) => {
  const body = await c.req.json<OnboardingRequestBody>();
  const messages = body.messages ?? [];
  const bodyConversationId = body.conversation_id;
  // D-11 / Pitfall 3: normalize to 'en' only on an exact match, 'fr' otherwise —
  // there is no per-athlete locale to look up server-side, so the client's
  // value is the only source of truth for a fresh conversation.
  const requestedLocale: 'fr' | 'en' = body.locale === 'en' ? 'en' : 'fr';

  const auth = c.get('auth');
  const userId = auth.userId;
  const userToken = c.req.header('Authorization')?.slice(7);
  const conversation_id = bodyConversationId ?? c.req.header('X-Conversation-Id') ?? undefined;

  const convo = await getOrCreateConversation(userId, conversation_id, userToken, {
    type: 'ziko_onboarding',
    locale: requestedLocale,
  });

  // T-43-10: ownership + tag gate — before any model call or message append.
  // Without this, an athlete could point the onboarding turn at another
  // athlete's conversation, or at their own general chat conversation.
  if (conversation_id) {
    if (convo.userId !== userId || convo.pluginContext?.type !== 'ziko_onboarding') {
      return c.json({ error: 'conversation_forbidden' }, 403);
    }
  }

  // The conversation record is the source of truth for locale once created,
  // so it cannot drift mid-conversation (43-RESEARCH.md Open Question 2).
  const storedLocale = convo.pluginContext?.locale;
  const effectiveLocale: 'fr' | 'en' =
    storedLocale === 'en' || storedLocale === 'fr' ? storedLocale : requestedLocale;

  const systemPrompt = buildOnboardingSystemPrompt(effectiveLocale);

  const allMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...convo.history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ...messages,
  ];

  // The opening turn sends no messages, and Ziko's own opening reply is
  // persisted without a preceding user row. Anthropic rejects an empty
  // conversation and one that starts with an assistant turn, so seed a
  // synthetic (never persisted) user kick-off message in both cases.
  if (allMessages.length === 0 || allMessages[0].role !== 'user') {
    allMessages.unshift({
      role: 'user',
      content:
        effectiveLocale === 'en'
          ? 'Hi Ziko, I just finished signing up. Start the conversation.'
          : "Salut Ziko, je viens de finir mon inscription. Lance la conversation.",
    });
  }

  const userTurnCount = allMessages.filter((m) => m.role === 'user').length;

  const userMsgs = messages.filter((m) => m.role === 'user');
  const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : undefined;

  // Narrowed, single-tool surface — never the general chat's full tool
  // registry. A wider surface would let the model burn steps on off-task
  // tools inside the tight ONBOARDING_MAX_STEPS budget.
  const tools = {
    set_measure_goal: tool({
      description:
        "Save ONE body-measurement goal the athlete explicitly agreed on. measure_key: weight_kg, waist_cm, arm_cm, chest_cm, thigh_cm, hip_cm or body_fat_pct. target_value in kg, cm or %. start_value only if the athlete stated their current value. target_date optional (YYYY-MM-DD, future).",
      inputSchema: jsonSchema<Record<string, unknown>>({
        type: 'object',
        properties: {
          measure_key: { type: 'string', enum: ['weight_kg', 'waist_cm', 'arm_cm', 'chest_cm', 'thigh_cm', 'hip_cm', 'body_fat_pct'] },
          target_value: { type: 'number' },
          start_value: { type: 'number' },
          target_date: { type: 'string' },
        },
        required: ['measure_key', 'target_value'],
      } as any),
      execute: async (input) => createGoal(userId, input as Record<string, unknown>),
    }),
    assess_profile: tool({
      description: assessProfileSchema.description,
      inputSchema: jsonSchema<Record<string, unknown>>(assessProfileSchema.parameters as any),
      execute: async (input) => assess_profile(input as Record<string, unknown>, userId, userToken),
    }),
  };

  const result = streamText({
    model: AGENT_MODEL,
    system: systemPrompt,
    messages: allMessages,
    tools,
    stopWhen: [stepCountIs(ONBOARDING_MAX_STEPS), hasToolCall('assess_profile')],
    onFinish: ({ totalUsage }) => {
      logAutonomousCost(supabase, {
        userId,
        model: 'claude-sonnet-4-20250514',
        usage: totalUsage,
        source: SOURCES.onboardingAssess,
      });
    },
  });

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    const chunks: string[] = [];
    // Tracks whether an assess_profile tool-result (success or failure
    // shape) was ever observed on this stream. If the turn ends without
    // one, the cap was hit before the terminal tool call happened — the
    // athlete answered questions but has no athlete_state row, and must
    // never be silently treated as onboarded.
    let assessProfileObserved = false;
    let streamErrored = false;

    try {
      // Send the conversation id first so the client can track/resume it.
      await s.write(
        `data: ${JSON.stringify({ type: 'meta', conversation_id: convo.conversationId })}\n\n`,
      );

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          const text = (part as any).textDelta ?? (part as any).text ?? '';
          // Filter out XML tool-call artifacts Claude sometimes emits after a tool-error
          if (text && !text.includes('<invoke') && !text.includes('</invoke>') && !text.includes('<parameter')) {
            chunks.push(text);
            await s.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
          }
        } else if (part.type === 'tool-result' && (part as any).toolName === 'set_measure_goal') {
          // MEAS-02 : la carte d'objectif n'apparait que pour une ecriture reussie en base.
          const out = ((part as any).output ?? (part as any).result) as
            | { success?: boolean; goal?: Record<string, unknown>; goal_id?: string }
            | undefined;
          if (out?.success === true && out.goal) {
            await s.write(`data: ${JSON.stringify({ type: 'goal', goal: { id: out.goal_id, ...out.goal } })}

`);
          }
        } else if (part.type === 'error') {
          // streamText surfaces provider failures as an `error` part rather
          // than throwing — never mistake that for "cap reached".
          streamErrored = true;
          console.error('[Onboarding Stream Error part]', (part as any).error);
          await s.write(
            `data: ${JSON.stringify({ type: 'error', error: 'model_error' })}\n\n`,
          );
        } else if (part.type === 'tool-result' && (part as any).toolName === 'assess_profile') {
          assessProfileObserved = true;
          const output = ((part as any).output ?? (part as any).result) as
            | { success: true; decision_id: string; micro_action: string; mission_title: string }
            | { success: false; error: string }
            | undefined;

          if (output?.success === true) {
            await s.write(
              `data: ${JSON.stringify({
                type: 'mission',
                mission: {
                  micro_action: output.micro_action,
                  mission_title: output.mission_title,
                  decision_id: output.decision_id,
                },
              })}\n\n`,
            );
          } else {
            // A failed state write must never look like a completed onboarding.
            const errorMsg = (output as { error?: string } | undefined)?.error ?? 'assess_profile_failed';
            await s.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
          }
        }
      }

      // A turn that ends in a plain question is the normal case. Only flag
      // cap_reached once the athlete has answered more than the 4 planned
      // questions (plus margin) without the model concluding.
      if (!assessProfileObserved && !streamErrored && userTurnCount > ONBOARDING_MAX_USER_TURNS) {
        await s.write('data: {"type":"cap_reached"}\n\n');
      }

      await s.write('data: [DONE]\n\n');
    } catch (err: unknown) {
      streamErrored = true;
      const msg = err instanceof Error ? err.message : 'Stream error';
      console.error('[Onboarding Stream Error]', err);
      await s.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
      await s.write('data: [DONE]\n\n');
    }

    // Persistence tail — this is what makes D-04's mid-flow resume work
    // after an app kill.
    // A failed turn is not persisted: the client retries the same payload,
    // and saving it would duplicate the user message in history.
    if (streamErrored) return;
    const toSave: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (lastUserMsg) toSave.push({ role: 'user', content: lastUserMsg.content });
    const fullResponse = chunks.join('');
    if (fullResponse) toSave.push({ role: 'assistant', content: fullResponse });
    appendMessages(convo.conversationId, toSave, userToken);
  });
});

// ─── POST /onboarding/retroactive (ONBOARD-06, plan 43-04) ───────────────
// Fire-and-forget lazy trigger from apps/mobile/src/lib/onboardingRecompute.ts
// (authStore.refreshProfile() on app open). Deliberately carries no
// credit-gating middleware pair, same rationale as /onboarding/stream above:
// this is a system-initiated repair of a missing athlete_state row for a
// pre-v1.18 athlete, not discretionary athlete spend. userId is derived
// exclusively from c.get('auth'); the request body carries no user
// identifier and is never read here — an athlete may only ever trigger a
// recompute for themselves (T-43-16).
onboardingRouter.post('/onboarding/retroactive', async (c) => {
  const auth = c.get('auth');
  const userId = auth.userId;
  const userToken = c.req.header('Authorization')?.slice(7);

  try {
    const result = await computeRetroactiveProfile(userId, userToken);
    // Both skip shapes are a normal outcome, not an error — the
    // fire-and-forget mobile client must never see a 4xx for either one.
    return c.json(result, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Retroactive recompute failed';
    console.error('[Onboarding Retroactive Error]', err);
    return c.json({ error: msg }, 500);
  }
});

export { onboardingRouter };
