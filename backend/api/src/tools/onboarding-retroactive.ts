import { generateObject, jsonSchema } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { clientForUser } from './db.js';
import { AGENT_MODEL } from '../config/models.js';
import { ONBOARDING_LEVEL, ONBOARDING_TIER } from './onboarding.js';

// ============================================================
// Phase 43 plan 04 — retroactive-recompute module (ONBOARD-06)
//
// This is the one path in Phase 43 where real logged activity exists and
// therefore MUST be the evidence (43-RESEARCH.md Pitfall 4 — explicitly
// distinct from the fresh-onboarding conversation path in ./onboarding.js,
// which legitimately extracts its evidence from the conversation itself
// because a brand-new athlete has no activity history yet).
//
// Trigger: apps/mobile/src/lib/onboardingRecompute.ts calls this lazily from
// authStore.refreshProfile() on every app open, mirroring the v1.4
// lazy-daily-reset precedent — never a cron, never a one-time backfill.
//
// Write path: this module ONLY calls public.record_athlete_decision() —
// never a direct write to athlete_state or athlete_decisions. The single
// read against athlete_state below is the concurrency guard, not a write.
// ============================================================

export const RETROACTIVE_WINDOW_DAYS = 90;

// ── Anthropic schema sanitizer ─────────────────────────────────────────
// Same pattern as backend/api/src/coach/voice/service.ts and
// backend/api/src/coach/imports/parse/claude.ts (IMPORT-BUG-01):
// @ai-sdk/provider-utils adds implicit minimum/maximum on every
// z.number().int() field, which Anthropic's structured-output endpoint
// rejects outright. stripUnsupportedKeywords removes every disallowed
// keyword before the schema is sent.
const ANTHROPIC_BANNED_KEYWORDS = new Set([
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'minItems', 'maxItems',
  'multipleOf', '$schema', 'format',
]);

function stripUnsupportedKeywords(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node;
  if (Array.isArray(node)) return node.map(stripUnsupportedKeywords);
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !ANTHROPIC_BANNED_KEYWORDS.has(key))
      .map(([key, value]) => [key, stripUnsupportedKeywords(value)]),
  );
}

function anthropicSchema<T>(zodType: z.ZodTypeAny) {
  const raw = zodSchema(zodType).jsonSchema;
  return jsonSchema<T>(stripUnsupportedKeywords(raw) as any);
}

// ── Retroactive inference schema ────────────────────────────────────────
// Deliberately missing `micro_action` and `mission_title`: those belong to
// the fresh-onboarding flow's terminal tool (ONBOARD-03/04) only. This is a
// single-shot structured extraction from real activity, not a conversation
// that ends in assigning a first mission.
const RetroactiveProfileZod = z.object({
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']),
  experience_confidence: z.number().int(),
  adherence_risk: z.enum(['low', 'medium', 'high']),
  adherence_confidence: z.number().int(),
  readiness: z.enum(['fragile', 'building', 'ready']),
  readiness_confidence: z.number().int(),
  profile_summary: z.string(),
});

const RETROACTIVE_PROFILE_SCHEMA = anthropicSchema<z.infer<typeof RetroactiveProfileZod>>(
  RetroactiveProfileZod,
);

const RETROACTIVE_SYSTEM_PROMPT = `You infer a fitness athlete's current training standing from their real logged activity history alone. This is a one-shot structured extraction, not a conversation — you are given only aggregate counts over a fixed window, never raw messages or self-report.

Zero activity across the window is itself a real, meaningful observation — treat it as a genuinely fragile starting point, never as missing data to guess around or substitute with a generic default. Assign each confidence score (1-5) based on how directly the aggregates support that particular read: sparse or all-zero aggregates should carry low confidence, not a fabricated high one.`;

function buildRetroactivePrompt(aggregates: ActivityAggregates): string {
  return `Real logged activity aggregates for this athlete over the last ${aggregates.window_days} days:

${JSON.stringify(aggregates, null, 2)}

Infer this athlete's experience_level, adherence_risk, and readiness from this activity alone, with a 1-5 confidence score for each, plus a short profile_summary.`;
}

// ── Activity aggregation ────────────────────────────────────────────────

