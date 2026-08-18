---
phase: 02-test-account-purge
reviewed: 2026-08-14T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - scripts/purge-test-accounts/lib.mjs
  - scripts/purge-test-accounts/dry-run.mjs
  - apps/web/test/purge/purge-lib.test.ts
  - .gitignore
  - scripts/purge-test-accounts/export.mjs
  - scripts/purge-test-accounts/pitr.mjs
  - apps/web/test/purge/purge-export.test.ts
  - scripts/purge-test-accounts/delete.mjs
  - scripts/purge-test-accounts/verify-purge.mjs
  - apps/web/test/purge/purge-delete.test.ts
  - scripts/purge-test-accounts/RUNBOOK.md
  - apps/web/test/purge/purge-rehearsal.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report — Test-Account Purge Toolkit

**Reviewed:** 2026-08-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This is a well-engineered, defensively-written toolkit: `isTestAccountEmail` is a genuine exact-equality
check on the substring after the final `@` (verified — not a substring/regex/LIKE match, confirmed
correct against all four documented lookalikes and the two-`@` edge case), `delete.mjs` defaults to
inert with no code path that can set `confirm` to `true` other than the literal `--confirm` argv flag
(verified by tracing `parsePurgeArgs` → `runDelete` → `main()`; the "no `--confirm`" branch never
constructs a Supabase client or calls `deleteAccount`), and no credential value is ever written into a
log, report, manifest, or PITR `detail` string (verified: `checkPitrStatus`'s `detail` is built only from
HTTP status codes and booleans, per its own T-02-10 comment, and this holds under inspection).

However, cross-checking the two cross-user-relationship registries in this phase
(`CROSS_LINK_SOURCES` in `lib.mjs`, `ORPHAN_SOURCES` in `verify-purge.mjs`) against the actual Supabase
schema surfaces a real gap: only 3 of at least 17 tables in `supabase/migrations/` that pair two
`auth.users` foreign keys are checked. D-05's documented promise — "automatically withholds any
test-domain candidate that is cross-linked to a non-candidate (real) account" — does not hold for the
community/social schema (`friendships`, `screen_reactions`, `shared_programs`, `xp_gifts`,
`coin_gifts`, `habit_encouragements`, `app_invites`) or for most of the coach-CRM schema beyond the
three tables checked (`coach_client_tags`, `coach_client_notes`, `coach_alerts`, `ai_tool_audit`,
`dashboard_configs`, `coach_client_videos`, `coach_metric_thresholds`). This is the review's single
highest-impact finding — see CR-01.

A handful of lower-severity gaps were also found: a manifest-tampering surface not covered by the
SHA-256 hash (only `candidate_ids` is hashed — `pitr.status` and `generated_at`, which the same
integrity guard also gates on, are freely editable without tripping the "manifest may have been
widened" error), a CSV formula-injection gap in the two-person-review artifact, a `--max-manifest-age-minutes`
argument that silently disables the staleness check on non-numeric input (`NaN` comparisons are always
false), and no cross-check between `--report` and `--manifest` in `verify-purge.mjs`.

## Critical Issues

### CR-01: Cross-link detection (D-05) covers only 3 of 17+ cross-user relationship tables — the safety net the RUNBOOK documents does not actually cover most of the schema

**File:** `scripts/purge-test-accounts/lib.mjs:105-109` (`CROSS_LINK_SOURCES`), `scripts/purge-test-accounts/verify-purge.mjs:92-101` (`ORPHAN_SOURCES`)

**Issue:** D-05's stated purpose (per `RUNBOOK.md:43-50` and the doc comments on `fetchCrossLinks`/
`fetchOrphanRows`) is to withhold a test-domain candidate from deletion whenever it is entangled with a
real account through any table pairing two `auth.users` ids, and to prove post-purge that no reference
to a deleted id survives anywhere. The implementation hard-codes exactly three tables:

```js
const CROSS_LINK_SOURCES = [
  { table: 'coach_client_links', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_vocal_feedbacks', columnA: 'coach_id', columnB: 'athlete_id' },
  { table: 'workout_programs', columnA: 'created_by_coach_id', columnB: 'assigned_to_user_id' },
];
```

Grepping every migration for `CREATE TABLE` blocks with two or more columns
`REFERENCES auth.users(id)` (the exact shape `coach_client_links` has) turns up at least 14 more tables
that are **not** in either `CROSS_LINK_SOURCES` or `ORPHAN_SOURCES`:

- `friendships` (`requester_id`, `addressee_id`) — `009_community_schema.sql`
- `app_invites` (`inviter_id`, `used_by`) — `009_community_schema.sql`, `053_referral_schema.sql`
- `screen_reactions` (`sender_id`, `receiver_id`) — `009_community_schema.sql`
- `shared_programs` (`sender_id`, `receiver_id`) — `009_community_schema.sql`
- `xp_gifts` (`sender_id`, `receiver_id`) — `009_community_schema.sql`
- `coin_gifts` (`sender_id`, `receiver_id`) — `009_community_schema.sql`
- `habit_encouragements` (`sender_id`, `receiver_id`) — `009_community_schema.sql`
- `coach_client_tags` (`coach_id`, `client_id`) — `041_coach_client_tags_notes.sql`
- `coach_client_notes` (`coach_id`, `client_id`) — `041_coach_client_tags_notes.sql`
- `coach_alerts` (`coach_id`, `client_id`) — `050_coach_ai_schema.sql`
- `ai_tool_audit` (`coach_id`, `target_client_id`) — `050_coach_ai_schema.sql`
- `dashboard_configs` (`coach_id`, `client_id`) — `056_dashboard_widgets.sql`
- `coach_client_videos` (`athlete_id`, `coach_id`) — `057_coach_videos_schema.sql`
- `coach_metric_thresholds` (`coach_id`, `client_id`) — `063_coach_metric_thresholds.sql`

