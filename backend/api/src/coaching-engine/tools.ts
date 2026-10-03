// Phase 44 (v1.18, weekly-adaptive-decision-engine) — coaching-engine module.
//
// create_goal / create_program tool executors + their AITool schemas
// (ENGINE-06). Both write exclusively through record_athlete_decision() —
// the sole write door to athlete_state / athlete_decisions / athlete_goals
// (Phase 42's table-level REVOKE makes any other path fail outright).
//
// Security discipline (threat model T-44-10/T-44-11/T-44-12/T-44-13/T-44-15):
//   - p_user_id always comes from the userId function argument, never params
//   - p_evidence is always re-derived from a real activity query, never
//     taken from the model's structured output
//   - Every RPC call sends all ten named parameters, including p_rationale
//     and p_source, which have no database default
//   - create_program's current_focus_detail patch merges over the athlete's
//     existing detail rather than replacing it, so goal_id is never orphaned
import { clientForUser } from './db.js';
import { fetchFocusScopedActivity } from './context.js';
import type { AITool } from '../tools/registry.js';
import type { FocusType } from './types.js';

const MAPPED_FOCUS_TYPES = new Set<FocusType>([
  'training_volume',
  'habit_consistency',
  'nutrition',
  'hydration',
  'recovery',
  'cardio',
]);

const ALLOWED_SOURCES = ['weekly_review_cron', 'onboarding_tool', 'app_open_fallback', 'manual_admin'] as const;
type AllowedSource = (typeof ALLOWED_SOURCES)[number];

/**
 * Normalises a caller-supplied `source` value against the live
 * athlete_decisions.source CHECK constraint (T-44-13) — rejecting anything
 * outside the four allowed values rather than forwarding it, since an
 * invalid value fails the CHECK constraint at the DB. Shared by both
 * executors so the two call sites cannot drift apart again.
 */
function normaliseSource(value: unknown, fallback: AllowedSource): AllowedSource {
  if (typeof value === 'string' && (ALLOWED_SOURCES as readonly string[]).includes(value)) {
    return value as AllowedSource;
  }
  return fallback;
}

/**
 * Re-derives real, server-side evidence for the athlete's currently active
 * focus (T-44-11). The model's structured output may contain its own
 * `evidence` field; both executors discard it — this is the FOUND-02
 * grounding obligation. The RPC's schema can require an evidence object but
 * cannot verify its truthfulness; that verification is this file's job.
 */
async function buildRealEvidence(
  db: ReturnType<typeof clientForUser>,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data: stateRow } = await db
    .from('ziko_athlete_state')
    .select('current_focus_detail')
    .eq('user_id', userId)
    .maybeSingle();

  const focusDetail = ((stateRow as { current_focus_detail?: Record<string, unknown> } | null)
    ?.current_focus_detail ?? {}) as Record<string, unknown>;
  const rawFocusType = focusDetail.focus_type;
  const focusType: FocusType =
    typeof rawFocusType === 'string' && MAPPED_FOCUS_TYPES.has(rawFocusType as FocusType)
      ? (rawFocusType as FocusType)
      : 'unassigned';

  const windowEndIso = new Date().toISOString();
  const windowStartIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const activity = await fetchFocusScopedActivity(db, userId, focusType, windowStartIso, windowEndIso);

  return {
    ...activity.metrics,
    tables_read: activity.tables_read,
    evidence_source: 'real_activity_history',
  };
}

async function fetchExistingFocusDetail(
  db: ReturnType<typeof clientForUser>,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data: stateRow } = await db
    .from('ziko_athlete_state')
    .select('current_focus_detail')
    .eq('user_id', userId)
    .maybeSingle();

  return ((stateRow as { current_focus_detail?: Record<string, unknown> } | null)
    ?.current_focus_detail ?? {}) as Record<string, unknown>;
}

// ── create_goal ─────────────────────────────────────────────────────────
export async function create_goal(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);

  const [evidence, existingDetail] = await Promise.all([
    buildRealEvidence(db, userId),
    fetchExistingFocusDetail(db, userId),
  ]);

  const goal_text = params.goal_text as string | undefined;
  const target_metric = (params.target_metric as string | undefined) ?? null;
  const target_value = typeof params.target_value === 'number' ? params.target_value : null;
  const target_date = params.target_date as string | undefined;

  const { data, error } = await db.rpc('ziko_record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'goal_created',
    p_week_of: null,
    p_summary: goal_text,
    // p_rationale has NO database default — an undefined value is dropped
    // by supabase-js and PostgREST can then no longer resolve the 10-arg
    // signature (42883-class failure, T-44-15). Always send a fallback.
    p_rationale:
      typeof params.rationale === 'string' && params.rationale.length > 0
        ? params.rationale
        : 'Goal created from athlete conversation.',
    p_evidence: evidence,
    p_outcome: { goal_text, target_metric, target_value, target_date },
    p_source: normaliseSource(params.source, 'onboarding_tool'),
    // Existing detail unchanged — no goal_id key, and never a placeholder
    // goal-id marker. The RPC inserts the athlete_goals row and stamps the
    // real goal_id into current_focus_detail itself, atomically.
    p_state_patch: { current_focus_detail: existingDetail },
    p_new_goal: {
      goal_text,
      target_metric,
      target_value,
      target_date,
      status: 'active',
    },
  });

  if (error) {
    throw new Error(`record_athlete_decision failed: ${error.message}`);
  }

  const result = data as { success?: boolean; error?: string; decision_id?: string; goal_id?: string } | null;

  if (result?.success !== true) {
    throw new Error(`record_athlete_decision returned failure: ${result?.error ?? 'unknown_rpc_failure'}`);
  }

  return result;
}

