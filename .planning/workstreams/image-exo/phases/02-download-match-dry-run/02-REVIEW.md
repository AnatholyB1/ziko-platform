---
phase: 02-download-match-dry-run
reviewed: 2026-08-15T13:05:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - scripts/exercise-import/README.md
  - scripts/exercise-import/fetch.ts
  - scripts/exercise-import/lib/check-report.ts
  - scripts/exercise-import/lib/matcher.test.ts
  - scripts/exercise-import/lib/matcher.ts
  - scripts/exercise-import/lib/normalize.test.ts
  - scripts/exercise-import/lib/normalize.ts
  - scripts/exercise-import/lib/paths.ts
  - scripts/exercise-import/lib/report.test.ts
  - scripts/exercise-import/lib/report.ts
  - scripts/exercise-import/lib/supabase-client.test.ts
  - scripts/exercise-import/lib/supabase-client.ts
  - scripts/exercise-import/lib/types.test.ts
  - scripts/exercise-import/lib/types.ts
  - scripts/exercise-import/lib/verify.test.ts
  - scripts/exercise-import/lib/verify.ts
  - scripts/exercise-import/match.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-15T13:05:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the download/match dry-run pipeline (`fetch.ts`, `match.ts`, and the
`lib/**` modules) with particular focus on the three areas called out in
scope: the zero-write guarantee, publishable-key-only Supabase access,
path-traversal safety, and matcher tier-precedence correctness.

**Zero-write guarantee: verified clean.** Grepped every `.ts` file in scope
for `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(`, `.storage.` — no
matches in any non-test file. `fetch.ts` performs no Supabase access at all.
`match.ts` only calls `fetchAllProductionExercises`, a `select`-only read.

**Publishable-key-only: verified clean.** `lib/supabase-client.ts` reads only
`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`; `SUPABASE_SERVICE_KEY` appears
nowhere in source, only in the README's explicit "never use this" warning.

**Path-traversal safety: verified clean.** `lib/verify.ts`'s
`resolveInsideRoot` correctly uses `path.resolve` + a separator-aware
`startsWith` check (not a bare prefix compare), and is defense-in-depth
behind the `lib/types.ts` regex constraints on `image`/`gif_url`. Both layers
are exercised by dedicated tests, including a "regex-passes-but-still-escapes"
case.

**Matcher tier logic: one BLOCKER found.** `categorizeAll` in `lib/matcher.ts`
can produce an `ambiguous` row whose `candidates` array still references a
production `exercise_id` that a *different* dataset record has already
claimed in `matched`, within the same run. This was reproduced directly
against the exported `categorizeAll` function (see CR-01) — it is not a
theoretical concern. Since Phase 3 is documented to trust this report's
categorization to decide `UPDATE` vs `INSERT`, a human approving that stale
candidate would produce two independent claims on one production row.
`lib/check-report.ts`'s structural checks do not currently catch this
overlap either (WR-01).

All 89 existing unit tests pass (`npm run test:import`); none of them
exercise the specific cross-record/cross-tier overlap in CR-01.

## Critical Issues

### CR-01: Ambiguous candidates can reference a production row already claimed by `matched` (stale/double-claim risk)

**File:** `scripts/exercise-import/lib/matcher.ts:311-318` (also applies to the Tier 2 branch at `:344-351` and the Tier 3 branch at `:362-369`)
**Issue:**

`categorizeAll` pushes a row to `ambiguous` (Tier 1 name-collision, Tier 2
multi-candidate, or Tier 3 attribute-overlap) as a **snapshot** — the
`candidates` array is captured at push time and never revisited. Crucially,
none of the three `ambiguous` branches add their candidate rows' ids to the
`consumed` set. That leaves every row referenced in an already-pushed
`ambiguous` row's `candidates` fully eligible to be claimed later in the
*same pass* (Tier 1 collision candidates are never removed from the Tier 2/3
pool at all) or in a *later pass* (Tier 2's own multi-candidate rows remain
claimable by Tier 3 for a different dataset record).

Concretely: if production has two rows sharing a duplicate name (`X`, `Y`,
both `"Foo"`) and a dataset record `A` also named `"Foo"` hits the Tier 1
collision branch, the resulting ambiguous row's candidates are `[X, Y]`. If
a *different* dataset record `G` later in the same Pass 1 iteration exactly
matches `X` via `name_fr` (a single-row Tier 1 hit, unrelated to the
collision), `X` gets pushed into `matched` and added to `consumed` — but the
already-pushed ambiguous row for `A` still lists `X` as an available
candidate. The report now contains `X` in both `matched` (auto-approved) and
as a live candidate in an `ambiguous` row awaiting human approval. If the
reviewer approves `A`'s ambiguous row with `{"action":"match","exercise_id":"<X>"}`,
Phase 3 would see two independent claims on the same production row.

