# Pitfalls Research

**Domain:** Bulk third-party dataset merge (exercise data + licensed media) into an existing production Supabase table with FK-referenced history
**Researched:** 2026-08-14
**Confidence:** MEDIUM-HIGH — production schema facts read directly from migrations (HIGH); Gym visual license terms quoted directly from source `NOTICE.md` (HIGH); dataset repo structure/field names from GitHub page rendering (MEDIUM, not from a raw file diff — verify field names against the actual `exercises.schema.json` before writing the merge script)

## Existing State (verified from codebase, not the dataset)

- `public.exercises` has **no unique constraint on `name`** (`supabase/migrations/001_initial_schema.sql:33-43`). Duplicate/near-duplicate names already exist in production — e.g. migration `031_exercises_name_fr.sql` assigns the identical French translation `'soulevé de terre jambes tendues élastique'` to at least 3 different exercise UUIDs. Any "match by name" strategy must assume names are **not unique keys** on either side.
- `program_exercises.exercise_id` and `session_sets.exercise_id` are `NOT NULL REFERENCES public.exercises(id)` with **no `ON DELETE` clause** (`001_initial_schema.sql:72,102`) — Postgres default is `NO ACTION`, meaning **any exercise referenced by a real program or logged set cannot be deleted**, the delete will fail at the DB level. This is a hard blocker for any "wipe and reseed" approach (the current `seed_exercises.sql` does `DELETE FROM exercises WHERE is_custom=FALSE AND user_id IS NULL` — this only works today because no production programs/sessions reference seed rows yet; that assumption breaks the moment this app has real users with logged workouts).
- Migration `20260527_coach_exercise_id_program_exercises.sql` added a **separate** `coach_exercise_id` FK (`ON DELETE SET NULL`) to `program_exercises` for custom coach exercises (`coach_exercises` table, migration 055) — the coach-created exercise library is a **completely different table** with its own storage bucket (`coach-exercises`, private, per-coach-prefix RLS). Do not conflate the two: this import targets `public.exercises` (global library), not `coach_exercises`.
- Current `gif_url` values point to `https://v2.exercisedb.io/image/...` — same media-ID pattern and same first exercise name (`"3/4 sit-up"`) as the new `hasaneyldrm/exercises-dataset`. Both datasets almost certainly derive from the same underlying ExerciseDB/Gym visual source, which is *why* name matches will be common — but also why silent near-duplicates (gendered variants like `"astride jumps (male)"`, versioned suffixes like `"v. 2"`, `"v. 3"`) will produce partial, not total, overlap.
- No `image`/`thumbnail` column exists yet on `exercises` — this import is the first to introduce fixed-resolution licensed thumbnails, which is exactly the surface area the 180×180 legal cap constrains.

## Critical Pitfalls

### Pitfall 1: False-negative name matching creates duplicate rows with orphaned/split history

**What goes wrong:**
The merge script fails to match a new-dataset exercise to its existing counterpart (case differences, extra whitespace, `(male)`/`(female)` suffixes, `" v. 2"` suffixes, singular/plural, hyphenation), so it INSERTs a new row instead of UPDATE-ing the existing one. The app now has two rows for "the same" exercise — the old one still referenced by real `program_exercises`/`session_sets` rows (with the old broken `gif_url`), and a new one with correct media but zero history. Users' existing programs keep pointing at the stale, unfixed exercise; the exercise picker in the UI shows visible duplicates.

**Why it happens:**
Exact-string matching feels sufficient because most names are close, so this class of bug produces no crash and no error — the script "succeeds" while silently fragmenting data. It's compounded here by the fact that `exercises.name` already has no uniqueness guarantee in production (see Existing State above), so even a script author looking at row counts won't notice a handful of new near-duplicates.

**How to avoid:**
- Normalize both sides before comparing: lowercase, trim, collapse whitespace, strip trailing parenthetical qualifiers `(male)`/`(female)`, strip `" v. 2"`/`" v.2"`/`" v3"` suffixes into a separate "variant" signal rather than discarding it.
- Build the match as a 3-tier pipeline, not a single pass: (1) exact normalized-name match, (2) normalized-name + `body_part`/`equipment`/`target_muscle` agreement for near-matches (Levenshtein/trigram similarity threshold), (3) unmatched-on-both-sides list surfaced to a human for manual review before any write — never auto-insert unmatched dataset rows as new "duplicate" table entries without a review gate.
- Produce a dry-run report (matched / unmatched-legacy / unmatched-new / ambiguous-multi-match) and require it to be reviewed before the script is allowed to write.

