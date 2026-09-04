---
phase: 44-weekly-adaptive-decision-engine
reviewed: 2026-09-04T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - supabase/migrations/20260902100000_athlete_goals.sql
  - supabase/migrations/20260902100100_ai_cost_log_source.sql
  - supabase/migrations/20260902100200_record_athlete_decision_v2.sql
  - backend/api/src/coaching-engine/db.ts
  - backend/api/src/coaching-engine/types.ts
  - backend/api/src/coaching-engine/context.ts
  - backend/api/src/coaching-engine/decide.ts
  - backend/api/src/coaching-engine/tools.ts
  - backend/api/src/coaching-engine/apply.ts
  - backend/api/src/coaching-engine/routes.ts
  - backend/api/src/tools/registry.ts
  - backend/api/src/app.ts
  - backend/api/vercel.json
  - backend/api/test/tools/coaching-engine.spec.ts
  - backend/api/test/routes/coaching-engine.spec.ts
  - backend/api/test/rls/athlete-goals.spec.ts
  - backend/api/test/rls/athlete-decisions.spec.ts
  - backend/api/test/rls/weekly-review-duplicate-fire.spec.ts
  - packages/plugin-sdk/src/i18n.ts
  - apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx
  - apps/mobile/app/(app)/_layout.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-09-04
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 44 reuses well-established patterns from Phase 42/43 (`generateObject` + Anthropic schema sanitizer, `record_athlete_decision()` as the sole write door, `waitUntil()` fire-and-forget) carefully and mostly correctly. The `week_of`-capture discipline (never derived from wall-clock time) is genuinely enforced end-to-end in `context.ts`/`apply.ts`, the `DROP FUNCTION` overload-hazard fix in the RPC migration is correct (verified the dropped 9-arg signature exactly matches the live Phase 42 signature), and the idempotency guarantee is proven with a real concurrent-fire integration test.

The most serious finding is a **fail-open authentication bug** in the new Sunday-cron route: if `CRON_SECRET` is ever unset in the deploy environment, `POST /coaching-engine/cron/weekly-review` accepts requests with no authentication at all, letting anyone trigger AI-decision writes and cost spend for up to 40 athletes per call. This pattern is copied verbatim from an existing cron (`coach/ai/service.ts`), so it isn't newly invented, but it is newly propagated into brand-new production code in this phase, and the phase's own test suite only exercises the guard when `CRON_SECRET` is set — the fail-open path is untested.