Verified directly against the exported `categorizeAll` (reproduction removed
after confirming; not left in the repo):

```
matched:    [{ "dataset_id": "0002", "exercise_id": "prod-X", ... }]
ambiguous:  [{ "dataset_id": "0001", "candidates": [
                { "exercise_id": "prod-X", ... },   // <-- already matched above!
                { "exercise_id": "prod-Y", ... }
              ] }]
OVERLAP between matched and ambiguous candidates (should be empty): [ 'prod-X' ]
```

This is not limited to Tier 1: the same snapshot-without-reservation pattern
exists for the Tier 2 (`:344-351`) and Tier 3 (`:362-369`) ambiguous
branches — any row offered as a candidate in an earlier-pushed ambiguous row
can be silently claimed by a later dataset record in the same run, and
nothing downstream (not `buildReport`, not `checkReport`) currently detects
or flags it.

**Fix:** After all three passes complete (or as a final reconciliation step
in `categorizeAll`), filter every `ambiguous` row's candidates against the
final `consumed` set and surface the discrepancy instead of silently leaving
a stale candidate in the report — e.g.:

```ts
// after Pass 1–3, before returning from categorizeAll:
const reconciledAmbiguous = ambiguous.map((row) => {
  const staleCandidateIds = row.candidates
    .filter((c) => consumed.has(c.exercise_id))
    .map((c) => c.exercise_id);
  if (staleCandidateIds.length === 0) return row;
  return {
    ...row,
    candidates: row.candidates.filter((c) => !consumed.has(c.exercise_id)),
    reason: `${row.reason}+candidate-claimed-elsewhere`, // or a dedicated flag
  };
});
```

A simpler, more conservative alternative: reserve every id that ever appears
in *any* ambiguous row's candidates (across all tiers) by adding it to
`consumed` at push time, so no later dataset record in the same run can
auto-claim a row that a human still needs to adjudicate. Either approach
needs a corresponding unit test asserting
`matched.exercise_id ∩ ambiguous[].candidates[].exercise_id === ∅` across a
fixture shaped like the one above.

## Warnings

### WR-01: `check-report.ts` does not detect matched/ambiguous-candidate overlap

**File:** `scripts/exercise-import/lib/check-report.ts:134-155`
**Issue:** `checkReport` already checks that no `exercise_id` appears in both
`matched` and `unmatched_legacy` (lines 134-141), and that no `exercise_id`
repeats within `matched` itself (lines 147-155) — but it has no equivalent
check for `matched` vs. `ambiguous[].candidates`, which is exactly the
invariant CR-01 violates. Given this file's stated purpose ("a caller
iterating on a broken report needs to see everything wrong with it in one
pass"), this is a real gap in the one tool meant to catch this class of
problem before a human reviews the report.
**Fix:**
```ts
const matchedExerciseIds = new Set(matched.map((row) => row.exercise_id));
for (const row of ambiguous) {
  const candidates = asArray(row.candidates);
  for (const candidate of candidates) {
    if (matchedExerciseIds.has(candidate.exercise_id)) {
      problems.push(
        `ambiguous row ${String(row.dataset_id)} offers candidate ` +
          `${String(candidate.exercise_id)}, which is already claimed in matched`,
      );
    }
  }
}
```

### WR-02: Prior report is trusted without schema validation, risking an uncaught crash on a malformed edit