**Warning signs:**
- Post-merge row count grew by more than the dataset's net new count (1324 vs current ~1318 — anything beyond a delta of a few dozen signals failed matches, not genuinely new exercises).
- Exercise picker in the mobile app shows two visually similar entries with different media states.

**Phase to address:**
Download/merge script phase — the matching algorithm and its dry-run report are the core deliverable of that phase, not an afterthought.

---

### Pitfall 2: False-positive name matching overwrites the wrong exercise and corrupts real user history

**What goes wrong:**
A fuzzy or overly permissive matcher (e.g., matching on first N characters, or on `target_muscle` alone) merges two genuinely different exercises — e.g. "barbell squat" and "barbell front squat" — into one row. The UPDATE silently rewrites `category`, `muscle_groups`, `instructions`, `equipment` on a row that real `program_exercises`/`session_sets` rows already point to. A user's historical set — logged as "barbell squat" — now retroactively displays as "barbell front squat" with different muscle targets, in their logged history and in any AI-generated coaching insight built on that history.

**Why it happens:**
This is the inverse failure mode of Pitfall 1, and the two are in tension: loosening the matcher to reduce false negatives directly increases false positives. Because the target table is FK-referenced by real workout history (unlike a typical "reference data" import), this mistake isn't just a data-quality issue — it silently rewrites something a real user logged in the past, which is far more damaging than a duplicate row.

**How to avoid:**
- Prefer precision over recall in the matcher: an unmatched dataset row that gets manually reviewed is cheap; a wrongly-matched row that overwrites live history is expensive and hard to detect after the fact.
- Never let a single fuzzy signal (name similarity OR muscle overlap) trigger an UPDATE alone — require agreement across at least two independent fields (normalized name AND body_part, or normalized name AND equipment) before treating it as an automatic match.
- Snapshot the pre-merge state of every row about to be UPDATEd (`INSERT INTO exercises_merge_backup SELECT * FROM exercises WHERE id = ANY(...)` before the UPDATE) so any wrong match can be reverted without a full DB restore.

**Warning signs:**
- Manual spot-check: pick 20 random exercises currently referenced by real `session_sets` rows (i.e. with actual logged history), confirm their post-merge name/category/muscle data is a superset refinement of the pre-merge data, not a replacement with a different exercise's semantics.

**Phase to address:**
Download/merge script phase, with a mandatory verification step before the phase can be marked done — do not let "row counts look right" stand in for "matches are correct."

---

### Pitfall 3: Non-idempotent merge script corrupts state on a partial run or re-run

**What goes wrong:**
The script downloads ~17MB of JSON and ~2600 binary files, then loops through UPDATE/INSERT statements against production Supabase. If the process is killed midway (Vercel function timeout, GitHub rate limit hit mid-download, laptop sleeps, network drop), the exercises table is left in a half-migrated state: some rows have new `image`/`gif_url` values, others don't, with no record of which. Re-running the script from the top either re-downloads everything (slow, wastes GitHub API quota) or — worse — re-runs the matching+UPDATE logic against an already-partially-migrated table, where names that were already renamed on the first pass no longer match the original matching logic, producing a second wave of false negatives (Pitfall 1) on the retry.

**Why it happens:**
One-off migration scripts are typically written and run once, so idempotency and resumability feel like YAGNI. But bulk network I/O against ~2600 external files plus writes to a live production table is exactly the scenario where a mid-run failure is likely, not hypothetical.

**How to avoid:**
- Download phase and merge phase must be separable and independently resumable: download all assets to a local/staging location first (verify checksums/file count against the manifest), then run the DB merge as a second, distinct step against the fully-downloaded local copy — never merge while still streaming from GitHub.
- Make the merge step idempotent: track progress in a dedicated table (`exercise_import_log(dataset_exercise_id, matched_row_id, status, processed_at)`) so a re-run skips already-processed rows instead of reprocessing them.
- Wrap each row's UPDATE (or small batch of rows) in its own transaction, not the whole 1324-row merge in one giant transaction — a single giant transaction either fully succeeds (fine, but means a timeout loses all progress) or fully fails and rolls back with no partial record of what was validated.

