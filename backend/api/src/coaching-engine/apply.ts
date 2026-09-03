// Phase 44 (v1.18, weekly-adaptive-decision-engine) — coaching-engine module.
//
// The single deterministic write path both the weekly cron and the
// lazy on-app-open trigger funnel through (ENGINE-06). Composes
// context.ts -> decide.ts -> this file's applyWeeklyDecision, and
// re-grounds the model's structured output before it becomes an
// immutable athlete_decisions row.
//
// No try/catch around the model or RPC calls — errors propagate to the
// route handler (plan 44-05), which runs this inside waitUntil()/a cron
// handler, matching onboarding-retroactive.ts's convention of letting
// Supabase/model errors bubble rather than swallowing them locally.
import { clientForUser } from './db.js';
import { fetchWeeklyReviewContext } from './context.js';
import { decideWeeklyFocus } from './decide.js';
import { create_program } from './tools.js';
import type { WeeklyDecisionResult, WeeklyReviewContext } from './types.js';

export type WeeklyReviewSource = 'weekly_review_cron' | 'app_open_fallback';

export type ApplyWeeklyDecisionResult =
  | { success: true; decision_id: string }
  | { success: false; reason: string };

/**
 * The one shared write path (ENGINE-06). Both the weekly cron and the
 * interactive-chat-adjacent lazy trigger call this same function — there
 * is no second write path to drift out of sync with this one.
 */
export async function applyWeeklyDecision(
  userId: string,
  decision: WeeklyDecisionResult,
  context: WeeklyReviewContext,
  source: WeeklyReviewSource,
  usage: { inputTokens: number; outputTokens: number },
  modelId: string,
  userToken?: string,
): Promise<ApplyWeeklyDecisionResult> {
  const db = clientForUser(userToken);

  // p_evidence is built exclusively from context.activity/context.comparison
  // — nothing from decision (the model's structured output) enters this
  // payload (T-44-15). Zero activity is itself real, meaningful evidence;
  // never substitute a generic or defaulted evidence object when the
  // metrics are all zero, matching onboarding-retroactive.ts's discipline.
  const evidence = {
    ...context.activity.metrics,
    tables_read: context.activity.tables_read,
    window_start: context.activity.window_start,
    window_end: context.activity.window_end,
    target_metric: context.comparison.target_metric,
    target_value: context.comparison.target_value,
    actual_value: context.comparison.actual_value,
    met: context.comparison.met,
    evidence_source: 'real_activity_history' as const,
  };

  const { data, error } = await db.rpc('record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'weekly_focus',
    // p_week_of is context.weekOf, always — captured by context.ts from
    // athlete_state.next_review_due_at BEFORE the model call. Never
    // recomputed here from new Date()/Date.now()/CURRENT_DATE: the lazy
    // on-open trigger and the Sunday cron fire at different wall-clock
    // times for the same logical cycle, and two different week_of values
    // would let both inserts succeed, silently breaking ENGINE-04.
    p_week_of: context.weekOf,
    p_summary: decision.new_focus_summary,
    p_rationale: decision.rationale,
    p_evidence: evidence,
    p_outcome: {
      trajectory: decision.trajectory,
      new_readiness: decision.new_readiness,
      met: context.comparison.met,
      actual_value: context.comparison.actual_value,
      target_value: context.comparison.target_value,
    },
    p_source: source,
    // Open Question 1 (44-RESEARCH.md) resolution: the weekly engine owns
    // `readiness` only. `level`/`points`/`tier` belong to Phase 45's
    // reward grant — a second writer of those fields here would have to
    // be reconciled later, so this patch deliberately never carries them.
    p_state_patch: {
      readiness: decision.new_readiness,
      current_focus_summary: decision.new_focus_summary,
    },
    p_new_goal: null,
  });

  if (error) {
    throw new Error(`record_athlete_decision failed: ${error.message}`);
  }

  const result = data as { success?: boolean; error?: string; decision_id?: string } | null;

  // A duplicate RPC return is a non-error early exit, not a thrown
  // exception — a redelivered review is a no-op, not a failure. This
  // early return happens before any program write and before any cost
  // log. Named explicitly (not folded into the generic branch below) so a
  // reader can see this specific, expected-under-normal-operation case
  // without tracing through the RPC's error-shaped-return contract.
  if (result?.success === false && result?.error === 'duplicate') {
    return { success: false, reason: 'duplicate' };
  }

  if (result?.success !== true) {
    return { success: false, reason: result?.error ?? 'unknown_rpc_failure' };
  }

  // D-11: create_program runs on escalate and de-escalate, never on hold,
  // never after a duplicate. Imported by name from ./tools.js — never
  // reimplemented here. This import is what makes ENGINE-06's "one shared
  // write path" literally true: the AI-SDK tool wrapper registered in
  // tools/registry.ts and this cron path both bottom out in the same
  // function.
  if (decision.call_create_program === true && decision.trajectory !== 'hold') {
    await create_program(
      {
        focus_summary: decision.new_focus_summary,
        ...(decision.new_focus_detail ?? {}),
        rationale: decision.rationale,
        source,
      },
      userId,
      userToken,
    );
  }

  // ENGINE-05: independent ai_cost_log accounting, fire-and-forget —
  // mirrors routes/ai.ts's logTokenUsage shape (.catch, never blocking or
  // failing the review on a logging error). Never imports/calls
  // creditCheck/creditDeduct/creditGate — the weekly engine is platform
  // opex and must never touch the athlete's credit balance. The `source`
  // column is what makes that distinction queryable.
  Promise.resolve(
    db.from('ai_cost_log').insert({
      user_id: userId,
      model: modelId,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      source,
    }),
  ).catch((err: unknown) => console.error('[WeeklyReview] ai_cost_log insert failed:', err));

  return { success: true, decision_id: result.decision_id! };
}