**File:** `scripts/exercise-import/match.ts:47-60`, `scripts/exercise-import/lib/report.ts:112-151`
**Issue:** `readPriorReport` only guards against a JSON-parse failure — a
successfully-parsed-but-wrong-shape prior report (e.g. an old-schema file, or
a reviewer who hand-edits `match-report.json` and deletes the
`human_decision` key entirely instead of leaving it `null`) is returned as-is
and typed as `MatchReport` via a bare `as MatchReport` cast, with no runtime
check. `mergePriorHumanDecisions` (report.ts:127) then only special-cases
`prior.human_decision === null`; if the field is `undefined` (missing key)
rather than `null`, the check is false, `carriedForward` is incremented, and
`priorDecision.action` (report.ts:135) throws a `TypeError` on `undefined`.
This crash escapes to `main().catch()` in match.ts and exits the process —
not a silent-corruption risk, but it is an uncaught, unhelpful crash for a
very plausible human-editing mistake, in a codepath whose docstring claims
"never a crash."
**Fix:** Validate the parsed prior report with
`MatchReportSchema.safeParse(parsed)` in `readPriorReport` and return `null`
(with the existing warning log) on failure, consistent with how a
JSON-parse failure is already handled:
```ts
function readPriorReport(path: string): MatchReport | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = MatchReportSchema.safeParse(parsed);
    if (!result.success) {
      console.warn(`Warning: existing report at ${path} failed schema validation — treating as no prior report.`);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn(`Warning: could not parse existing report at ${path} as JSON — treating as no prior report. (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
}
```

### WR-03: `unmatched_new` is not sorted deterministically like the other three report categories

**File:** `scripts/exercise-import/lib/report.ts:49-56`
**Issue:** `buildReport` explicitly sorts `matched` by `dataset_id` (line 50),
`unmatched_legacy` by `production_name` (line 59), and `ambiguous` by
top-candidate score (line 63) — but `unmatched_new` (line 53) is passed
through with only a `.map()`, no `.sort()`. Its order in the JSON/Markdown
output is therefore whatever order Pass 3 of `categorizeAll` happens to
produce it in (dataset input order minus everything consumed earlier), not
an explicit, self-documenting ordering contract like the other three
sections. This is inconsistent with the rest of the module and makes
report-to-report diffs (after an upstream dataset reorder) harder to read
than necessary.
**Fix:**
```ts
const unmatched_new: ReportUnmatchedNewRow[] = [...categorized.unmatched_new]
  .sort((a, b) => compareStrings(a.dataset_id, b.dataset_id))
  .map((row) => ({ ...row, phase3_status: PHASE3_STATUS_HINT.unmatched_new }));
```

## Info

### IN-01: Tier 1 name-collision candidates are silently capped at 3, hiding larger duplicate groups from the collision report

**File:** `scripts/exercise-import/lib/matcher.ts:316`
**Issue:** `tier1.rows.slice(0, 3)` caps the reported candidates the same way
Tier 2/3 do (per D-09), but for Tier 1 this can hide a genuine 4th+
production row sharing an identical normalized name: that row is neither
`consumed` nor in `ambiguousCandidateIds` (since it was sliced off before
that set is built at matcher.ts:383-386), so it falls through to
`unmatched_legacy` with no indication it was part of a name collision.
Impact is limited — both categories resolve to `phase3_status: 'needs_review'`
— but the reviewer loses visibility into the fact that row is a duplicate.
**Fix:** Either raise `MAX_AMBIGUOUS_CANDIDATES`/D-09's cap for this specific
case, or add the overflow ids to `duplicate_production_names` (which already
exists for exactly this purpose) so they're not silently reclassified.

### IN-02: `unmatched_legacy` sort is case-sensitive, which can produce a non-alphabetical-looking order

**File:** `scripts/exercise-import/lib/report.ts:34-36, 59`
**Issue:** `compareStrings` uses raw `<`/`>` on `production_name`, which is a
UTF-16 code-unit comparison — all uppercase letters sort before all
lowercase letters (e.g. `"Zebra Curl"` sorts before `"apple Press"`). Given
production exercise names are generally consistent Title Case this is
unlikely to matter in practice, but it's worth a locale-aware or
`.toLowerCase()`-normalized comparator if report readability for reviewers
matters.
**Fix:** `a.toLowerCase() < b.toLowerCase() ? -1 : ...` or
`a.localeCompare(b)`.

### IN-03: `AmbiguousRowSchema.candidates` has no minimum-length constraint

**File:** `scripts/exercise-import/lib/types.ts:179-187`
**Issue:** `candidates: z.array(CandidateSchema).max(3)` caps at 3 but does
not require at least 1. `categorizeAll` never currently produces an empty
`candidates` array for an ambiguous row (Tier 1 collision implies ≥2, Tier 2
multi implies ≥2, Tier 3 implies ≥1), so this isn't presently exploitable,
but the schema doesn't encode that invariant, so a future refactor could
silently violate it without a type/schema-level signal.
**Fix:** `z.array(CandidateSchema).min(1).max(3)`.

---

_Reviewed: 2026-08-15T13:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