export interface ActivityAggregates {
  workout_sessions_90d: number;
  total_volume_kg_90d: number;
  habit_log_days_90d: number;
  nutrition_log_days_90d: number;
  cardio_sessions_90d: number;
  measurement_entries_90d: number;
  distinct_active_days_90d: number;
  days_since_last_activity: number | null;
  window_days: number;
}

/**
 * Issues five parallel, window-scoped reads against real activity tables and
 * reduces them to plain aggregate counts — never raw rows — mirroring
 * context/user.ts's fetchUserContext() "aggregate, do not dump raw rows"
 * convention. workout_sessions filters on its started_at timestamptz column;
 * every other table filters on its own date column (confirmed against the
 * live migrations — none of these tables uses a signup-timestamp column for
 * this purpose).
 */
export async function fetchActivityAggregates(
  userId: string,
  userToken?: string,
): Promise<ActivityAggregates> {
  const db = clientForUser(userToken);

  const windowStartMs = Date.now() - RETROACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const windowStartDate = windowStartIso.split('T')[0];

  const [workoutsRes, habitLogsRes, nutritionLogsRes, cardioRes, measurementsRes] = await Promise.all([
    db
      .from('workout_sessions')
      .select('started_at, total_volume_kg')
      .eq('user_id', userId)
      .gte('started_at', windowStartIso),
    db.from('habit_logs').select('date, value').eq('user_id', userId).gte('date', windowStartDate),
    db.from('nutrition_logs').select('date').eq('user_id', userId).gte('date', windowStartDate),
    db.from('cardio_sessions').select('date').eq('user_id', userId).gte('date', windowStartDate),
    db.from('body_measurements').select('date').eq('user_id', userId).gte('date', windowStartDate),
  ]);

  const workouts = (workoutsRes.data ?? []) as Array<{ started_at: string; total_volume_kg: number | null }>;
  const habitLogs = (habitLogsRes.data ?? []) as Array<{ date: string; value: number }>;
  const nutritionLogs = (nutritionLogsRes.data ?? []) as Array<{ date: string }>;
  const cardioSessions = (cardioRes.data ?? []) as Array<{ date: string }>;
  const measurements = (measurementsRes.data ?? []) as Array<{ date: string }>;

  const workout_sessions_90d = workouts.length;
  const total_volume_kg_90d = Math.round(
    workouts.reduce((sum, w) => sum + (Number(w.total_volume_kg) || 0), 0),
  );

  const habitDates = new Set(habitLogs.map((h) => h.date));
  const nutritionDates = new Set(nutritionLogs.map((n) => n.date));

  const habit_log_days_90d = habitDates.size;
  const nutrition_log_days_90d = nutritionDates.size;
  const cardio_sessions_90d = cardioSessions.length;
  const measurement_entries_90d = measurements.length;

  // Union of every dated activity signal, including workout_sessions'
  // timestamptz collapsed to its calendar date.
  const allActiveDates = new Set<string>();
  for (const w of workouts) {
    if (w.started_at) allActiveDates.add(w.started_at.split('T')[0]);
  }
  for (const d of habitDates) allActiveDates.add(d);
  for (const d of nutritionDates) allActiveDates.add(d);
  for (const c of cardioSessions) {
    if (c.date) allActiveDates.add(c.date);
  }
  for (const m of measurements) {
    if (m.date) allActiveDates.add(m.date);
  }

  const distinct_active_days_90d = allActiveDates.size;

  let days_since_last_activity: number | null = null;
  if (allActiveDates.size > 0) {
    // ISO date strings (YYYY-MM-DD) sort lexicographically in chronological
    // order, so the max of the set is simply the last array element sorted.
    const lastDate = Array.from(allActiveDates).sort().pop()!;
    const diffMs = Date.now() - new Date(`${lastDate}T00:00:00Z`).getTime();
    days_since_last_activity = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  }

  return {
    workout_sessions_90d,
    total_volume_kg_90d,
    habit_log_days_90d,
    nutrition_log_days_90d,
    cardio_sessions_90d,
    measurement_entries_90d,
    distinct_active_days_90d,
    days_since_last_activity,
    window_days: RETROACTIVE_WINDOW_DAYS,
  };
}

// ── Retroactive compute ─────────────────────────────────────────────────

export type RetroactiveComputeResult =
  | { success: true; decision_id: string }
  | { success: false; skipped: 'state_exists' | 'not_onboarded' }
  | { success: false; error: string };