**Warning signs:**
- Script has no persisted "resume point" — if you can't answer "which of the 1324 exercises have already been merged" without re-diffing the whole table, it isn't resumable.
- Any GitHub rate-limit error (`403` / `X-RateLimit-Remaining: 0`) surfaces as a bare crash rather than a clean, resumable stop.

**Phase to address:**
Download/merge script phase — resumability is an architectural decision for the script, must be designed in from the start, not bolted on after a failed first run against production.

---

### Pitfall 4: 17MB JSON collides with this project's own Vercel payload limits

**What goes wrong:**
This project already hit and documented a hard constraint: *"Signed URL upload pattern — Vercel hard limit 4.5 MB"* (`.planning/PROJECT.md` Key Decisions, v1.3). The dataset's `data/exercises.json` is ~17MB — nearly 4x that limit. If the download/merge logic is implemented as (or triggered by) a Hono/Vercel serverless function that fetches the file via the GitHub REST Contents API (not `raw.githubusercontent.com`), the response is additionally base64-encoded, inflating it to ~22-23MB, which will fail outright on Vercel's response size ceiling. Even fetching via `raw.githubusercontent.com` directly, a 17MB fetch-and-parse-in-memory inside a serverless function invocation risks hitting memory/duration limits under Vercel's default function configuration.

**Why it happens:**
It's tempting to build the import as "just another Hono route" for consistency with the rest of the backend, but this workload is fundamentally a one-off batch/ETL job, not a request/response API endpoint, and the existing serverless constraints that are fine for normal API traffic don't apply the same way to bulk data ingestion.

**How to avoid:**
- Run the download + merge script as a local/CI script against the production Supabase connection string (or a scheduled one-off Vercel Cron with `maxDuration` extended, if it must run server-side), never as a synchronous Hono API route triggered by a client request.
- If any part of the pipeline does run in a serverless function, stream/paginate rather than loading the full 17MB JSON into memory at once, and always fetch from `raw.githubusercontent.com`, never the GitHub Contents API, to avoid the base64 inflation tax.

**Warning signs:**
- Any 413 (Payload Too Large) or function timeout error during the download step.
- Local testing "works fine" but the same code fails when deployed as a Vercel function — a giveaway that memory/payload limits weren't accounted for.

**Phase to address:**
Download/merge script phase — decide the execution environment (local/CI script vs. serverless) before writing any fetch code, since it changes the whole implementation shape.

---

### Pitfall 5: Missing or degraded Gym visual attribution/resolution compliance in an App Store-distributed product

**What goes wrong:**
The dataset's `NOTICE.md` states media use requires `"© Gym visual — https://gymvisual.com/"` attribution on every use and is capped at 180×180 resolution; cloning the repo does **not** grant a broader license — "this repository does not grant you any rights to the media beyond what Gym visual's terms allow." Two concrete failure modes: (1) the mobile app resizes/upscales the 180×180 thumbnail or GIF for a larger display context (e.g., an exercise detail screen showing it full-width) without Gym visual's separate written permission for that use, breaching the resolution cap; (2) the app displays the media anywhere (exercise library, workout session screen, AI-generated program preview) without the required attribution text/link visible or discoverable, which is a licensing breach that becomes public and permanent the moment the app ships to the App Store/Play Store — unlike a web app, a shipped mobile binary can't be silently patched for all existing installs.

**Why it happens:**
Attribution requirements are easy to treat as a data field to store, not a UI requirement to render — the `attribution` string sits in the JSON/DB but nothing forces a developer building a screen to surface it. Resolution caps are easy to violate accidentally: any `<Image style={{width: 300}}>` on a 180×180 source will upscale by default in React Native unless explicitly constrained, and nothing in the type system stops it.

**How to avoid:**
- Store the attribution as a required, structured field on the media record (not folded into free text), and add a shared `<AttributedMedia>` component in `packages/ui/` that every exercise-media consumer must use — bake the "© Gym visual" credit + link into the component itself so it can't be omitted by a screen author forgetting a prop.
- Enforce the resolution cap at render time: never scale the source image/GIF above 180×180 intrinsic pixels; if a larger visual is wanted, that requires a genuinely different (non-Gym-visual-sourced) asset, not an upscale of the licensed one.
- Add a legal/attributions page (the project already has a `Mentions legales` pattern for RGPD — extend it, or add a "Credits"/"Licenses" screen in Settings) listing the Gym visual attribution once, in addition to (not instead of) any inline attribution the license requires per-use.
- Get explicit confirmation (from the user/legal owner of this project) that "distributed at 180×180 only" is being read correctly as "never rendered above 180×180 in the shipped app," since that's the single highest-risk clause for a fitness app whose whole UI is built around exercise visuals.