Two further issues degrade product/data quality without being outright security bugs: a redundant `dismissed` boolean in `WeeklyReviewRevealOverlay.tsx` permanently suppresses the "Ziko reviewed your week" reveal for any review completed after the first one shown in a given app process lifetime (defeating D-03's intent for long-lived sessions), and `decide.ts` lacks defensive enforcement for the case where a model sets `call_create_program: true` without a matching `new_focus_detail`, which the reverse case (`hold` forcing both fields off) is explicitly guarded against but this direction is not.

## Critical Issues

### CR-01: Weekly-review cron endpoint has no authentication when `CRON_SECRET` is unset

**File:** `backend/api/src/coaching-engine/routes.ts:47-52`
**Issue:** The CRON_SECRET guard is:
```ts
router.post('/cron/weekly-review', async (c) => {
  const authHeader = c.req.header('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  ...
```
If `process.env.CRON_SECRET` is falsy (unset, empty string, or fails to load in some deploy environment), the `if` condition short-circuits to `false` and the entire auth check is skipped — the route falls straight through to the eligibility scan and `Promise.allSettled` batch of `runWeeklyReview()` calls with **zero authentication**. This route is deliberately mounted before `router.use('*', authMiddleware)` (necessarily, since Vercel Cron doesn't send a user JWT), so there is no secondary auth layer catching this. An attacker who discovers the endpoint could repeatedly POST to it, forcing real Claude Sonnet calls (cost) and `athlete_state`/`athlete_decisions` writes for up to 40 due athletes per call, with no rate limit beyond `CRON_BATCH_SIZE`.

This pattern is copied from the pre-existing `coach/ai/service.ts` `monitor-cron` route (same fail-open shape), so it isn't a new invention — but it's newly reproduced in this phase's brand-new file, and `backend/api/test/routes/coaching-engine.spec.ts` only asserts the 401 behavior when `CRON_SECRET` is explicitly set (line 106, 168) — there is no test coverage for the unset-secret case, so a regression or missing env var in production would go undetected by CI.

**Fix:** Fail closed instead of fail open — reject the request whenever `CRON_SECRET` is not configured, rather than silently allowing everything through:
```ts
router.post('/cron/weekly-review', async (c) => {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = c.req.header('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  ...
```
Add a route-level test asserting `CRON_SECRET` unset → 401 (not just `CRON_SECRET` set + missing header → 401). Consider flagging the same fail-open shape in `coach/ai/service.ts`'s `monitor-cron` for a follow-up fix, since it shares the same defect.

## Warnings

### WR-01: `WeeklyReviewRevealOverlay`'s `dismissed` flag permanently suppresses future review reveals within an app session

**File:** `apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx:29, 58, 60-66`
**Issue:** The overlay's visibility is gated by two independent mechanisms that are supposed to cooperate but instead conflict:
```ts
const [dismissed, setDismissed] = useState(false);
...
const isNewReview =
  !!data?.last_review_at && !!data?.current_focus_summary &&
  seenMarker !== undefined && data.last_review_at !== seenMarker;
const isVisible = isNewReview && !dismissed;

const dismiss = () => {
  if (data?.last_review_at) {
    appStorage.set(SEEN_MARKER_KEY, data.last_review_at);
    setSeenMarker(data.last_review_at);
  }
  setDismissed(true);
};
```
`seenMarker` already correctly tracks "which review was last acknowledged" — once `dismiss()` runs, `seenMarker` is updated to the current `last_review_at`, which alone makes `isNewReview` false for that review and would correctly flip back to `true` the moment a genuinely new review completes (`data.last_review_at` changes again). The extra `dismissed` boolean, however, is set once and **never reset** for the lifetime of the mounted component. Because `isVisible` ANDs both conditions, once an athlete dismisses their first weekly-review reveal in a given app session, `dismissed` stays `true` for every subsequent review that completes while the app process remains alive (foreground/background cycling without a full process kill — common on iOS with ample free memory, and on Android with battery-optimization exemptions). D-03's stated intent ("the athlete gets a brief in-app... moment" on every completed review, "rather than a silent state update") is silently violated for every review after the first one shown per app-process lifetime.

**Fix:** Remove the redundant `dismissed` state entirely and rely on the `seenMarker`/`last_review_at` comparison alone, which already handles both "not yet shown" and "already shown, don't re-show" correctly without needing a separate flag:
```ts
const dismiss = () => {
  if (data?.last_review_at) {
    appStorage.set(SEEN_MARKER_KEY, data.last_review_at);
    setSeenMarker(data.last_review_at);
  }
};
const isVisible = isNewReview;
```

### WR-02: `decide.ts` doesn't defensively guard against `call_create_program: true` with a null/missing `new_focus_detail`

**File:** `backend/api/src/coaching-engine/decide.ts:148-153`
**Issue:** The existing defensive check only covers one direction of the invariant:
```ts
if (decision.trajectory === 'hold') {
  decision.call_create_program = false;
  decision.new_focus_detail = null;
}
```
There is no corresponding guard for the model returning `trajectory: 'escalate'|'de-escalate'`, `call_create_program: true`, and `new_focus_detail: null` (a schema-valid combination — `new_focus_detail` is `.nullable()`, not required to be non-null when `call_create_program` is true). If this happens, `apply.ts` (line 218-229) calls `create_program({ focus_summary, ...(decision.new_focus_detail ?? {}), rationale, source }, ...)` with `focus_type`/`target_metric`/`target_value` all `undefined`. Because `undefined`-valued object keys are dropped by JSON serialization before the RPC call, the resulting `program_created` decision row records no target data, and `current_focus_detail`'s existing `focus_type`/`target_metric`/`target_value` are silently left at their stale prior values (the spread of `{}` doesn't touch them) — an unlabeled program-change event with no actual program change, and a `current_focus_summary` update that no longer matches the (unchanged) targets.
**Fix:** Mirror the existing hold-case defensive pattern in the opposite direction:
```ts
if (decision.trajectory !== 'hold' && decision.call_create_program === true && !decision.new_focus_detail) {
  decision.call_create_program = false; // don't call create_program with nothing to write
}
```

### WR-03: `create_goal`/`create_program`'s real-evidence window uses wall-clock "now" instead of the review's captured window, inconsistent with the phase's own no-wall-clock discipline

**File:** `backend/api/src/coaching-engine/tools.ts:72-75`
**Issue:** `buildRealEvidence()` computes its activity window as:
```ts
const windowEndIso = new Date().toISOString();
const windowStartIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
```
For the interactive-chat call path this is reasonable (a live conversation should ground on "the last real week"). But `apply.ts` also calls `create_program` directly as part of the *same* weekly-review flow that already computed a specific, non-wall-clock window (`context.activity.window_start`/`window_end`, derived from `last_review_at`/`next_review_due_at`). When the lazy on-open trigger fires several days after the review became due (an explicitly anticipated scenario per D-01/D-02), the `weekly_focus` decision's evidence window and the `program_created` decision's evidence window for the *same* review event will disagree — the former reflects the actual review cycle, the latter reflects "the 7 days ending right now." This doesn't break idempotency (program_created is `week_of: null`, exempt from the arbiter) but does undermine the FOUND-02 grounding-consistency intent within a single review's audit trail.
**Fix:** Thread the review's already-computed window (or at minimum `context.weekOf`) into the `create_program` call from `apply.ts` so the two decision rows for one review event are grounded in the same window, reserving `buildRealEvidence()`'s wall-clock-now behavior for the standalone interactive-chat tool-call path.

## Info

### IN-01: Minor rounding inconsistency across `fetchFocusScopedActivity` metrics

**File:** `backend/api/src/coaching-engine/context.ts:115-117, 188, 202-203`
**Issue:** `total_volume_kg` and `avg_duration_hours` are rounded (`Math.round(...)`), but `total_ml` (hydration) is not (`rows.reduce(...)` with no rounding). Not a functional bug (hydration is naturally an integer-ml sum in practice), but inconsistent enough to look unintentional on a future read.
**Fix:** Apply the same rounding convention uniformly, or drop it from the other two metrics if it isn't actually needed.

### IN-02: `current_focus_detail` JSONB concatenation is not resilient to an explicit JSON `null` in `p_state_patch`

**File:** `supabase/migrations/20260902100200_record_athlete_decision_v2.sql:118-127`
**Issue:** `COALESCE(p_state_patch->'current_focus_detail', current_focus_detail) || CASE ... END` uses the `->` (JSONB) arrow, so `COALESCE` only falls back to the column's current value when the key is *absent* from `p_state_patch` — not when the caller sends `"current_focus_detail": null` explicitly (a JSON `null` scalar is not SQL `NULL`). If any future caller ever sends that literal, `'null'::jsonb || jsonb_build_object(...)` is not guaranteed to behave as a merge (JSONB `||` concatenation between a scalar and an object is undefined/errors in Postgres). None of the current TS callers (`apply.ts`, `tools.ts`) construct a patch this way today, so this is not presently reachable, but it's a latent trap for the next caller of this RPC.
**Fix:** Consider `NULLIF(p_state_patch->'current_focus_detail', 'null'::jsonb)` in the `COALESCE` to normalize an explicit JSON null to the "absent" behavior, or document the constraint in the function's `COMMENT`.

---

_Reviewed: 2026-09-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