/**
 * Computes and writes a pre-v1.18 athlete's starting state from their real
 * 90-day activity history, the first time they open the app after this
 * feature ships. Guarded to run at most once per athlete lifetime — see the
 * athlete_state existence check below, which is the concurrency guard
 * against apps/mobile/src/lib/onboardingRecompute.ts firing twice per app
 * open (authStore.refreshProfile() runs on both the initial session
 * resolution and the onAuthStateChange callback).
 */
export async function computeRetroactiveProfile(
  userId: string,
  userToken?: string,
): Promise<RetroactiveComputeResult> {
  const db = clientForUser(userToken);

  // 1. Concurrency guard — a row already means this athlete has already been
  // profiled (fresh onboarding, a prior retroactive run, or the fixed-date
  // trigger). No model call, no RPC call, on this path.
  const { data: existingState, error: stateReadError } = await db
    .from('athlete_state')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (stateReadError) {
    throw new Error(`athlete_state guard read failed: ${stateReadError.message}`);
  }
  if (existingState) {
    return { success: false, skipped: 'state_exists' };
  }

  // 2. Only a pre-v1.18 athlete who completed the OLD structured onboarding
  // qualifies for this path — a brand-new signup goes through the
  // conversational Ziko flow (43-03) instead, never this one.
  const { data: profile, error: profileReadError } = await db
    .from('user_profiles')
    .select('onboarding_done')
    .eq('id', userId)
    .maybeSingle();

  if (profileReadError) {
    throw new Error(`user_profiles guard read failed: ${profileReadError.message}`);
  }
  if (!profile?.onboarding_done) {
    return { success: false, skipped: 'not_onboarded' };
  }

  // 3. Real activity, aggregated — this is what makes this path genuinely
  // grounded evidence, unlike the fresh-onboarding tool's self-reported
  // conversation signal (43-RESEARCH.md Pitfall 4).
  const aggregates = await fetchActivityAggregates(userId, userToken);

  // 4. Single-shot structured extraction — generateObject, never a
  // conversational multi-turn call, because this reads only the aggregate
  // object and never talks to the athlete.
  const { object } = await generateObject({
    model: AGENT_MODEL,
    schema: RETROACTIVE_PROFILE_SCHEMA,
    system: RETROACTIVE_SYSTEM_PROMPT,
    prompt: buildRetroactivePrompt(aggregates),
  });

  const {
    experience_level,
    experience_confidence,
    adherence_risk,
    adherence_confidence,
    readiness,
    readiness_confidence,
    profile_summary,
  } = object;

  // 5. Write exclusively through record_athlete_decision(). Never substitute
  // a generic or defaulted profile when the aggregates are empty — zero
  // activity across 90 days is itself real, meaningful evidence that
  // legitimately maps to readiness: 'fragile'; it must be reported as such,
  // not papered over.
  const { data, error } = await db.rpc('record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'onboarding_profile',
    p_week_of: null,
    p_summary: profile_summary,
    p_rationale: `Inferred from ${aggregates.workout_sessions_90d} workout session(s), ${aggregates.distinct_active_days_90d} distinct active day(s), and ${aggregates.cardio_sessions_90d} cardio session(s) over the last ${aggregates.window_days} days.`,
    p_evidence: { ...aggregates, evidence_source: 'real_activity_history' },
    p_outcome: { level: ONBOARDING_LEVEL, tier: ONBOARDING_TIER, readiness },
    p_source: 'app_open_fallback',
    p_state_patch: {
      level: ONBOARDING_LEVEL,
      tier: ONBOARDING_TIER,
      readiness,
      status: 'active',
      current_focus_summary: profile_summary,
      onboarding_profile: {
        experience_level,
        adherence_risk,
        confidences: {
          experience: experience_confidence,
          adherence: adherence_confidence,
          readiness: readiness_confidence,
        },
        computed_retroactively: true,
      },
    },
  });

  if (error) {
    throw new Error(`record_athlete_decision failed: ${error.message}`);
  }

  const result = data as { success?: boolean; error?: string; decision_id?: string } | null;

  if (result?.success !== true) {
    return { success: false, error: result?.error ?? 'unknown_rpc_failure' };
  }

  return { success: true, decision_id: result.decision_id! };
}