**Warning signs:**
- Any screen with an `<Image>`/GIF component sized larger than 180×180 sourced from this dataset.
- No visible or linked attribution anywhere in the app for Gym visual content — grep the shipped screens for "gymvisual" / "Gym visual" and confirm at least one hit.

**Phase to address:**
Storage upload phase (resolution must never be upscaled during the Supabase Storage upload step either — re-encode/resize at capture time only if reducing further, never enlarging) **and** mobile consumption phase (attribution rendering + display size enforcement). Flag as needing explicit human/legal sign-off before phase completion — this is not purely a technical risk.

---

### Pitfall 6: Stale mobile cache and bundled fixture data show blank/broken images during rollout

**What goes wrong:**
Existing `gif_url` values point to `v2.exercisedb.io`, described in this codebase as "unreliable" (the motivation for this migration). Expo's default `<Image>` component and the OS-level HTTP cache may have already cached the old broken/slow URLs for exercises a user has previously viewed. After the merge updates `exercises.gif_url` to new self-hosted Supabase Storage URLs, users on an older cached app session (or with TanStack Query `staleTime`/`gcTime` still holding the old exercise list in memory) continue to see the old broken images or a mix of old-and-new URLs within the same list until a hard refresh/reinstall. Separately, if any plugin currently has a fixture/mock exercise array bundled in the JS bundle (the project's CLAUDE.md notes "100% fixture elimination — zero domain-data arrays in production screens" was a v1.7 goal, implying this was previously a real problem) that array would go stale immediately and silently diverge from the DB.

**Why it happens:**
Image caching and query caching are invisible in day-to-day development (dev client reloads frequently, so caches rarely persist long enough to notice) but very visible in production, where installed apps keep long-lived caches and aren't force-refreshed by a backend data change.

**How to avoid:**
- Change the exercise media URL path/filename on migration (e.g. include a content hash or dataset version in the Supabase Storage object path) rather than reusing the same logical URL with different content — this invalidates any URL-keyed image cache automatically, instead of relying on cache TTLs.
- Invalidate the relevant TanStack Query cache keys for exercise lists (bump a query key version, e.g. `['exercises', 'v2']`) so clients don't serve a stale in-memory/persisted query cache after the migration ships.
- Audit for any remaining hardcoded/fixture exercise arrays in plugin code (`grep -r "gif_url\|exercisedb" apps/mobile plugins` before shipping) — any hit is guaranteed to go stale the moment the DB changes.
- Roll out a loading/placeholder state (not a blank box) for exercise images so the transition period (before a client has re-fetched updated data) degrades gracefully instead of showing broken image icons.

**Warning signs:**
- QA on a build from before the migration ships (simulating an existing installed user) shows a mix of old and new image sources in the same scroll list.
- Any `grep` hit for `v2.exercisedb.io` or a hardcoded exercise fixture array remaining in `apps/mobile` or `plugins/*/src` after the migration phase is marked complete.