Concretely, this means: a test-domain coach account (`@ziko-app.com`) that is friends with a real
athlete via `friendships`, has left a note/tag/alert on a real client via `coach_client_notes` /
`coach_client_tags` / `coach_alerts`, has a metric threshold configured for a real client
(`coach_metric_thresholds`), has an uploaded video assigned to a real client
(`coach_client_videos`), or has gifted XP/coins or shared a program with a real user (`xp_gifts`,
`coin_gifts`, `shared_programs`) will be silently deleted by this tool with **no flag, no withholding,
and no post-purge orphan detection** — `classifyAccounts` will place it straight into `to_delete`
because `fetchCrossLinks` never queried any of these tables, and `fetchOrphanRows` will report a clean
zero-orphan scan afterward because it never looks at these tables either. This is exactly the hazard
class D-05 exists to catch (per its own doc comment: "a test account entangled with a real one... the
single most dangerous failure mode of this whole script"), just on tables the implementation never
enumerated. The `ON DELETE CASCADE` on every one of these FK columns (confirmed in each migration)
means the real user's row in that relationship table is permanently destroyed, not merely orphaned.

**Fix:** Extend `CROSS_LINK_SOURCES` (lib.mjs) and `ORPHAN_SOURCES` (verify-purge.mjs) to include every
table with two or more `auth.users` foreign keys, e.g.:

```js
const CROSS_LINK_SOURCES = [
  { table: 'coach_client_links', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_vocal_feedbacks', columnA: 'coach_id', columnB: 'athlete_id' },
  { table: 'workout_programs', columnA: 'created_by_coach_id', columnB: 'assigned_to_user_id' },
  { table: 'friendships', columnA: 'requester_id', columnB: 'addressee_id' },
  { table: 'app_invites', columnA: 'inviter_id', columnB: 'used_by' },
  { table: 'screen_reactions', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'shared_programs', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'xp_gifts', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'coin_gifts', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'habit_encouragements', columnA: 'sender_id', columnB: 'receiver_id' },
  { table: 'coach_client_tags', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_client_notes', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_alerts', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'ai_tool_audit', columnA: 'coach_id', columnB: 'target_client_id' },
  { table: 'dashboard_configs', columnA: 'coach_id', columnB: 'client_id' },
  { table: 'coach_client_videos', columnA: 'athlete_id', columnB: 'coach_id' },
  { table: 'coach_metric_thresholds', columnA: 'coach_id', columnB: 'client_id' },
];
```
and add the mirrored 8 (or more) entries to `ORPHAN_SOURCES`. Since a table could be renamed or a new
cross-user table added in a future migration without anyone remembering to update this list by hand,
also consider a CI/pre-run check (query `information_schema` for any table with two-plus FK columns
into `auth.users` and diff against this hard-coded list) so the list can't silently drift out of sync
with the schema again.

## Warnings

### WR-01: The manifest's SHA-256 hash covers only `candidate_ids` — `pitr.status` and `generated_at` are unauthenticated even though the same integrity guard gates on them

**File:** `scripts/purge-test-accounts/export.mjs:139-164` (`buildManifest`), `scripts/purge-test-accounts/delete.mjs:76-114` (`assertManifestIntegrity`)

**Issue:** `buildManifest` computes `candidate_ids_sha256` only over `candidateIds.join('\n')`. The
export.mjs module doc comment states the intended guarantee broadly: "a manifest edited between review
and execution cannot pass." In practice `assertManifestIntegrity` also gates on `manifest.generated_at`
(staleness, T-02-17) and `manifest.pitr.status` (T-02-18) — but neither field is part of the hash input.
Anyone with write access to the exported manifest JSON (the same access level needed to read it and run
`delete.mjs` in the first place, so this is a defense-in-depth gap rather than a remote attacker path)
can edit `generated_at` to "just now" to defeat the 60-minute staleness check, or flip `pitr.status` from
`"unknown"` to `"enabled"` to defeat the `--accept-unknown-pitr` acknowledgement requirement — in both
cases `candidate_ids_sha256` still matches because `candidate_ids` itself was untouched, so the check
that is supposed to catch tampering reports success.

**Fix:** Hash the full set of safety-relevant fields, not just the id list:

```js
const hashInput = JSON.stringify({ candidate_ids: candidateIds, generated_at, pitr });
const candidateIdsSha256 = createHash('sha256').update(hashInput).digest('hex');
```
(rename appropriately, e.g. `manifest_sha256`) and recompute the same way in
`assertManifestIntegrity` before trusting `generated_at` or `pitr.status` from the file on disk.

### WR-02: CSV formula-injection risk in the two-person-review artifact

**File:** `scripts/purge-test-accounts/lib.mjs:277-282` (`csvField`), `scripts/purge-test-accounts/export.mjs:47-52` (`csvField`)

**Issue:** Both CSV writers only quote a field when it contains a comma, quote, or newline:

```js
function csvField(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
```
Neither escapes a leading `=`, `+`, `-`, or `@`, the classic CSV/formula-injection trigger characters
(OWASP "CSV Injection"). The `email` column (and, in `export.mjs`, `waitlist_emails`) is attacker-influenceable
data flowing directly into `csvField` and out to `dry-run-*.csv` and `export-*.csv` — the exact files
`RUNBOOK.md` §3 has a human open and read row-by-row as the two-person review gate. A crafted local-part
beginning with one of these characters, opened in Excel/Sheets, can execute a formula (including, in
older Excel/Office configurations, DDE-based command execution) instead of displaying as plain text.
Exploitability is bounded by whatever the mail-server / Supabase Auth signup flow allows in an
`@ziko-app.com` local-part, but the current code applies no defense regardless.

**Fix:** Prefix values that start with a formula-trigger character with a neutralizing character before
quoting, per OWASP guidance:

```js
function csvField(value) {
  let str = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`; // neutralize formula injection
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
```

### WR-03: `--max-manifest-age-minutes` with a non-numeric value silently disables the staleness check instead of failing

**File:** `scripts/purge-test-accounts/delete.mjs:52-54` (`parsePurgeArgs`), `scripts/purge-test-accounts/delete.mjs:99-104` (`assertManifestIntegrity`)

**Issue:**
```js
const maxManifestAgeMinutes =
  maxAgeIdx !== -1 && argv[maxAgeIdx + 1] !== undefined ? Number(argv[maxAgeIdx + 1]) : 60;
```
`Number('anything-non-numeric')` is `NaN`. Downstream:
```js
const ageMinutes = (now.getTime() - generatedAtMs) / 60000;
if (ageMinutes > maxAgeMinutes) { errors.push(...) }
```
Any comparison against `NaN` is `false` in JavaScript, so `ageMinutes > NaN` never triggers — a typo'd
or malformed `--max-manifest-age-minutes` value (e.g. a stray letter) silently disables the entire
staleness guard rather than raising an error, the opposite of this tool's fail-closed design elsewhere
(compare: the empty-`candidate_ids` check, the hash-mismatch check, and the PITR-unknown check all fail
closed on bad input).

**Fix:** Validate the parsed number and fail fast on `NaN`, either in `parsePurgeArgs` or as an explicit
integrity check:

```js
if (maxAgeIdx !== -1 && argv[maxAgeIdx + 1] !== undefined && Number.isNaN(Number(argv[maxAgeIdx + 1]))) {
  console.error(`--max-manifest-age-minutes must be a number, got: ${argv[maxAgeIdx + 1]}`);
  process.exit(1);
}
```
or add an explicit `Number.isNaN(maxAgeMinutes)` branch inside `assertManifestIntegrity` that always
pushes an error.

### WR-04: `verify-purge.mjs` never checks that `--report` corresponds to the manifest it's verifying

**File:** `scripts/purge-test-accounts/verify-purge.mjs:173-190` (`main`)

**Issue:** `main()` reads `--manifest` and `--report` as two independent file paths with no
cross-validation that the report is the one the manifest was actually built from
(`manifest.source_report` is written by `buildManifest` in export.mjs but is never read back here).
If an operator running the post-purge verification accidentally points `--report` at a different (e.g.
older, or a different environment's) dry-run report, `checkResidualMatches`'s `expected_remaining` /
`unexpected_matches` split and `checkAccountConservation`'s floor calculation are both computed against
the wrong baseline, and the script can print `RESULT: PASS` when the actual purge run was not correctly
reconciled, or `RESULT: FAIL` on a run that was actually clean.

**Fix:** Read `manifest.source_report`, resolve it the same way `--report` is resolved, and refuse to
proceed (fail-closed, matching the rest of this codebase's pattern) if the two paths don't match:

```js
if (resolve(manifest.source_report) !== resolve(reportPath)) {
  console.error(`--report (${reportPath}) does not match manifest.source_report (${manifest.source_report})`);
  process.exit(1);
}
```

### WR-05: `csvField`'s injection-safety regex omits bare `\r`

**File:** `scripts/purge-test-accounts/lib.mjs:280`, `scripts/purge-test-accounts/export.mjs:50`

**Issue:** `/[",\n]/.test(str)` quotes a field containing a comma, double quote, or `\n`, but not a
lone `\r` (carriage return) unaccompanied by `\n`. A value containing a bare `\r` would be emitted
unquoted and could be interpreted as a row break by parsers/spreadsheet apps that treat old-style
Mac line endings (`\r`-only) as a newline, corrupting the CSV's row/column structure downstream of this
tool without any error being raised here.

**Fix:** Extend the regex to include `\r`: `/["\r\n,]/`.

## Info

### IN-01: `chunk()` and `csvField()` are duplicated verbatim across modules

**File:** `scripts/purge-test-accounts/lib.mjs:115-122` / `scripts/purge-test-accounts/export.mjs:38-45` / `scripts/purge-test-accounts/verify-purge.mjs:107-114` (`chunk`); `scripts/purge-test-accounts/lib.mjs:277-282` / `scripts/purge-test-accounts/export.mjs:47-52` (`csvField`)

**Issue:** The same `chunk(arr, size)` helper is copy-pasted into three files, and the same `csvField`
helper into two. Any future fix to one (e.g. WR-02's or WR-05's fix above) has to be applied in every
copy or the files silently diverge — which is exactly the kind of drift that produced this review's
CR-01/WR-05 findings in the first place.

**Fix:** Export `chunk` and `csvField` from `lib.mjs` and import them in `export.mjs` and
`verify-purge.mjs` instead of redefining locally.

### IN-02: `--report`/`--manifest` CLI parsing pattern is repeated three times with no shared helper

**File:** `scripts/purge-test-accounts/export.mjs:230-242` (`parseArgs`), `scripts/purge-test-accounts/delete.mjs:45-60` (`parsePurgeArgs`), `scripts/purge-test-accounts/verify-purge.mjs:163-171` (`parseVerifyArgs`)

**Issue:** Each of the three CLI entry points hand-rolls its own `argv.indexOf('--flag')` parsing with
slightly different null-handling idioms (e.g. `argv[idx + 1] ? ... : null` vs.
`argv[idx + 1] !== undefined ? ... : ...`). Functionally consistent today, but a small, low-value target
for consolidation given how many near-identical CLI scripts this directory has.

**Fix:** Optional — extract a tiny shared `parseFlag(argv, name)` / `hasFlag(argv, name)` pair into
`lib.mjs` if another purge-adjacent script is added later.

### IN-03: Exported file paths embed the local filesystem's absolute path, including the operator's home directory

**File:** `scripts/purge-test-accounts/export.mjs:153-154` (`buildManifest`'s `source_report`/`export_csv` via `resolve()`)

**Issue:** `resolve(reportPath)` / `resolve(csvPath)` produce absolute paths that, run from a developer's
laptop, typically embed the OS username (e.g. `/Users/jdoe/ziko-platform/...`). These paths are written
into the manifest JSON and could end up pasted into a ticket or Slack thread when the manifest content
is shared for review. Low sensitivity, but avoidable.

**Fix:** Consider storing paths relative to the repo root in the manifest, or note in `RUNBOOK.md` that
manifest JSON should be treated with the same care as the CSV before it's shared outside the
two-person review.

---

_Reviewed: 2026-08-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
