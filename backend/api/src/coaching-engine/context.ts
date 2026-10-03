// Phase 44 (v1.18, weekly-adaptive-decision-engine) — coaching-engine module.
//
// Focus-scoped real-activity aggregation (D-08 closed-set table mapping) and
// the deterministic exact-or-exceed "met" verdict (D-07). Mirrors
// onboarding-retroactive.ts's fetchActivityAggregates() Promise.all
// parallel-read + reduce-to-counts convention, but the query set is selected
// conditionally on the athlete's focus_type instead of always reading every
// activity table.
//
// No try/catch anywhere in this module — Supabase errors propagate to the
// caller, matching onboarding-retroactive.ts's convention.
import { clientForUser } from './db.js';
import type {
  FocusComparison,
  FocusScopedActivity,
  FocusTarget,
  FocusType,
  RecentDecision,
  WeeklyReviewContext,
} from './types.js';

type Db = ReturnType<typeof clientForUser>;

/**
 * D-08 closed-set focus→source mapping — the single source of truth every
 * other file in this phase reads. `tables` is the exact query set for that
 * focus type; `metrics` documents the metric names fetchFocusScopedActivity
 * populates for it. This is data, not query logic — table names are never
 * interpolated from athlete-supplied JSONB (T-44-06), only looked up here or
 * defaulted to 'unassigned'.
 */
export const FOCUS_SOURCE_MAP: Record<FocusType, { tables: string[]; metrics: string[] }> = {
  training_volume: {
    tables: ['ziko_workout_sessions'],
    metrics: ['sessions_completed', 'total_volume_kg'],
  },
  habit_consistency: {
    tables: ['ziko_habit_logs', 'ziko_journal_entries'],
    metrics: ['habit_log_days', 'journal_entry_days', 'distinct_active_days'],
  },
  nutrition: {
    tables: ['ziko_nutrition_logs'],
    metrics: ['nutrition_log_days'],
  },
  hydration: {
    tables: ['ziko_hydration_logs'],
    metrics: ['hydration_log_days', 'total_ml'],
  },
  recovery: {
    tables: ['ziko_sleep_logs'],
    metrics: ['sleep_log_days', 'avg_duration_hours'],
  },
  cardio: {
    tables: ['ziko_cardio_sessions'],
    metrics: ['cardio_sessions_completed', 'total_duration_min'],
  },
  // Deliberate fallback for a freshly-onboarded athlete whose
  // current_focus_detail has no recognised focus_type yet: the review still
  // runs (ENGINE-03's guard-rail role starts immediately after onboarding)
  // but produces met: null, and plan 44-03's prompt forbids de-escalating
  // on a null verdict.
  unassigned: {
    tables: ['ziko_workout_sessions', 'ziko_habit_logs'],
    metrics: ['sessions_completed', 'habit_log_days'],
  },
};

const MAPPED_FOCUS_TYPES = new Set<FocusType>([
  'training_volume',
  'habit_consistency',
  'nutrition',
  'hydration',
  'recovery',
  'cardio',
]);

function toIsoDate(iso: string): string {
  return iso.split('T')[0];
}

/**
 * Issues exactly the queries FOCUS_SOURCE_MAP names for this focus type and
 * no others — never an "always fetch workouts too" convenience read, since
 * the auditable tables_read claim depends on it. Reduces every result to
 * plain counts/sums before returning — never raw rows.
 */