**Phase to address:**
Mobile consumption phase — plan the cache-busting URL strategy and query-key versioning as part of the phase's design, not as a post-launch bug-fix.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Auto-insert all unmatched new-dataset rows as brand-new exercises (no dedup review) | Faster script, no manual review step | Permanent duplicate exercises cluttering the picker forever (no cleanup path once real programs start referencing them) | Never — always route unmatched rows through a review report first |
| Store attribution as a comment/free-text note instead of a structured, rendered field | Faster to ship | Silent license non-compliance the moment a new screen displays the media without checking for the note | Never for licensed media |
| Reuse existing `gif_url` column name/URL pattern for the new self-hosted media without a version marker | No schema change needed | Defeats any URL-based cache invalidation, forces manual cache-busting workarounds later | Never — cache-busting is cheap to add now, expensive to retrofit |
| Run the full merge as one giant transaction "to keep it simple" | Simple to write | A single timeout/failure loses all progress and gives no partial audit trail of what was validated | Only acceptable for a true dry-run against a disposable staging copy, never against production |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|-------------------|
| GitHub raw file fetch | Using the GitHub Contents API (base64-encoded, ~33% size inflation, lower rate limits) to fetch `exercises.json` or binary media | Use `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` for both JSON and binary assets; reserve the Contents/Git Trees API only for listing file names, not fetching content |
| GitHub unauthenticated requests | Downloading ~2600 files without a token hits the 60 requests/hour unauthenticated rate limit almost immediately | Use a GitHub personal access token (5000 req/hour authenticated) or, better, download the repo as a single tarball/zip (`codeload.github.com/.../tar.gz/main`) to avoid per-file API requests entirely |
| Supabase Storage upload of ~2600 files | Sequential upload with no retry/backoff; a single transient failure aborts the whole batch with no record of what succeeded | Batch uploads with concurrency limits + per-file retry, and persist an upload manifest so a re-run only uploads missing files |
| Supabase Postgres direct connection for a bulk script | Running the merge through the pooled/serverless connection (PgBouncer transaction mode) used by the Hono API, which isn't suited for a long-running batch job with many sequential statements | Use a direct (non-pooled) connection string for the one-off migration script, separate from the app's runtime connection pool |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Loading the full 1324-row dataset + full 1318-row production table into memory for an O(n×m) fuzzy-match comparison | Script takes minutes and consumes excessive memory for what should be a sub-second operation on ~2600 total rows | Normalize both sides into a name-indexed map first (O(n+m)), only fall back to fuzzy/trigram comparison for the residual unmatched subset | At this dataset's exact scale (~1300 rows) this is already a real risk, not a future one — a naive nested loop is ~1.7M comparisons |
| Fetching all 2600 media files sequentially, one HTTP request at a time | Download step takes very long, increases the window for a mid-run failure (Pitfall 3) | Bounded concurrency (e.g. 10-20 parallel downloads) with a manifest tracking completed files | Noticeable above a few hundred files; at 2600 files sequential-at-~200ms/file is ~9 minutes minimum even with zero retries |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Running the merge script with the Supabase `service_role` key hardcoded in a script committed to the repo, or left in shell history | Full-privilege key leak bypassing all RLS, same class of issue already fixed once in this project (`SUPABASE_SERVICE_KEY` was previously removed from the backend per CLAUDE.md "Known Bugs Fixed") | Load the service role key from an untracked `.env` (already the project's established pattern) and never print/log it; run the script locally or via a secrets-managed CI job, not committed anywhere |
| Trusting the downloaded GitHub content without integrity verification | A compromised or force-pushed upstream repo (or a MITM on an unauthenticated `raw.githubusercontent.com` fetch, though HTTPS mitigates this) could inject unexpected instructions/content text into `exercises` rows served back to users | Pin to a specific commit SHA (not `main`) when fetching, and spot-check a sample of instructions text before writing to production |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Shipping the merge mid-day against production without a maintenance/rollout window | Users mid-workout-session see an exercise's name/media change under them, or briefly see missing images while the migration is in flight | Run the merge during low-traffic hours, and make the mobile client tolerant of a temporarily-missing `gif_url`/`image` (placeholder, not crash) |
| Exercise list re-sorts or renumbers after the merge because new rows were inserted with fresh UUIDs at the end (false negatives, Pitfall 1) | A user's "recently used" or "favorites" list (if any plugin tracks exercise_id locally) silently breaks or points to the wrong exercise | Preserve existing UUIDs for every successfully matched exercise (UPDATE in place, never delete+reinsert) so all FK references and any client-side cached IDs remain valid |

## "Looks Done But Isn't" Checklist

- [ ] **Name matching:** Often missing a manual-review gate for ambiguous/unmatched rows — verify a dry-run report was generated and reviewed before any production write ran.
- [ ] **License compliance:** Often missing the actual rendered attribution in the shipped app (not just stored in the DB) — verify by grepping shipped screen code for the attribution component/text, not just the data layer.
- [ ] **Resolution cap:** Often missing enforcement at render time — verify no `<Image>`/GIF usage of this media renders above 180×180 intrinsic pixels anywhere in `apps/mobile`.
- [ ] **Idempotency:** Often missing a resume/progress log — verify the script can be killed mid-run and re-run without re-processing already-completed rows or re-downloading already-downloaded files.
- [ ] **FK integrity:** Often missing a check that no exercise referenced by real `program_exercises`/`session_sets` rows was deleted or had its `id` change — verify via a pre/post count of FK references per exercise id.
- [ ] **Mobile cache invalidation:** Often missing a cache-busting strategy for changed media URLs — verify old cached `v2.exercisedb.io` URLs are fully gone from the DB (not just superseded in most rows) and that query cache keys were versioned.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| False-positive match overwrote a real exercise's data (Pitfall 2) | MEDIUM | Restore the affected row(s) from the pre-merge backup table (`exercises_merge_backup`) created before the UPDATE; re-run the matcher for just that row with tightened thresholds |
| Duplicate rows created from false negatives (Pitfall 1) | LOW-MEDIUM | Since names aren't unique, duplicates are identifiable by comparing `gif_url`/media reference; re-point any `program_exercises`/`session_sets` rows referencing the duplicate to the canonical row, then delete the duplicate (safe now that no FK references it) |
| Partial/interrupted merge left inconsistent state (Pitfall 3) | LOW, if idempotency was built in; HIGH, if not | With an import-log table: simply re-run, it resumes. Without one: must diff the entire table against the dataset to reconstruct which rows were touched — budget significant manual verification time |
| License violation shipped to production (missing attribution or oversized media) (Pitfall 5) | HIGH | Requires an app update (App Store/Play Store review cycle, not an instant fix) to correct rendering; in the interim, may require pulling the affected media server-side (swap `gif_url` back to a placeholder) since that part can be fixed without a client release |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| False-negative name matching / duplicate rows | Download/merge script phase | Dry-run report reviewed; post-merge row count delta matches expected net-new count (~single digits to low dozens, not hundreds) |
| False-positive name matching / overwritten history | Download/merge script phase | Spot-check 20 exercises with real logged `session_sets` history pre/post merge; pre-merge backup table exists |
| Non-idempotent script / partial-run corruption | Download/merge script phase | Kill the script mid-run in a staging rehearsal, confirm re-run resumes cleanly without duplicate work or errors |
| 17MB JSON vs. Vercel payload/serverless limits | Download/merge script phase (environment decision) | Confirm the script runs as a local/CI job or extended-duration Cron, not a synchronous Hono API route; fetch source is `raw.githubusercontent.com`, not the Contents API |
| Gym visual attribution/resolution compliance | Storage upload phase + Mobile consumption phase | Attribution component present and rendered on every media display; grep confirms no `<Image>` usage exceeds 180×180 for this media; explicit sign-off obtained on license interpretation |
| Stale mobile cache / broken images during rollout | Mobile consumption phase | QA on a pre-migration build simulating an existing install shows no mixed old/new URLs after a normal app resume (not requiring reinstall); fixture-array grep is clean |

## Sources

- `C:\ziko-platform\supabase\migrations\001_initial_schema.sql` (exercises, program_exercises, session_sets schema — FK constraints, no unique name constraint) — HIGH confidence, read directly
- `C:\ziko-platform\supabase\migrations\031_exercises_name_fr.sql` (evidence of duplicate French names across distinct exercise UUIDs) — HIGH confidence, read directly
- `C:\ziko-platform\supabase\migrations\055_coach_exercises_schema.sql`, `20260527_coach_exercise_id_program_exercises.sql` (separate `coach_exercises` table/FK — not to be conflated with this import) — HIGH confidence, read directly
- `C:\ziko-platform\supabase\seed_exercises.sql` (current seed pattern, `v2.exercisedb.io` GIF host, delete-then-insert approach) — HIGH confidence, read directly
- `C:\ziko-platform\.planning\PROJECT.md` (Vercel 4.5MB payload limit constraint, v1.16 workstream description) — HIGH confidence, read directly
- [hasaneyldrm/exercises-dataset — NOTICE.md](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md) — Gym visual attribution + 180×180 resolution cap terms — HIGH confidence, quoted directly from primary source
- [hasaneyldrm/exercises-dataset repository](https://github.com/hasaneyldrm/exercises-dataset) — repo structure, `id`/`media_id` file-naming scheme, per-record `attribution` field — MEDIUM confidence, derived from rendered page/README summary, not a raw-file diff; **recommend verifying exact field names against `data/exercises.schema.json` before implementation**
- [Gym visual Terms and Conditions](https://gymvisual.com/content/3-terms-and-conditions-of-use) (referenced by NOTICE.md, not independently fetched) — MEDIUM confidence, verify directly before finalizing legal/attribution UI copy
- Direct fetch of `raw.githubusercontent.com/.../data/exercises.json` failed with a 10MB content-size error during this research — empirical confirmation the file is large enough to collide with typical serverless/tool payload limits (Pitfall 4)

---
*Pitfalls research for: bulk exercise dataset + licensed media import into production Ziko Platform*
*Researched: 2026-08-14*
