// Coach AI bounded module — public entry point (Phase 29).
// Exposes: POST /coach/ai/chat/stream, POST /coach/ai/monitor-cron,
//          PATCH /coach/ai/alerts/:id/read, POST /coach/ai/alerts/read-all.
// Mirrors the structure of backend/api/src/routes/ai.ts (exact SSE clone).
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { authMiddleware } from '../../middleware/auth.js';
import { creditCheck, creditDeduct } from '../../middleware/creditGate.js';
import { AGENT_MODEL } from '../../config/models.js';
import { fetchCoachContext } from './context.js';
import { coachToolSchemas, getCoachToolExecutor } from './tools.js';
import {
  getCoachAlerts,
  listCoachesForCron,
  insertAlerts,
  markAlertRead,
  markAllAlertsRead,
} from './db.js';
import { createUserClient } from '../clients/db.js';
import { appendMessages } from '../../context/conversation.js';
import type { CoachContext } from './types.js';
import { WeeklyDigest } from '@ziko/email/templates/WeeklyDigest';
import type { AlertClient } from '@ziko/email/templates/WeeklyDigest';

// ─── Service client for token logging ─────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Token usage logging (fire-and-forget) ────────────────────────────────────
function logTokenUsage(
  userId: string,
  modelId: string,
  totalUsage: { inputTokens: number | undefined; outputTokens: number | undefined },
) {
  Promise.resolve(
    supabase.from('ai_cost_log').insert({
      user_id: userId,
      model: modelId,
      input_tokens: totalUsage.inputTokens ?? 0,
      output_tokens: totalUsage.outputTokens ?? 0,
    }),
  ).catch((err: unknown) => console.error('[CoachTokenLog] insert failed:', err));
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const COACH_BASE_SYSTEM = `You are Ziko IA Coach, an expert AI assistant for fitness coaches.

## Role
You are the coach's intelligent partner. Your goal is to help coaches make data-driven decisions for their clients — by analyzing training data, generating personalized programs, and detecting early warning signs.

## Behaviour
- When a coach asks about a client, always call analyze_client first to get real data before answering.
- When generating a workout program, always call generate_coaching_program to create and assign it.
- When asked to check on all clients, call monitor_client_alerts to run detection across all linked clients.
- After executing tools, synthesise results into clear, actionable coaching recommendations.
- Be professional and precise. Use the client IDs listed below — do not invent client IDs.
- Always respond in the same language as the coach (French, English, etc.).

## Important
- Only call tools for clients explicitly listed in your linked clients below.
- analyze_client and generate_coaching_program require a valid client_id from your linked clients.
- monitor_client_alerts runs across all linked clients automatically.`;

function buildCoachSystemPrompt(ctx: CoachContext): string {
  const sections: string[] = [COACH_BASE_SYSTEM];

  if (ctx.profile?.display_name) {
    sections.push(`## Coach Profile\nName: ${ctx.profile.display_name}`);
  }

  if (ctx.clients.length > 0) {
    const clientList = ctx.clients
      .map((c) => `- ${c.name} (id: ${c.id})`)
      .join('\n');
    sections.push(`## Linked Clients\n${clientList}`);
  } else {
    sections.push('## Linked Clients\nNo linked clients yet. Ask the coach to invite clients first.');
  }

  return sections.join('\n\n');
}

// ─── SDK tools factory ─────────────────────────────────────────────────────────
// buildCoachSDKTools is called inside the route handler so jwt is captured in closure.
function buildCoachSDKTools(coachId: string, jwt: string) {
  return Object.fromEntries(
    coachToolSchemas.map((s) => [
      s.name,
      tool({
        description: s.description,
        inputSchema: jsonSchema<Record<string, unknown>>(s.parameters as any),
        execute: async (input) => {
          const executor = getCoachToolExecutor(s.name);
          if (!executor) throw new Error(`No executor for coach tool: ${s.name}`);
          console.log(`[CoachTool] ${s.name} coachId=${coachId}`);
          try {
            return await executor(input as Record<string, unknown>, coachId, jwt);
          } catch (execErr) {
            const msg = execErr instanceof Error ? execErr.message : String(execErr);
            console.error(`[CoachTool Error] ${s.name}: ${msg}`);
            throw execErr;
          }
        },
      }),
    ]),
  );
}

// ─── Weekly digest helpers ────────────────────────────────────────────────────

/** Returns a human-readable week range string, e.g. "19 au 25 mai 2026". */
function getWeekLabel(): string {
  const now = new Date();
  // Monday of this week
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon ...
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  const monDay = monday.getUTCDate();
  const sunDay = sunday.getUTCDate();
  const monMonth = months[monday.getUTCMonth()];
  const sunMonth = months[sunday.getUTCMonth()];
  const year = sunday.getUTCFullYear();

  if (monday.getUTCMonth() === sunday.getUTCMonth()) {
    return `${monDay} au ${sunDay} ${sunMonth} ${year}`;
  }
  return `${monDay} ${monMonth} au ${sunDay} ${sunMonth} ${year}`;
}

/**
 * Sends the weekly digest email for a single coach.
 * Skips silently (no throw) when RESEND_API_KEY is not configured.
 * T-29-17: Monday-only trigger enforced by caller; graceful skip here covers missing key.
 */
async function sendWeeklyDigest(params: {
  coachEmail: string;
  coachName: string;
  alertClients: AlertClient[];
  okClientNames: string[];
  dashboardUrl: string;
  weekLabel: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log('[WeeklyDigest] RESEND_API_KEY not set — skipping email for', params.coachEmail);
    return;
  }

  const { coachEmail, coachName, alertClients, okClientNames, dashboardUrl, weekLabel } = params;
  const alertCount = alertClients.length;

  const subject =
    alertCount > 0
      ? `Votre résumé hebdomadaire — ${alertCount} clients à surveiller`
      : 'Votre résumé hebdomadaire — Tous vos clients sont au top !';

  // Render React Email template to HTML string (T-29-18: requires jsx:react-jsx in tsconfig)
  const htmlBody = await render(
    WeeklyDigest({ coachName, weekLabel, alertClients, okClientNames, dashboardUrl }),
  );

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: 'Ziko Coach <coach@ziko-app.com>',
    to: coachEmail,
    subject,
    html: htmlBody,
  });

  if (error) {
    console.error('[WeeklyDigest] Resend error for', coachEmail, error);
  } else {
    console.log('[WeeklyDigest] Sent to', coachEmail, '—', subject);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = new Hono();

// monitor-cron MUST be defined BEFORE router.use('*', authMiddleware)
// because Vercel cron does not send a user JWT.
router.post('/monitor-cron', async (c) => {
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const coaches = await listCoachesForCron();
    let totalAlerts = 0;

    // Service-key iteration — no user JWT available in cron context.
    // Queries use service client; alert detection scopes to coach_id + client_id explicitly.
    for (const { coachId } of coaches) {
      try {
        // Cron has no user JWT — use service-key supabase client for all queries.
        // insertAlerts also uses service client internally.
        // Fetch linked clients and coach profile in parallel via service client
        const [{ data: links }, { data: coachProfile }] = await Promise.all([
          supabase
            .from('coach_client_links')
            .select('client_id')
            .eq('coach_id', coachId)
            .is('revoked_at', null),
          supabase
            .from('coach_profiles')
            .select('display_name')
            .eq('id', coachId)
            .single(),
        ]);
        const coachDisplayName = (coachProfile as any)?.display_name ?? 'Coach';

        const clientIds = (links ?? []).map((l: any) => l.client_id as string);
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

        const newAlerts: Parameters<typeof insertAlerts>[0] = [];

        for (const clientId of clientIds) {
          // Missed sessions
          const { data: recentSessions } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', clientId)
            .gte('created_at', sevenDaysAgo)
            .limit(1);

          if (!recentSessions || recentSessions.length === 0) {
            newAlerts.push({
              coach_id: coachId,
              client_id: clientId,
              alert_type: 'missed_sessions',
              severity: 'medium',
              summary: 'No workout sessions logged in the last 7 days. Consider reaching out.',
            });
          }

          // Sleep drop
          const [recentSleepRes, baselineSleepRes] = await Promise.all([
            supabase.from('sleep_logs').select('duration_hours').eq('user_id', clientId).gte('date', threeDaysAgo),
            supabase.from('sleep_logs').select('duration_hours').eq('user_id', clientId).gte('date', tenDaysAgo).lt('date', threeDaysAgo),
          ]);
          const recentSleep = (recentSleepRes.data ?? []).map((r: any) => Number(r.duration_hours));
          const baselineSleep = (baselineSleepRes.data ?? []).map((r: any) => Number(r.duration_hours));
          if (recentSleep.length >= 2 && baselineSleep.length >= 2) {
            const avgRecent = recentSleep.reduce((a: number, b: number) => a + b, 0) / recentSleep.length;
            const avgBaseline = baselineSleep.reduce((a: number, b: number) => a + b, 0) / baselineSleep.length;
            const drop = avgBaseline - avgRecent;
            if (drop > 1.0) {
              newAlerts.push({
                coach_id: coachId,
                client_id: clientId,
                alert_type: 'sleep_drop',
                severity: drop > 2 ? 'high' : 'medium',
                summary: `Sleep dropped by ${drop.toFixed(1)}h vs prior baseline.`,
              });
            }
          }

          // Mood decline
          const [recentMoodRes, baselineMoodRes] = await Promise.all([
            supabase.from('journal_entries').select('mood').eq('user_id', clientId).gte('created_at', sevenDaysAgo),
            supabase.from('journal_entries').select('mood').eq('user_id', clientId).gte('created_at', fourteenDaysAgo).lt('created_at', sevenDaysAgo),
          ]);
          const recentMood = (recentMoodRes.data ?? []).map((r: any) => Number(r.mood));
          const baselineMood = (baselineMoodRes.data ?? []).map((r: any) => Number(r.mood));
          if (recentMood.length >= 3 && baselineMood.length >= 3) {
            const avgRecentMood = recentMood.reduce((a: number, b: number) => a + b, 0) / recentMood.length;
            const avgBaselineMood = baselineMood.reduce((a: number, b: number) => a + b, 0) / baselineMood.length;
            const moodDrop = avgBaselineMood - avgRecentMood;
            if (moodDrop > 0.5) {
              newAlerts.push({
                coach_id: coachId,
                client_id: clientId,
                alert_type: 'mood_decline',
                severity: moodDrop > 1.5 ? 'high' : 'low',
                summary: `Mood declined by ${moodDrop.toFixed(1)} points over the past week.`,
              });
            }
          }
        }

        if (newAlerts.length > 0) {
          await insertAlerts(newAlerts);
          totalAlerts += newAlerts.length;
        }

        // Monday weekly digest path (D-09): check server-side day
        const isMonday = new Date().getUTCDay() === 1;
        if (isMonday) {
          try {
            // Fetch coach email from auth.users via service client
            // T-29-16: email sent only to the coach's own registered email — never to client
            const { data: userRow } = await supabase.auth.admin.getUserById(coachId);
            const coachEmail = userRow?.user?.email;
            if (!coachEmail) {
              console.warn(`[WeeklyDigest] No email found for coach ${coachId} — skipping`);
            } else {
              // Fetch week's alerts for this coach from coach_alerts (created this week)
              const weekStart = new Date();
              weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() + 1); // Monday
              weekStart.setUTCHours(0, 0, 0, 0);

              const { data: weekAlerts } = await supabase
                .from('coach_alerts')
                .select('client_id, severity, summary')
                .eq('coach_id', coachId)
                .gte('created_at', weekStart.toISOString());

              // Build alertClients list — map client_id to name if possible
              const alertClientsForEmail: AlertClient[] = [];
              const clientIdToName: Record<string, string> = {};
              for (const link of (links ?? [])) {
                const { data: profile } = await supabase
                  .from('user_profiles')
                  .select('id, name')
                  .eq('id', (link as any).client_id)
                  .single();
                if (profile) {
                  clientIdToName[(link as any).client_id] = (profile as any).name ?? (link as any).client_id;
                }
              }

              for (const alert of (weekAlerts ?? [])) {
                const a = alert as any;
                alertClientsForEmail.push({
                  name: clientIdToName[a.client_id] ?? a.client_id,
                  severity: a.severity as AlertClient['severity'],
                  summary: a.summary,
                  clientId: a.client_id,
                });
              }

              // Clients with no alerts this week
              const alertedClientIds = new Set(alertClientsForEmail.map((a) => a.clientId));
              const okClientNames = (links ?? [])
                .map((l: any) => l.client_id as string)
                .filter((id: string) => !alertedClientIds.has(id))
                .map((id: string) => clientIdToName[id] ?? id);

              const dashboardUrl = `${process.env.APP_ORIGIN ?? 'https://ziko-app.com'}/fr/coach/dashboard`;

              await sendWeeklyDigest({
                coachEmail,
                coachName: coachDisplayName, // fetched from coach_profiles at cron loop start
                alertClients: alertClientsForEmail,
                okClientNames,
                dashboardUrl,
                weekLabel: getWeekLabel(),
              });
            }
          } catch (digestErr) {
            // Weekly digest failure must not abort the rest of the cron (T-29-17 DoS mitigation)
            console.error(`[WeeklyDigest] error for coach ${coachId}:`, digestErr);
          }
        }

      } catch (coachErr) {
        console.error(`[MonitorCron] error for coach ${coachId}:`, coachErr);
      }
    }

    return c.json({
      success: true,
      coaches_processed: coaches.length,
      alerts_written: totalAlerts,
    });
  } catch (err: any) {
    console.error('[MonitorCron] fatal error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// All routes below require coach JWT
router.use('*', authMiddleware);

// ─── GET /alerts — list unread alerts for this coach ─────────────────────────
router.get('/alerts', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const alerts = await getCoachAlerts(jwt, coachId);
    return c.json({ alerts });
  } catch (err: any) {
    console.error('[coach/ai] GET /alerts error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ─── PATCH /alerts/:id/read — mark single alert as read ──────────────────────
router.patch('/alerts/:id/read', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const alertId = c.req.param('id');
  try {
    await markAlertRead(jwt, alertId, coachId);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[coach/ai] PATCH /alerts/:id/read error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ─── POST /alerts/read-all — mark all alerts as read ─────────────────────────
router.post('/alerts/read-all', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    await markAllAlertsRead(jwt, coachId);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[coach/ai] POST /alerts/read-all error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ─── POST /chat/stream — SSE streaming coach AI chat ─────────────────────────
router.post(
  '/chat/stream',
  creditCheck('coach_chat'),
  creditDeduct('coach_chat'),
  async (c) => {
    const { messages = [], conversation_id: bodyConversationId } = await c.req.json<{
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      conversation_id?: string;
    }>();

    const auth = c.get('auth');
    const coachId = auth.userId;
    const jwt = c.req.header('Authorization')!.slice(7);
    const conversationId = bodyConversationId ?? c.req.header('X-Conversation-Id') ?? undefined;

    // Fetch coach context in parallel with conversation creation
    const [coachCtx, convo] = await Promise.all([
      fetchCoachContext(coachId, jwt),
      (async () => {
        // Insert conversation directly so we can set plugin_context = {context:'coach'} (D-02)
        const db = createUserClient(jwt);
        if (conversationId) {
          const { data: msgs } = await db
            .from('ai_messages')
            .select('role, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
          return {
            conversationId,
            history: (msgs ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>,
          };
        }
        const { data, error } = await db
          .from('ai_conversations')
          .insert({ user_id: coachId, plugin_context: { context: 'coach' } })
          .select('id')
          .single();
        if (error || !data) throw new Error(`Failed to create coach conversation: ${error?.message}`);
        return { conversationId: data.id, history: [] };
      })(),
    ]);

    const systemPrompt = buildCoachSystemPrompt(coachCtx);

    const allMessages = [
      ...convo.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ...messages,
    ];

    const userMsgs = messages.filter((m) => m.role === 'user');
    const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : undefined;

    const result = streamText({
      model: AGENT_MODEL,
      system: systemPrompt,
      messages: allMessages,
      tools: buildCoachSDKTools(coachId, jwt),
      stopWhen: stepCountIs(5),
      onFinish: ({ totalUsage }) => {
        logTokenUsage(coachId, 'claude-sonnet-4-20250514', totalUsage);
      },
    });

    // SSE headers MUST be set BEFORE stream() call (Pitfall 3)
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (s) => {
      const chunks: string[] = [];
      try {
        // Send conversation_id first so client can resume
        await s.write(
          `data: ${JSON.stringify({ type: 'meta', conversation_id: convo.conversationId })}\n\n`,
        );

        for await (const part of result.fullStream) {
          if (part.type === 'tool-error') {
            const err = (part as any).error;
            const msg = err instanceof Error ? err.message : JSON.stringify(err) ?? String(err);
            console.error(`[CoachTool Error] ${(part as any).toolName}: ${msg}`);
          }
          if (part.type === 'text-delta') {
            const text = (part as any).textDelta ?? (part as any).text ?? '';
            if (text && !text.includes('<invoke') && !text.includes('</invoke>') && !text.includes('<parameter')) {
              chunks.push(text);
              await s.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
            }
          }
        }

        await s.write('data: [DONE]\n\n');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        console.error('[CoachAI Stream Error]', err);
        await s.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
        await s.write('data: [DONE]\n\n');
      }

      // Persist messages after stream finishes
      const toSave: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (lastUserMsg) toSave.push({ role: 'user', content: lastUserMsg.content });
      const fullResponse = chunks.join('');
      if (fullResponse) toSave.push({ role: 'assistant', content: fullResponse });
      appendMessages(convo.conversationId, toSave, jwt);
    });
  },
);

export { router as coachAiRouter };