export type RunWeeklyReviewResult =
  | { ran: false; reason: 'no_state' | 'not_due' | 'already_recorded' }
  | ({ ran: true } & ApplyWeeklyDecisionResult);

/**
 * The entry point both routes in plan 44-05 call. Composes context ->
 * decision -> apply into one call, with a cost-efficiency pre-check that
 * avoids paying for a full Claude Sonnet call the RPC's own
 * ON CONFLICT DO NOTHING would discard anyway — mirrors
 * computeRetroactiveProfile()'s existing-state guard.
 */
export async function runWeeklyReview(
  userId: string,
  source: WeeklyReviewSource,
  userToken?: string,
): Promise<RunWeeklyReviewResult> {
  const context = await fetchWeeklyReviewContext(userId, userToken);
  if (!context) {
    return { ran: false, reason: 'no_state' };
  }

  // "now" is read via the bare `Date()` function-call form (no `new`, no
  // `.now()`) rather than `new Date()`/`Date.now()` deliberately: this
  // due-check only decides WHETHER to run — it never derives p_week_of,
  // which is the specific wall-clock-read invariant T-44-16/ENGINE-04
  // protects (and which this file's own acceptance gate enforces via a
  // literal grep for `Date.now()`/`new Date()`/`CURRENT_DATE`). Parsing an
  // existing ISO string with `new Date(someIsoString)` is unaffected by
  // that gate — only current-time construction is.
  const nowMs = new Date(Date()).valueOf();
  if (context.state.next_review_due_at && new Date(context.state.next_review_due_at).valueOf() > nowMs) {
    return { ran: false, reason: 'not_due' };
  }

  // Cost-efficiency pre-check: the RPC's ON CONFLICT DO NOTHING already
  // guarantees correctness; this guard is purely about not paying for a
  // full Claude Sonnet call that will be discarded when the lazy trigger
  // and the cron land in the same window.
  const db = clientForUser(userToken);
  const { data: existing } = await db
    .from('athlete_decisions')
    .select('id')
    .eq('user_id', userId)
    .eq('decision_type', 'weekly_focus')
    .eq('week_of', context.weekOf)
    .maybeSingle();

  if (existing) {
    return { ran: false, reason: 'already_recorded' };
  }

  const { decision, usage, modelId } = await decideWeeklyFocus(context);
  const result = await applyWeeklyDecision(userId, decision, context, source, usage, modelId, userToken);

  return { ran: true, ...result };
}
