// Phase 44 (v1.18, weekly-adaptive-decision-engine) — coaching-engine module.
// No runtime code — interfaces/types only, the shared contract every later
// plan in this phase (44-02 through 44-06) compiles against.

/**
 * The six mapped focus categories (D-08 closed-set mapping) plus the
 * unassigned case for an athlete whose current_focus_detail has no
 * recognised focus_type yet.
 */
export type FocusType =
  | 'training_volume'
  | 'habit_consistency'
  | 'nutrition'
  | 'hydration'
  | 'recovery'
  | 'cardio'
  | 'unassigned';

/**
 * The parsed shape of athlete_state.current_focus_detail — what the
 * athlete's current focus actually targets, and by how much.
 */
export interface FocusTarget {
  focus_type: FocusType;
  target_metric: string | null;
  target_value: number | null;
}

/**
 * The real-activity aggregation result for one focus-scoped review window.
 * tables_read exists so the evidence payload records which tables were
 * actually queried, which is what makes the D-08 "only the mapped table(s)"
 * claim auditable after the fact.
 */
export interface FocusScopedActivity {
  focus_type: FocusType;
  tables_read: string[];
  metrics: Record<string, number>;
  window_start: string;
  window_end: string;
  evidence_source: 'real_activity_history';
}

/**
 * The deterministic, backend-computed "met" verdict (D-07: exact-or-exceed,
 * no tolerance band). met is null (not false) whenever no target was
 * assigned — a missing target is not a miss.
 */
export interface FocusComparison {
  target_metric: string | null;
  target_value: number | null;
  actual_value: number | null;
  met: boolean | null;
}

/** A single row read from the bounded athlete_decisions recent window. */
export interface RecentDecision {
  decision_type: string;
  week_of: string | null;
  summary: string;
  outcome: Record<string, unknown>;
  created_at: string;
}

/**
 * The full grounded context a weekly review is built from — real activity
 * vs. assigned focus, a deterministic met verdict, and the athlete's
 * decision history including the de-escalation pattern signal.
 */
export interface WeeklyReviewContext {
  userId: string;
  state: {
    readiness: string;
    current_focus_summary: string | null;
    current_focus_detail: Record<string, unknown>;
    rolling_summary: string | null;
    next_review_due_at: string | null;
  };
  weekOf: string;
  focus: FocusTarget;
  activity: FocusScopedActivity;
  comparison: FocusComparison;
  recentDecisions: RecentDecision[];
  missPattern: {
    window: number;
    missed: number;
    pattern_of_misses: boolean;
  };
}

/**
 * The structured decision `generateObject` produces (plan 44-03) and
 * `apply.ts` writes (plan 44-04) — defined once here so neither plan has to
 * infer it independently.
 */
export interface WeeklyDecisionResult {
  trajectory: 'escalate' | 'hold' | 'de-escalate';
  new_readiness: 'fragile' | 'building' | 'ready';
  new_focus_summary: string;
  rationale: string;
  call_create_program: boolean;
  new_focus_detail: {
    focus_type: FocusType;
    target_metric: string;
    target_value: number;
  } | null;
}