// ── create_program ──────────────────────────────────────────────────────
export async function create_program(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);

  const [evidence, existingDetail] = await Promise.all([
    buildRealEvidence(db, userId),
    fetchExistingFocusDetail(db, userId),
  ]);

  const focus_summary = params.focus_summary as string | undefined;
  const focus_type = params.focus_type as string | undefined;
  const target_metric = params.target_metric as string | undefined;
  const target_value = params.target_value as number | undefined;
  const session_type = (params.session_type as string | undefined) ?? null;
  const week_of = (params.week_of as string | undefined) ?? null;

  const { data, error } = await db.rpc('ziko_record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'program_created',
    p_week_of: null,
    p_summary: focus_summary,
    p_rationale:
      typeof params.rationale === 'string' && params.rationale.length > 0
        ? params.rationale
        : 'Weekly training targets derived from the athlete active focus.',
    p_source: normaliseSource(params.source, 'onboarding_tool'),
    p_evidence: evidence,
    p_outcome: { focus_type, target_metric, target_value, session_type },
    // Spread over existingDetail is load-bearing: the RPC assigns
    // current_focus_detail with COALESCE(p_state_patch->'current_focus_detail',
    // current_focus_detail), replacing the whole JSONB — a non-merged patch
    // would silently drop goal_id and orphan the athlete's goal link (T-44-12).
    p_state_patch: {
      current_focus_summary: focus_summary,
      current_focus_detail: {
        ...existingDetail,
        focus_type,
        target_metric,
        target_value,
        session_type,
        week_of,
      },
    },
  });

  if (error) {
    throw new Error(`record_athlete_decision failed: ${error.message}`);
  }

  const result = data as { success?: boolean; error?: string; decision_id?: string } | null;

  if (result?.success !== true) {
    throw new Error(`record_athlete_decision returned failure: ${result?.error ?? 'unknown_rpc_failure'}`);
  }

  return result;
}

// ── Tool schemas ─────────────────────────────────────────────────────────
// Uses the registry's `parameters` field shape (not the AI SDK's
// `inputSchema` — that naming applies to the SDK's own tool() wrapper, not
// this internal registry type). Neither schema declares a `user_id`
// property — the athlete is always the authenticated caller (T-44-10).
export const coachingEngineToolSchemas: AITool[] = [
  {
    name: 'create_goal',
    description:
      "Set a broader, multi-week outcome goal for the athlete (e.g. 'build a base fitness habit by " +
      "December'). This is the multi-week destination, not this week's concrete sessions — call " +
      'create_program separately for that.',
    parameters: {
      type: 'object',
      properties: {
        goal_text: { type: 'string', description: 'Athlete-facing description of the goal.' },
        target_metric: {
          type: 'string',
          description: 'The metric this goal tracks (e.g. sessions_completed, total_volume_kg).',
        },
        target_value: { type: 'number', description: 'The numeric target for target_metric.' },
        target_date: { type: 'string', description: 'ISO date (YYYY-MM-DD) the goal targets.' },
        rationale: { type: 'string', description: 'Why this goal was set, grounded in real evidence.' },
      },
      required: ['goal_text', 'target_date'],
    },
  },
  {
    name: 'create_program',
    description:
      "Write this week's concrete structured training targets, referencing the athlete's active goal. " +
      'Does not generate a full multi-week program — that stays a separate, chat-initiated action.',
    parameters: {
      type: 'object',
      properties: {
        focus_summary: { type: 'string', description: "Athlete-facing one-line summary of this week's focus." },
        focus_type: {
          type: 'string',
          enum: ['training_volume', 'habit_consistency', 'nutrition', 'hydration', 'recovery', 'cardio', 'unassigned'],
          description: "This week's focus category.",
        },
        target_metric: { type: 'string', description: 'The metric this week targets.' },
        target_value: { type: 'number', description: 'The numeric target for target_metric this week.' },
        session_type: { type: 'string', description: 'Optional session type label (e.g. strength, cardio).' },
        rationale: { type: 'string', description: 'Why these targets were set, grounded in real evidence.' },
      },
      required: ['focus_summary', 'focus_type', 'target_metric', 'target_value'],
    },
  },
];