export async function fetchFocusScopedActivity(
  db: Db,
  userId: string,
  focusType: FocusType,
  windowStartIso: string,
  windowEndIso: string,
  targetMetric?: string | null,
): Promise<FocusScopedActivity> {
  const windowStartDate = toIsoDate(windowStartIso);
  const windowEndDate = toIsoDate(windowEndIso);
  const tablesRead: string[] = [];
  const metrics: Record<string, number> = {};

  switch (focusType) {
    case 'training_volume': {
      tablesRead.push('ziko_workout_sessions');
      const { data } = await db
        .from('ziko_workout_sessions')
        .select('id, started_at, total_volume_kg')
        .eq('user_id', userId)
        .gte('started_at', windowStartIso)
        .lte('started_at', windowEndIso);
      const rows = (data ?? []) as Array<{
        id: string;
        started_at: string;
        total_volume_kg: number | null;
      }>;
      metrics.sessions_completed = rows.length;
      metrics.total_volume_kg = Math.round(
        rows.reduce((sum, r) => sum + (Number(r.total_volume_kg) || 0), 0),
      );

      if (targetMetric === 'sets_completed') {
        // session_sets has no user_id column — reached only via the ids of
        // the sessions already fetched, which are already scoped to userId.
        tablesRead.push('ziko_session_sets');
        const sessionIds = rows.map((r) => r.id);
        const { data: setsData } = await db
          .from('ziko_session_sets')
          .select('completed')
          .in('session_id', sessionIds)
          .eq('completed', true);
        metrics.sets_completed = (setsData ?? []).length;
      }
      break;
    }

    case 'habit_consistency': {
      tablesRead.push('ziko_habit_logs', 'ziko_journal_entries');
      const [habitRes, journalRes] = await Promise.all([
        db
          .from('ziko_habit_logs')
          .select('date')
          .eq('user_id', userId)
          .gte('date', windowStartDate)
          .lte('date', windowEndDate),
        db
          .from('ziko_journal_entries')
          .select('date')
          .eq('user_id', userId)
          .gte('date', windowStartDate)
          .lte('date', windowEndDate),
      ]);
      const habitDates = new Set(
        ((habitRes.data ?? []) as Array<{ date: string }>).map((r) => r.date),
      );
      const journalDates = new Set(
        ((journalRes.data ?? []) as Array<{ date: string }>).map((r) => r.date),
      );
      metrics.habit_log_days = habitDates.size;
      metrics.journal_entry_days = journalDates.size;
      // Union, not sum — an athlete logging both a habit and a journal
      // entry on the same day is one active day, not two.
      const unionDates = new Set<string>([...habitDates, ...journalDates]);
      metrics.distinct_active_days = unionDates.size;
      break;
    }

    case 'nutrition': {
      tablesRead.push('ziko_nutrition_logs');
      const { data } = await db
        .from('ziko_nutrition_logs')
        .select('date')
        .eq('user_id', userId)
        .gte('date', windowStartDate)
        .lte('date', windowEndDate);
      const dates = new Set(((data ?? []) as Array<{ date: string }>).map((r) => r.date));
      metrics.nutrition_log_days = dates.size;
      break;
    }

    case 'hydration': {
      tablesRead.push('ziko_hydration_logs');
      const { data } = await db
        .from('ziko_hydration_logs')
        .select('date, amount_ml')
        .eq('user_id', userId)
        .gte('date', windowStartDate)
        .lte('date', windowEndDate);
      const rows = (data ?? []) as Array<{ date: string; amount_ml: number | null }>;
      metrics.hydration_log_days = new Set(rows.map((r) => r.date)).size;
      metrics.total_ml = rows.reduce((sum, r) => sum + (Number(r.amount_ml) || 0), 0);
      break;
    }

    case 'recovery': {
      tablesRead.push('ziko_sleep_logs');
      const { data } = await db
        .from('ziko_sleep_logs')
        .select('date, duration_hours')
        .eq('user_id', userId)
        .gte('date', windowStartDate)
        .lte('date', windowEndDate);
      const rows = (data ?? []) as Array<{ date: string; duration_hours: number | null }>;
      metrics.sleep_log_days = new Set(rows.map((r) => r.date)).size;
      const totalHours = rows.reduce((sum, r) => sum + (Number(r.duration_hours) || 0), 0);
      metrics.avg_duration_hours = rows.length > 0 ? Math.round((totalHours / rows.length) * 10) / 10 : 0;
      break;
    }

    case 'cardio': {
      tablesRead.push('ziko_cardio_sessions');
      const { data } = await db
        .from('ziko_cardio_sessions')
        .select('date, duration_min')
        .eq('user_id', userId)
        .gte('date', windowStartDate)
        .lte('date', windowEndDate);
      const rows = (data ?? []) as Array<{ date: string; duration_min: number | null }>;
      metrics.cardio_sessions_completed = rows.length;
      metrics.total_duration_min = rows.reduce((sum, r) => sum + (Number(r.duration_min) || 0), 0);
      break;
    }

    case 'unassigned':
    default: {
      tablesRead.push('ziko_workout_sessions', 'ziko_habit_logs');
      const [workoutsRes, habitRes] = await Promise.all([
        db
          .from('ziko_workout_sessions')
          .select('started_at')
          .eq('user_id', userId)
          .gte('started_at', windowStartIso)
          .lte('started_at', windowEndIso),
        db
          .from('ziko_habit_logs')
          .select('date')
          .eq('user_id', userId)
          .gte('date', windowStartDate)
          .lte('date', windowEndDate),
      ]);
      metrics.sessions_completed = ((workoutsRes.data ?? []) as unknown[]).length;
      metrics.habit_log_days = new Set(
        ((habitRes.data ?? []) as Array<{ date: string }>).map((r) => r.date),
      ).size;
      break;
    }
  }

  return {
    focus_type: focusType,
    tables_read: tablesRead,
    metrics,
    window_start: windowStartIso,
    window_end: windowEndIso,
    evidence_source: 'real_activity_history',
  };
}

/**
 * Builds the grounded context a weekly review is built from: real activity
 * vs. assigned focus, a deterministic met verdict computed in backend
 * arithmetic (never the model), and the athlete's decision history
 * including the de-escalation pattern-of-misses signal.
 *
 * Returns null when the athlete has no athlete_state row (never onboarded)
 * or no next_review_due_at (not yet reviewable).
 */
