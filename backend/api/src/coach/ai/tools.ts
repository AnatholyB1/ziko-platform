// Coach AI tool registry — 3 coach-only tools.
// NEVER add these to backend/api/src/tools/registry.ts (athlete-facing).
// All executors use createUserClient(jwt) for RLS-scoped reads (is_coach_of fires automatically).
import { createHash } from 'node:crypto';
import { generateText } from 'ai';
import { AGENT_MODEL } from '../../config/models.js';
import { createUserClient } from '../clients/db.js';
import { logToolAudit, insertAlerts } from './db.js';

// ─── Tool schema types ────────────────────────────────────────────────────────

export interface AIToolParameter {
  type: 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}

export interface ToolExecutor {
  schema: AITool;
  execute: (params: Record<string, unknown>, coachId: string, jwt: string) => Promise<unknown>;
}

// ─── Helper: SHA-256 of JSON-serialised input ─────────────────────────────────

function hashArgs(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

// ─── Tool schemas ─────────────────────────────────────────────────────────────

export const coachToolSchemas: AITool[] = [
  {
    name: 'analyze_client',
    description:
      "Analyze a linked client's training, sleep, mood, and body measurement data over a given period. Returns progression metrics, risk signals, and coaching suggestions. Only works for clients actively linked to this coach.",
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID of the linked client to analyze' },
        period_days: {
          type: 'integer',
          description: 'Look-back period in days (7, 14, 30, or 90). Defaults to 30.',
          default: 30,
        },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'generate_coaching_program',
    description:
      "Generate a personalized workout program for a linked client and persist it in the database. Returns the program ID and name. The program is immediately assigned to the client (not a template).",
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID of the linked client' },
        goal: {
          type: 'string',
          description: 'Primary training goal',
          enum: ['muscle_gain', 'fat_loss', 'strength', 'endurance', 'general_fitness'],
        },
        days_per_week: {
          type: 'integer',
          description: 'Number of training days per week (2 to 6)',
        },
        split_type: {
          type: 'string',
          description: 'Training split',
          enum: ['full_body', 'upper_lower', 'ppl', 'bro_split', 'custom'],
        },
        experience_level: {
          type: 'string',
          description: "Client's training experience level",
          enum: ['beginner', 'intermediate', 'advanced'],
        },
        equipment: {
          type: 'string',
          description: 'Available equipment',
          enum: ['full_gym', 'home', 'bodyweight', 'dumbbells_only'],
        },
        duration_weeks: {
          type: 'integer',
          description: 'Program length in weeks (4, 8, or 12). Defaults to 8.',
          default: 8,
        },
      },
      required: ['client_id', 'goal', 'days_per_week'],
    },
  },
  {
    name: 'monitor_client_alerts',
    description:
      "Run rule-based alert detection across all linked clients. Detects: missed sessions (no workout in 7 days), sleep drop (avg last 3 nights vs prior week), and mood decline (journal trend). Writes detected alerts to the database and returns a summary.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ─── Tool executors ───────────────────────────────────────────────────────────

async function analyzeClientExecutor(
  input: Record<string, unknown>,
  coachId: string,
  jwt: string,
): Promise<unknown> {
  const clientId = input.client_id as string;
  const periodDays = typeof input.period_days === 'number' ? input.period_days : 30;
  const argsHash = hashArgs(input);

  // MUST use JWT client — service key bypasses is_coach_of RLS
  const db = createUserClient(jwt);

  // Defense-in-depth: verify coach_client_links before any data read
  const { data: link } = await db
    .from('coach_client_links')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .maybeSingle();

  if (!link) {
    logToolAudit({
      coachId,
      toolName: 'analyze_client',
      targetClientId: clientId,
      argsHash,
      resultStatus: 'error',
      conversationId: null,
    });
    throw new Error('Client not linked to this coach');
  }

  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  // Fetch data in parallel — all scoped to this client
  const [sessionsRes, sleepRes, moodRes, weightRes] = await Promise.all([
    db
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', clientId)
      .gte('created_at', since),
    db
      .from('sleep_logs')
      .select('duration_hours')
      .eq('user_id', clientId)
      .gte('date', since.split('T')[0])
      .order('date', { ascending: false })
      .limit(30),
    db
      .from('journal_entries')
      .select('mood')
      .eq('user_id', clientId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(30),
    db
      .from('body_measurements')
      .select('weight_kg')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sessionsCount = sessionsRes.count ?? 0;

  const sleepEntries = (sleepRes.data ?? []).map((r: any) => Number(r.duration_hours));
  const avgSleepHours =
    sleepEntries.length > 0
      ? Math.round((sleepEntries.reduce((a: number, b: number) => a + b, 0) / sleepEntries.length) * 10) / 10
      : null;

  const moodEntries = (moodRes.data ?? []).map((r: any) => Number(r.mood));
  const avgMood =
    moodEntries.length > 0
      ? Math.round((moodEntries.reduce((a: number, b: number) => a + b, 0) / moodEntries.length) * 10) / 10
      : null;

  const latestWeightKg = (weightRes.data as any)?.weight_kg ?? null;

  // Basic suggestions
  const suggestions: string[] = [];
  if (sessionsCount === 0) suggestions.push('No workout sessions logged in the period — check in with client.');
  if (avgSleepHours !== null && avgSleepHours < 6.5) suggestions.push('Average sleep below 6.5h — discuss recovery strategies.');
  if (avgMood !== null && avgMood < 3) suggestions.push('Low average mood — consider adjusting training load.');

  const result = {
    client_id: clientId,
    period_days: periodDays,
    sessions_count: sessionsCount,
    avg_sleep_hours: avgSleepHours,
    avg_mood: avgMood,
    latest_weight_kg: latestWeightKg,
    suggestions,
  };

  logToolAudit({
    coachId,
    toolName: 'analyze_client',
    targetClientId: clientId,
    argsHash,
    resultStatus: 'success',
    conversationId: null,
  });

  return result;
}

async function generateCoachingProgramExecutor(
  input: Record<string, unknown>,
  coachId: string,
  jwt: string,
): Promise<unknown> {
  const clientId = input.client_id as string;
  const goal = input.goal as string;
  const daysPerWeek = input.days_per_week as number;
  const splitType = (input.split_type as string | undefined) ?? 'full_body';
  const experienceLevel = (input.experience_level as string | undefined) ?? 'intermediate';
  const equipment = (input.equipment as string | undefined) ?? 'full_gym';
  const durationWeeks = typeof input.duration_weeks === 'number' ? input.duration_weeks : 8;
  const argsHash = hashArgs(input);

  // MUST use JWT client — service key bypasses is_coach_of RLS
  const db = createUserClient(jwt);

  // Defense-in-depth: verify coach_client_links before any data write
  const { data: link } = await db
    .from('coach_client_links')
    .select('id')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .maybeSingle();

  if (!link) {
    logToolAudit({
      coachId,
      toolName: 'generate_coaching_program',
      targetClientId: clientId,
      argsHash,
      resultStatus: 'error',
      conversationId: null,
    });
    throw new Error('Client not linked to this coach');
  }

  // Generate program structure with Sonnet
  const programPrompt = `Generate a ${durationWeeks}-week workout program as valid JSON only (no markdown, no explanation).

Program specs:
- Goal: ${goal}
- Days per week: ${daysPerWeek}
- Split type: ${splitType}
- Experience level: ${experienceLevel}
- Equipment: ${equipment}

Return this exact JSON structure:
{
  "weeks": [
    {
      "week_number": 1,
      "sessions": [
        {
          "day": "Monday",
          "name": "Session name",
          "exercises": [
            { "name": "Exercise name", "sets": 3, "reps": "8-10", "rest_seconds": 90 }
          ]
        }
      ]
    }
  ]
}

Include ${daysPerWeek} sessions per week for all ${durationWeeks} weeks. Use progressive overload (increase sets/reps/weight each week).`;

  let weeksData: unknown[] = [];
  try {
    const { text } = await generateText({
      model: AGENT_MODEL,
      messages: [{ role: 'user', content: programPrompt }],
    });
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    weeksData = parsed.weeks ?? [];
  } catch (err) {
    console.error('[generate_coaching_program] AI generation failed, using empty weeks_data:', err);
    weeksData = [];
  }

  const programName = `Programme IA — ${goal.replace(/_/g, ' ')}`;

  const { data, error } = await db
    .from('workout_programs')
    .insert({
      name: programName,
      goal,
      created_by_coach_id: coachId,
      assigned_to_user_id: clientId,
      is_template: false,
      weeks_data: weeksData,
      weeks_count: durationWeeks,
    })
    .select('id, name, weeks_count')
    .single();

  if (error) {
    logToolAudit({
      coachId,
      toolName: 'generate_coaching_program',
      targetClientId: clientId,
      argsHash,
      resultStatus: 'error',
      conversationId: null,
    });
    throw new Error(error.message);
  }

  logToolAudit({
    coachId,
    toolName: 'generate_coaching_program',
    targetClientId: clientId,
    argsHash,
    resultStatus: 'success',
    conversationId: null,
  });

  return {
    program_id: data.id,
    name: data.name,
    weeks_count: data.weeks_count,
  };
}

async function monitorClientAlertsExecutor(
  input: Record<string, unknown>,
  coachId: string,
  jwt: string,
): Promise<unknown> {
  const argsHash = hashArgs(input);

  // MUST use JWT client — service key bypasses is_coach_of RLS
  const db = createUserClient(jwt);

  // Fetch all active linked clients for this coach
  const { data: links, error: linksErr } = await db
    .from('coach_client_links')
    .select('client_id')
    .eq('coach_id', coachId)
    .is('revoked_at', null);

  if (linksErr) {
    logToolAudit({
      coachId,
      toolName: 'monitor_client_alerts',
      targetClientId: null,
      argsHash,
      resultStatus: 'error',
      conversationId: null,
    });
    throw new Error(linksErr.message);
  }

  const clientIds = (links ?? []).map((l: any) => l.client_id as string);
  const newAlerts: Array<{
    coach_id: string;
    client_id: string;
    alert_type: 'missed_sessions' | 'sleep_drop' | 'mood_decline' | 'rpe_inflation';
    severity: 'low' | 'medium' | 'high';
    summary: string;
  }> = [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  for (const clientId of clientIds) {
    // 1. Missed sessions: no workout_sessions in last 7 days
    const { data: recentSessions } = await db
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
        summary: 'No workout sessions logged in the last 7 days. Consider reaching out to check in.',
      });
    }

    // 2. Sleep drop: avg last 3 nights vs 4-10 days ago
    const [recentSleepRes, baselineSleepRes] = await Promise.all([
      db
        .from('sleep_logs')
        .select('duration_hours')
        .eq('user_id', clientId)
        .gte('date', threeDaysAgo),
      db
        .from('sleep_logs')
        .select('duration_hours')
        .eq('user_id', clientId)
        .gte('date', tenDaysAgo)
        .lt('date', threeDaysAgo),
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
          summary: `Sleep dropped by ${drop.toFixed(1)}h vs prior baseline. May impact recovery and performance.`,
        });
      }
    }

    // 3. Mood decline: avg last 7 days vs prior 7 days
    const [recentMoodRes, baselineMoodRes] = await Promise.all([
      db
        .from('journal_entries')
        .select('mood')
        .eq('user_id', clientId)
        .gte('created_at', sevenDaysAgo),
      db
        .from('journal_entries')
        .select('mood')
        .eq('user_id', clientId)
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo),
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
          summary: `Mood declined by ${moodDrop.toFixed(1)} points over the past week. Consider adjusting training load or checking in.`,
        });
      }
    }
  }

  // Batch-insert all detected alerts (fire-and-forget on error — monitoring is best-effort)
  try {
    await insertAlerts(newAlerts);
  } catch (err) {
    console.error('[monitor_client_alerts] insertAlerts failed:', err);
  }

  logToolAudit({
    coachId,
    toolName: 'monitor_client_alerts',
    targetClientId: null,
    argsHash,
    resultStatus: 'success',
    conversationId: null,
  });

  return {
    alerts_count: newAlerts.length,
    clients_scanned: clientIds.length,
    alerts: newAlerts.map((a) => ({
      client_id: a.client_id,
      alert_type: a.alert_type,
      severity: a.severity,
      summary: a.summary,
    })),
  };
}

// ─── Executor registry ────────────────────────────────────────────────────────

const executors: Record<string, ToolExecutor['execute']> = {
  analyze_client: analyzeClientExecutor,
  generate_coaching_program: generateCoachingProgramExecutor,
  monitor_client_alerts: monitorClientAlertsExecutor,
};

export function getCoachToolExecutor(name: string): ToolExecutor['execute'] | undefined {
  return executors[name];
}