export async function fetchWeeklyReviewContext(
  userId: string,
  userToken?: string,
): Promise<WeeklyReviewContext | null> {
  const db = clientForUser(userToken);

  // 1. athlete_state — an athlete with no state row has never been
  //    onboarded and is not reviewable.
  const { data: stateRow } = await db
    .from('ziko_athlete_state')
    .select(
      'next_review_due_at, last_review_at, current_focus_detail, current_focus_summary, readiness, rolling_summary',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (!stateRow) return null;

  const state = stateRow as {
    next_review_due_at: string | null;
    last_review_at: string | null;
    current_focus_detail: Record<string, unknown> | null;
    current_focus_summary: string | null;
    readiness: string;
    rolling_summary: string | null;
  };

  if (!state.next_review_due_at) return null;

  // weekOf is captured HERE, immediately, before anything else in this
  // module runs — never derived from Date.now()/new Date()/CURRENT_DATE at
  // any point. Deriving it lazily would silently break the ENGINE-04
  // idempotency arbiter: the lazy on-open trigger and the Sunday cron fire
  // at different wall-clock times for the same logical review cycle.
  const weekOf = toIsoDate(state.next_review_due_at);

  // 3. parse current_focus_detail into a FocusTarget — focus_type defaults
  //    to 'unassigned' when absent or not one of the six mapped values
  //    (T-44-06: never trust the JSONB value directly for query routing).
  const focusDetail = (state.current_focus_detail ?? {}) as Record<string, unknown>;
  const rawFocusType = focusDetail.focus_type;
  const focusType: FocusType =
    typeof rawFocusType === 'string' && MAPPED_FOCUS_TYPES.has(rawFocusType as FocusType)
      ? (rawFocusType as FocusType)
      : 'unassigned';
  const focus: FocusTarget = {
    focus_type: focusType,
    target_metric: typeof focusDetail.target_metric === 'string' ? focusDetail.target_metric : null,
    target_value: typeof focusDetail.target_value === 'number' ? focusDetail.target_value : null,
  };

  // 4. bounded recent window — RAW 12 rows across all decision types, not a
  //    bare 4-row read. One escalate/de-escalate cycle writes a
  //    weekly_focus row AND a program_created row (and sometimes a
  //    goal_created row), so a bare 4-row read can contain as few as two
  //    real weekly_focus entries after two such cycles, starving step 7's
  //    2-of-last-3 rule of the data D-05 depends on. recentDecisions (the
  //    prompt-facing slice) stays at 4 rows — the FOUND-05 convention.
  const { data: decisionsData } = await db
    .from('ziko_athlete_decisions')
    .select('decision_type, week_of, summary, outcome, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);
  const rawDecisions = (decisionsData ?? []) as RecentDecision[];
  const recentDecisions = rawDecisions.slice(0, 4);

  // 5. activity window covers the review cycle that just closed
  //    (last_review_at through next_review_due_at), not a rolling "last 7
  //    days from now".
  const windowEndIso = state.next_review_due_at;
  const windowStartIso =
    state.last_review_at ?? new Date(new Date(windowEndIso).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const activity = await fetchFocusScopedActivity(
    db,
    userId,
    focusType,
    windowStartIso,
    windowEndIso,
    focus.target_metric,
  );

  // 6. FocusComparison — exact-or-exceed, no tolerance band, no rounding
  //    slack (D-07). A missing target is null, never false.
  const actualValue =
    focus.target_metric !== null && focus.target_value !== null
      ? activity.metrics[focus.target_metric] ?? null
      : null;
  const comparison: FocusComparison = {
    target_metric: focus.target_metric,
    target_value: focus.target_value,
    actual_value: actualValue,
    met: focus.target_value === null || actualValue === null ? null : actualValue >= focus.target_value,
  };

  // 7. missPattern — filtered by decision_type BEFORE slicing to three, and
  //    read from the RAW 12-row window, not the 4-row recentDecisions
  //    slice, so interleaved program_created/goal_created rows never dilute
  //    the athlete's real last three weekly reviews (D-05).
  //    [ASSUMED] 2-of-3 window, see 44-RESEARCH.md Open Question 2.
  const lastThreeWeeklyFocus = rawDecisions.filter((d) => d.decision_type === 'weekly_focus').slice(0, 3);
  const missed = lastThreeWeeklyFocus.filter(
    (d) => (d.outcome as { met?: boolean } | null)?.met === false,
  ).length;
  const missPattern = {
    window: lastThreeWeeklyFocus.length,
    missed,
    pattern_of_misses: missed >= 2,
  };

  return {
    userId,
    state: {
      readiness: state.readiness,
      current_focus_summary: state.current_focus_summary,
      current_focus_detail: focusDetail,
      rolling_summary: state.rolling_summary,
      next_review_due_at: state.next_review_due_at,
    },
    weekOf,
    focus,
    activity,
    comparison,
    recentDecisions,
    missPattern,
  };
}
