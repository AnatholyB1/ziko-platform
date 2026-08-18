# Phase 2: Download & Match (Dry-Run) - Research

**Researched:** 2026-08-15
**Domain:** Data pipeline — dataset fetch/verify + deterministic/fuzzy record matching (Node/TS script, read-only Supabase access)
**Confidence:** HIGH (dataset schema, production schema, script conventions) / MEDIUM (predicted match-volume numbers — inherently unverifiable until the matcher runs against real data, as CONTEXT.md itself acknowledges)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Decisions (locked, unless explicitly marked "Claude's Discretion")

#### Match tiers & fields
- **D-01:** Matching tries both `name` (English) and `name_fr` (French) against the dataset's translations, not English-only — catch cases where one language aligns even if the other diverges.
- **D-02 (Claude's discretion):** Whether an exact-normalized-name match with conflicting/unverifiable other fields (category, body_part) counts as a confident Tier 1 "matched" or gets downgraded to "ambiguous" — resolve after the researcher verifies the actual `hasaneyldrm/exercises-dataset` field names/schema (this is explicitly unverified per STATE.md blockers). Lean on the fact that production `exercises.name` is effectively unique (per prior team note) as a strong signal, but confirm before trusting it as the sole Tier 1 criterion.
- **D-03 (Claude's discretion):** Fuzzy-matching algorithm/threshold for Tier 2 (renamed/typo'd/reworded exercises) — pick a concrete library/threshold after seeing real near-duplicate examples between the two datasets. Bias conservative (fewer false positives) given the precision-first requirement (IMPORT-02).
- **D-04 (Claude's discretion):** Whether Tier 3 does a last-resort attribute-based guess (body_part/equipment/target_muscle overlap) for exercises with zero name match, always marked "ambiguous" if so — or whether "no name match" simply falls straight to unmatched-new/unmatched-legacy with no Tier 3 step. Decide based on actual unmatched volume once real data is seen.
- **Key existing signal:** production `exercises` already has `body_part`, `equipment`, `target_muscle`, `secondary_muscles` (added in `004_exercises_extended.sql` from a prior Kaggle dataset import) and `gif_url` (legacy, distinct from the new `gif`/`image` columns added in Phase 1). These columns are available as matching signal beyond name alone, once the new dataset's taxonomy is confirmed to be compatible.

#### Report format & location
- **D-05:** Report format is **JSON** — the machine-readable source of truth, structured so Phase 3's merge script can consume it directly as its approved-report input.
- **D-06 (Claude's discretion):** Whether to also generate a companion human-readable Markdown summary (counts per category, sample rows, ambiguous cases highlighted) alongside the JSON — decide based on expected report row count. The roadmap's "human-reviewable" success criterion (Phase 2 SC #2) still must be satisfied even if the primary artifact is JSON — plan for at minimum a readable JSON structure (grouped by category, not a flat array) if no Markdown summary is added.
- **D-07:** Reports are written to **`.planning/workstreams/image-exo/reports/`** — versioned in git, next to this phase's other docs. The human-approved copy becomes Phase 3's input artifact.
- **D-08:** Re-running the dry-run match step **overwrites a fixed filename** (e.g. `match-report.json`), not a new timestamped file each run — expect to re-run this repeatedly while tuning the matcher; git history shows the diff between tuning iterations.

#### Ambiguous-match presentation
- **D-09 (Claude's discretion):** Whether ambiguous rows show top-N candidates with scores, or a single best-guess flagged uncertain — decide based on how common ambiguous cases actually turn out to be once the matcher runs on real data.
- **D-10 (Claude's discretion):** Whether the reviewer edits the approved JSON report inline to resolve an ambiguous case (picking the winning candidate), or ambiguous rows are always routed to manual review as a separate path in Phase 3 (never auto-resolved via report editing) — decide based on how Phase 3's approval flow ends up being designed. Note the tension with D-05's "report = Phase 3's direct input" — if reviewer-editing is chosen, the report schema must support an explicit human-decision field per ambiguous row.
- **User signal:** No strong preference on review-effort tolerance (dozens vs hundreds of ambiguous cases) — plan a reasonable conservative default and expect the actual numbers to only be known once the matcher runs against real production + dataset data.

#### Fetch & manifest failure behavior
- **D-11 (Claude's discretion):** Whether manifest mismatch triggers a hard exit with no report generated, or a partial report stamped with prominent warnings — decide based on whether fetch and match end up structured as one script or two separate steps.
- **D-12 (Claude's discretion):** Whether re-running fetch always does a fresh `git clone --depth 1`, or reuses/`git pull`s an existing local clone — decide based on dataset size (images/videos) and expected number of matcher-tuning iterations. Given the matcher will very likely be re-run multiple times while tuning (per Ambiguous-match discussion above), lean toward avoiding unnecessary re-downloads unless there's a correctness reason not to.
- **D-13 (Claude's discretion):** Where the cloned dataset lives on disk (inside repo gitignored vs OS temp dir) — decide based on where the fetch/match scripts themselves end up living (D-14).
- **D-14 (Claude's discretion):** Whether the fetch/match scripts live in a new `scripts/exercise-import/` subfolder or as flat files alongside the existing ad-hoc `scripts/*.js` utilities — decide based on how many files the pipeline actually needs (fetch + match today; Phase 3 adds a merge script later — a dedicated subfolder likely holds up better across all three phases even though this phase alone could be 2-3 flat files).

#### Claude's Discretion (summary, as stated in CONTEXT.md)
Most mechanical/threshold-level decisions in this phase were explicitly deferred to research + planning, per the user's consistent "Let Claude decide" pattern: exact Tier 1/2/3 field logic and thresholds, ambiguous-match presentation format, reviewer-edit-vs-read-only report semantics, manifest-failure hard-exit-vs-partial-report behavior, clone-reuse strategy, dataset-on-disk location, and script folder layout. The **locked** decisions are: match both `name` + `name_fr` (D-01), JSON report format as Phase 3's input (D-05), report location `.planning/workstreams/image-exo/reports/` (D-07), and fixed-filename-overwrite on re-run (D-08). The researcher should prioritize verifying the actual `hasaneyldrm/exercises-dataset` field names/schema (flagged as unverified in STATE.md) before the planner locks in the deferred matcher/report-format details above — this verification directly unblocks D-02, D-03, D-04, and D-06.

**Research resolution of the deferred items above** (see Summary, Standard Stack, and Architecture Patterns sections below for full reasoning):
- D-02: recommend exact-normalized-name match = Tier 1 "matched" by default, with a runtime duplicate-name safety check (see Pitfall 4) rather than a hard block on trusting uniqueness.
- D-03: recommend `fastest-levenshtein`, conservative threshold ~0.87 (tunable constant).
- D-04: recommend Tier 3 attribute-based guess exists but always resolves to "ambiguous," never "matched."
- D-06: recommend YES, generate a companion Markdown summary — ~1,300+ row JSON is not human-scannable directly, and the roadmap's "human-reviewable" success criterion needs a real answer regardless of predicted row counts.
- D-09: recommend top-N (3) candidates with scores for ambiguous rows.
- D-10: recommend an explicit nullable `human_decision` field per ambiguous row directly in the JSON report (reviewer edits in place, git-diffable) — keeps D-05's "report = Phase 3's direct input" intact.
- D-11: recommend hard exit, no report generated, on manifest mismatch — matches IMPORT-01's "failing loudly" wording and is the simpler/safer default.
- D-12: recommend clone-once-reuse (skip re-clone if local cache exists), with a `--refetch` flag to force.
- D-13: recommend a new gitignored directory inside `scripts/exercise-import/` (not OS temp, not committed to git — see Anti-Patterns for why this deviates from the small-file `kaggle_data/` precedent).
- D-14: recommend `scripts/exercise-import/` subfolder (confirmed appropriate given the 3-script pipeline spanning this phase + Phase 3).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Every discussed area was a "how to implement this phase's fetch/match/report pipeline" question, not a new capability. No scope-creep items came up.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | Script récupère le dataset (exercises.json + images/ + videos/) depuis `hasaneyldrm/exercises-dataset` via `git clone --depth 1`, vérifié contre le manifest de fichiers attendu | Dataset schema, folder structure, and file counts independently verified (1,324 exercises, 1,324 images, 1,324 videos). **No literal manifest file exists** — research resolves this gap by specifying `exercises.json`'s own array (length + per-record `image`/`gif_url` path existence) as the manifest equivalent (see Architecture Patterns, Pattern 1) |
| IMPORT-02 | Phase de match à blanc (dry-run) produit un rapport revu par un humain (matché / non-matché-ancien / non-matché-nouveau / ambigu) via un matcher précision-first à 3 niveaux, zéro écriture DB, exclut explicitement `is_custom=true` et la table `coach_exercises` | 3-tier matcher design fully specified (Standard Stack, Architecture Patterns, Code Examples); `is_custom` exclusion satisfied via the existing `read_exercises` RLS policy at the query level (no extra app logic needed); `coach_exercises` exclusion satisfied trivially — the matcher never queries that table at all |
</phase_requirements>

## Summary

The `hasaneyldrm/exercises-dataset` GitHub repo was independently verified via direct GitHub API calls and raw file fetches (not training knowledge): it contains exactly 1,324 exercise records in `data/exercises.json`, validated by a real `data/exercises.schema.json` (JSON Schema Draft 2020-12), with exactly 1,324 files each in `images/` and `videos/`. **Critically, the dataset has no separate "manifest" file** — the literal artifact IMPORT-01/ROADMAP call "the manifest" does not exist. The closest equivalent, and the one the fetch script must use, is `exercises.json` itself: its array length plus the `image`/`gif_url` path on every record is the manifest. **Also critically, the dataset does not have translated exercise names** — `name` is a single English string; only `instructions`/`instruction_steps` are multilingual (10 languages incl. `fr`). This directly changes how D-01 (match both `name` and `name_fr`) should be implemented in practice — see "Don't Hand-Roll" and Pitfall 1 below.

Production's `exercises` table has **no UNIQUE constraint on `name`** at the database level (verified: absent from all migrations, `001` through `20260814`) — the "effectively unique" claim in CONTEXT.md is not DB-enforced. However, strong circumstantial evidence (see Standard Stack / Assumptions Log) shows production's legacy `body_part`/`equipment`/`target_muscle`/`gif_url` columns came from a **different but same-lineage ExerciseDB-derived dataset** (Kaggle `omarxadel/fitness-exercises-dataset`, imported via `scripts/csv-to-seed.js`/`json-to-seed.js`, which explicitly deduplicated by lowercased `name` before insert). Both datasets share the same `body_part` taxonomy (`waist`, `chest`, `upper arms`, etc.) and near-identical exercise counts (1,318 legacy vs. 1,324 new) — strong evidence that name-based Tier 1 matching will resolve the large majority of rows, with body_part/equipment/target providing corroborating (not primary) signal.

No fuzzy-matching library exists anywhere in the monorepo's dependency tree. `fastest-levenshtein` (npm) is recommended for Tier 2 — verified on the npm registry, `slopcheck`-clean, ~25M weekly downloads, zero dependencies, no postinstall script.

**Primary recommendation:** Build `scripts/exercise-import/{fetch,match}.ts`, run via `tsx` (already a devDependency pattern in `backend/api`), reading production `exercises` with the existing public `EXPO_PUBLIC_SUPABASE_KEY`-equivalent publishable key (no service-role key needed — RLS's `read_exercises` policy already scopes reads to `is_custom = FALSE` for unauthenticated callers). Cache the git clone in a new gitignored directory (not committed — unlike the small `kaggle_data/` precedent, this dataset's media payload is ~128MB, too large to commit and redundant with Phase 1's Supabase Storage delivery path). Write JSON report + Markdown summary to `.planning/workstreams/image-exo/reports/match-report.{json,md}`, fixed filenames, overwritten each run.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dataset fetch (git clone) | Standalone script (Node/tsx) | — | One-off dev-run pipeline, not part of app runtime; no backend/mobile involvement |
| File-count/manifest verification | Standalone script | — | Pure filesystem + JSON check against `exercises.json`, no DB involvement |
| Production exercise read | Standalone script → Supabase (Postgres, via public REST/RLS) | — | Read-only; RLS already scopes correctly with the publishable key, no backend API route needed |
| Matching logic (3-tier) | Standalone script (pure TS functions) | — | Deterministic + fuzzy string/attribute comparison, no framework dependency |
| Report generation | Standalone script (filesystem write) | — | Writes to `.planning/.../reports/`, versioned in git, not to DB or Storage |
| Report review | Human (manual, via git diff / editor) | — | No UI built in this phase; JSON+MD are the review surface |

**Note:** Nothing in this phase touches `apps/mobile`, `backend/api` routes, or Supabase Storage/writes — it is entirely a standalone script tier, consistent with the phase's "zero DB writes" boundary.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tsx` | ^4.19.0 (already in `backend/api/package.json`; `4.21.0` resolves via `npx tsx` in this repo) | Run TS scripts directly without a build step | Already the repo's established pattern for running standalone TS (`backend/api`'s `dev`/`watch` scripts use `tsx`); avoids adding `ts-node` or a build step for a manually-run pipeline |
| `@supabase/supabase-js` | ^2.99.2 (already a root `dependencies` entry) | Read production `exercises` table | Already a root-level dependency — no new install needed |
| `fastest-levenshtein` | 1.0.16 [ASSUMED — package name sourced from training knowledge, not Context7/official docs; registry+slopcheck checks below only confirm it exists and isn't malicious, not that it's the "correct" choice] | Tier 2 fuzzy name matching (edit-distance ratio) | Zero-dependency, fastest pure-JS Levenshtein implementation available; no fuzzy-match library currently in the monorepo (verified via grep across all `package.json` files — zero matches) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 (already root dependency) | Validate parsed `exercises.json` records against expected shape before matching | Optional but recommended — dataset schema was verified today, but pinning to `git clone --depth 1` of a live upstream repo means the schema could drift on a future re-run; a zod parse at load time turns silent schema drift into a loud failure, consistent with IMPORT-01's "failing loudly" requirement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fastest-levenshtein` | `fuse.js` (7.5.0, verified on npm) | Fuse.js is a full fuzzy-search engine (weighted multi-field scoring) — more powerful but heavier and less precision-controllable than a raw edit-distance ratio; given the precision-first bias (IMPORT-02) and the fact that Tier 1 exact-match is expected to resolve the majority of rows (same-lineage datasets), a simple conservative edit-distance threshold is easier to reason about and tune than Fuse.js's composite scoring |
| `git clone --depth 1` (mandated by IMPORT-01 — this is locked, not a choice) | Downloading `exercises.json`/media via GitHub API/raw URLs without `git` | Not applicable — the requirement explicitly mandates `git clone --depth 1`; noted only because the images/videos are binary and `--depth 1` still pulls the full working tree (~128MB) on every fresh clone, which the clone-reuse strategy (D-12) exists specifically to avoid re-paying |

**Installation:**
```bash
npm install fastest-levenshtein
npm install --save-dev tsx   # only if not already resolvable at root; backend/api already has it
```

**Version verification:** Verified live against the npm registry during this research session (not training-data recall):
```
npm view fastest-levenshtein version   → 1.0.16 (published 2020-07-22, still current/maintained)
npm view fuse.js version               → 7.5.0
npm view tsx version                   → resolves to 4.21.0 via npx in this repo today; package.json pins ^4.19.0
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fastest-levenshtein` | npm | ~6 yrs (published 2020-07-22) | ~25.4M/week | `github.com/ka-weihe/fastest-levenshtein` | OK | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No postinstall script present (`npm view fastest-levenshtein scripts.postinstall` returned empty). `slopcheck scan --pkg npm fastest-levenshtein --json` returned `"status": "OK"`, `"flags": []`.

Per the package-name provenance rule: `fastest-levenshtein` was recalled from training knowledge (not discovered via Context7 or an official doc), so it is tagged `[ASSUMED]` above despite passing registry + slopcheck verification. The planner should gate its install behind a `checkpoint:human-verify` task per the graceful-degradation rule, even though slopcheck itself came back clean — the rule requires this because the *name* wasn't sourced authoritatively, not because the package looks unsafe.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────┐
│ hasaneyldrm/         │  git clone --depth 1
│ exercises-dataset    │─────────────────────┐
│ (GitHub, ~128MB)     │                      ▼
└─────────────────────┘          ┌─────────────────────────────┐
                                   │ scripts/exercise-import/    │
                                   │   fetch.ts                  │
                                   │   1. clone (or reuse cache) │
                                   │   2. parse exercises.json   │
                                   │   3. verify: len(json) ==   │
                                   │      count(images/) ==      │
                                   │      count(videos/) &&      │
                                   │      every image/gif path   │
                                   │      resolves on disk       │
                                   │   4. exit loudly on mismatch│
                                   └──────────────┬───────────────┘
                                                  │ (validated dataset,
                                                  │  cached on disk)
                                                  ▼
┌─────────────────────┐          ┌─────────────────────────────┐
│ Supabase Postgres    │  SELECT  │ scripts/exercise-import/    │
│ public.exercises     │─────────▶│   match.ts                  │
│ WHERE is_custom=false│ (paginated,│  Tier 1: exact normalized  │
│ (read-only, public   │  >1000 rows)│  name match (name + name_fr)│
│ RLS policy)          │          │  Tier 2: fastest-levenshtein│
└─────────────────────┘          │  fuzzy match, conservative  │
                                   │  threshold                  │
                                   │  Tier 3 (optional): body_part│
                                   │  /equipment/target overlap  │
                                   │  → always "ambiguous"       │
                                   └──────────────┬───────────────┘
                                                  │ categorized rows
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │ .planning/workstreams/       │
                                   │ image-exo/reports/           │
                                   │   match-report.json  (source │
                                   │     of truth, Phase 3 input) │
                                   │   match-report.md    (human- │
                                   │     reviewable summary)      │
                                   └─────────────────────────────┘
                                                  │ human review +
                                                  │ git commit (approval)
                                                  ▼
                                        Phase 3 (merge — not this phase)
```

### Recommended Project Structure
```
scripts/exercise-import/
├── fetch.ts              # git clone --depth 1 (or reuse), manifest verification
├── match.ts              # 3-tier matcher, reads production exercises + cached dataset, writes reports
├── lib/
│   ├── normalize.ts       # name normalization shared by fetch verification + matcher
│   ├── supabase-client.ts # read-only client factory (publishable key)
│   └── types.ts           # shared TS types: DatasetExercise (zod-validated), ProductionExercise, MatchReportRow
├── .dataset-cache/         # gitignored — the cloned repo lives here (D-13)
└── README.md              # usage: npx tsx fetch.ts / npx tsx match.ts, env vars required
```
This mirrors D-14's reasoning: fetch (this phase), match (this phase), and merge (Phase 3) all live under one subfolder rather than as flat files alongside the unrelated ad-hoc `scripts/*.js` utilities (`csv-to-seed.js`, `json-to-seed.js`, `food-data/`), since those are one-off/already-run scripts, not an active 3-phase pipeline.

### Pattern 1: Manifest verification without a real manifest file
**What:** Since `hasaneyldrm/exercises-dataset` has no dedicated manifest/checksum file (verified via `GET /repos/hasaneyldrm/exercises-dataset/contents/` and `.../contents/data` — only `exercises.json` + `exercises.schema.json` exist in `data/`), treat `exercises.json`'s own array as the manifest.
**When to use:** In `fetch.ts`, immediately after clone.
**Example:**
```typescript
// Source: verified directly via GitHub API (api.github.com/repos/.../git/trees/...) during this research session
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const datasetRoot = '.dataset-cache/exercises-dataset';
const exercises = JSON.parse(readFileSync(join(datasetRoot, 'data/exercises.json'), 'utf-8'));

const imageFiles = readdirSync(join(datasetRoot, 'images'));
const videoFiles = readdirSync(join(datasetRoot, 'videos'));

const mismatches: string[] = [];
if (imageFiles.length !== exercises.length) {
  mismatches.push(`images/ has ${imageFiles.length} files, exercises.json has ${exercises.length} records`);
}
if (videoFiles.length !== exercises.length) {
  mismatches.push(`videos/ has ${videoFiles.length} files, exercises.json has ${exercises.length} records`);
}
for (const ex of exercises) {
  if (!existsSync(join(datasetRoot, ex.image))) mismatches.push(`missing image: ${ex.image} (exercise ${ex.id})`);
  if (!existsSync(join(datasetRoot, ex.gif_url))) mismatches.push(`missing gif: ${ex.gif_url} (exercise ${ex.id})`);
}
if (mismatches.length > 0) {
  console.error('MANIFEST VERIFICATION FAILED:\n' + mismatches.join('\n'));
  process.exit(1); // hard exit, no report generated (recommended answer to D-11)
}
```

### Pattern 2: Reading >1000 production rows without silent truncation
**What:** Supabase's PostgREST layer caps unpaginated `select()` responses at 1,000 rows by default. Production `exercises` has at least 1,318 non-custom rows (per `scripts/exercise_names.txt`, generated at a prior seed time — treat as a lower-bound estimate, not a live count).
**When to use:** Any time `match.ts` queries `public.exercises`.
**Example:**
```typescript
// Source: CITED — https://supabase.com/docs/reference/javascript/select ,
// https://dev.to/michelfaure/why-your-supabase-query-stops-at-exactly-1000-rows-and-never-tells-you-4g57
async function fetchAllExercises(supabase: SupabaseClient) {
  const pageSize = 1000;
  let from = 0;
  const all: ProductionExercise[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, name_fr, category, body_part, equipment, target_muscle, secondary_muscles, is_custom')
      .eq('is_custom', false)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

### Pattern 3: Read-only access with the publishable key (no service-role needed)
**What:** `public.exercises`'s `read_exercises` RLS policy is `FOR SELECT USING (is_custom = FALSE OR user_id = auth.uid())` (migration `001_initial_schema.sql`). An unauthenticated client (publishable key, no session) has `auth.uid() = null`, so the policy still permits reading every `is_custom = false` row — exactly this phase's target population.
**When to use:** `match.ts`'s Supabase client — do not request or wire up `SUPABASE_SERVICE_KEY` for this phase; it's unnecessary privilege for a read-only, zero-write dry-run.
**Example:**
```typescript
// Source: verified against supabase/migrations/001_initial_schema.sql (read_exercises policy)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!, // NOT SUPABASE_SERVICE_KEY — read-only, RLS already scopes correctly
  { auth: { persistSession: false, autoRefreshToken: false } }
);
```

### Anti-Patterns to Avoid
- **Trusting `name` uniqueness without a runtime check:** No DB constraint enforces it (verified absent across all migrations). Before building a `Map<normalizedName, productionRow>` lookup, group production rows by normalized name and flag (log a warning, don't crash) any group with >1 member — this makes a latent data-quality issue visible instead of silently picking whichever row wins the `Map.set()` collision.
- **Treating a Tier 3 attribute-based guess as "matched":** Production's `body_part`/`equipment`/`target_muscle` and the dataset's `body_part`/`equipment`/`target` share the same taxonomy (both ExerciseDB-lineage), which makes attribute overlap tempting to trust — but multiple distinct exercises legitimately share body_part+equipment+target (e.g. several different barbell chest presses target "pectorals"). Per IMPORT-02's precision-first mandate, any row resolved only via Tier 3 attribute overlap must be categorized `ambiguous`, never `matched`.
- **Committing the cloned dataset to git:** Unlike the small precedent files (`kaggle_data/exercises.json` at 900KB, `scripts/food-data/usda_sr_legacy.zip` at 5.8MB — both committed), this dataset's `images/`+`videos/` payload is ~128MB. Committing it would bloat the ziko-platform repo history for data that's redundant with Phase 1's Supabase Storage delivery path (Phase 3 uploads the actual media to `exercise-media`). Gitignore the clone cache.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string similarity for Tier 2 | A custom Levenshtein/edit-distance function | `fastest-levenshtein` | Edit-distance implementations have easy-to-miss off-by-one and Unicode-surrogate-pair bugs; a maintained, benchmarked library removes that entire class of bug for a ~5KB dependency |
| Matching `name_fr` against a dataset that has no translated names | A translation layer (calling an LLM/translation API to translate the dataset's English names to French for comparison) | Direct normalized string comparison of production `name_fr` against dataset `name`, accepted as a low-yield supplementary signal (catches French fitness loanwords like "squat", "burpee", "crunch" that are used as-is in French) | The dataset genuinely has no French names (schema-verified) — building translation infrastructure to manufacture a comparison that D-01 implies is disproportionate for what CONTEXT.md itself frames as a "catch cases where one language aligns" secondary signal, not a primary matching path |
| JSON Schema validation of the fetched dataset | Manual field-by-field `if` checks | `zod` (already a root dependency) parsing the array against a schema mirroring `exercises.schema.json`'s `$defs.exercise` | Already available, already used elsewhere in the codebase (backend routes), turns upstream dataset drift into a single loud validation error instead of scattered undefined-property bugs deep in the matcher |

**Key insight:** This phase's "hand-rolling" risk isn't in typical web-app problems (auth, validation middleware) — it's in string-matching correctness. The one library worth pulling in (`fastest-levenshtein`) exists specifically because edit-distance math is exactly the kind of "looks simple, has subtle bugs" problem this section exists to flag.

## Common Pitfalls

### Pitfall 1: Assuming the dataset has translated names (misreading D-01)
**What goes wrong:** Building Tier 1 matching logic that tries to match production `name_fr` against a `dataset.name_fr` or `dataset.name.fr` field — which does not exist.
**Why it happens:** D-01's phrasing ("matching tries both name and name_fr... against the dataset's translations") reads naturally as if the dataset has parallel translated names, mirroring how `instructions`/`instruction_steps` work. It doesn't for `name`.
**How to avoid:** Compare production `name` against dataset `name` (primary, English-English, high-precision). Separately compare production `name_fr` against dataset `name` (English) as a supplementary, lower-yield signal — this is the correct realization of D-01's intent given the actual schema, not a literal per-language dataset field lookup.
**Warning signs:** A matcher that treats `dataset.name_fr` as `undefined` everywhere, or crashes/silently skips the name_fr pass because the expected field doesn't exist.

### Pitfall 2: Truncated production reads past 1,000 rows
**What goes wrong:** `supabase.from('exercises').select('*').eq('is_custom', false)` silently returns only the first 1,000 rows (PostgREST default cap) — no error is thrown. Production has ~1,318+ non-custom exercises (evidenced by `scripts/exercise_names.txt`, a snapshot from a prior seed run).
**Why it happens:** The cap is silent by design (no error, no truncation flag in the response body itself unless `count` is requested).
**How to avoid:** Use `.range(from, to)` pagination in a loop (see Pattern 2) or explicitly verify the returned row count against a separate `select('id', { count: 'exact', head: true })` call before trusting the dataset is complete.
**Warning signs:** Match report's total processed count is suspiciously close to exactly 1000; unmatched-legacy count looks too low.

### Pitfall 3: "Manifest" doesn't exist as a literal file — building fetch.ts around a wrong assumption
**What goes wrong:** Spending implementation time looking for a `manifest.json` or checksums file in the cloned repo that isn't there, or worse, silently skipping the "verify against manifest" step because no obvious manifest file is found.
**Why it happens:** IMPORT-01/ROADMAP's wording ("verifies file count against the dataset's manifest") implies a dedicated file. Verified directly via GitHub API (both the repo root and `data/` directory listing) — no such file exists.
**How to avoid:** Treat `data/exercises.json`'s own array (length + each record's `image`/`gif_url` path) as the manifest, per Pattern 1 above.
**Warning signs:** None — this is a documentation/requirement-wording gap the planner should resolve explicitly, not a runtime symptom.

### Pitfall 4: Trusting production `name` uniqueness without a runtime safety check
**What goes wrong:** Building a `Map<normalizedName, row>` for O(1) Tier 1 lookup assumes 1:1 name→row mapping. If any production duplicate exists (schema allows it — no UNIQUE constraint), the `Map` silently drops all but the last row with that name, and the matcher will misreport true match counts.
**Why it happens:** CONTEXT.md's own "effectively unique... per prior team note" framing plus the seed-time dedup logic in `json-to-seed.js`/`csv-to-seed.js` (both dedupe by lowercased name before insert) makes uniqueness look guaranteed — but it was only guaranteed *at that one seed run*, not enforced going forward (e.g., a manually-added exercise via the app, or a future admin insert, could reintroduce a duplicate).
**How to avoid:** Before building the lookup map, group by normalized name and log/report any group with size > 1 as a data-quality warning in the match report (does not need to block the run — but must be visible).
**Warning signs:** N/A until a genuine duplicate exists — but the check costs almost nothing to add proactively.

## Code Examples

### Normalizing exercise names for Tier 1 comparison
```typescript
// Source: derived from observed data — both datasets use the same base vocabulary,
// verified via the "3/4 sit-up" record appearing identically (modulo casing/spacing)
// in both hasaneyldrm/exercises-dataset (id "0001") and scripts/exercise_names.txt
function normalizeExerciseName(raw: string): string {
  return raw
    .normalize('NFKD')                 // decompose accented chars (é → e + combining mark)
    .replace(/[\u0300-\u036f]/g, '')   // strip combining marks (keep ASCII base letters)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');             // collapse whitespace — do NOT strip "/" or "-",
                                        // they're meaningful ("3/4 sit-up", "push-up")
}
```

### Tier 2 fuzzy match with a conservative threshold
```typescript
// Source: fastest-levenshtein README pattern (distance() API), threshold chosen
// conservatively per D-03's precision-first bias — tune empirically once real
// near-duplicate examples are seen (CONTEXT.md explicitly defers exact threshold
// tuning to when the matcher runs against real data)
import { distance } from 'fastest-levenshtein';

function similarityRatio(a: string, b: string): number {
  const d = distance(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

const TIER2_THRESHOLD = 0.87; // conservative starting point — raise toward 0.9+ if
                                // false positives appear during tuning, per precision-first bias

function tier2Match(prodName: string, datasetName: string): boolean {
  return similarityRatio(normalizeExerciseName(prodName), normalizeExerciseName(datasetName)) >= TIER2_THRESHOLD;
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fastest-levenshtein` is the right Tier 2 library choice (package name recalled from training knowledge, not an authoritative source) | Standard Stack, Don't Hand-Roll | Low — registry+slopcheck confirm it's a real, safe, maintained package; worst case the planner substitutes `fuse.js` or another library with no architectural rework needed, since the matcher isolates the similarity function behind `similarityRatio()` |
| A2 | Production has ≥1,318 non-custom exercise rows today | Common Pitfalls (Pitfall 2), Summary | Low-medium — sourced from a static file (`scripts/exercise_names.txt`) generated at a prior seed run, not a live DB query (no live DB access in this research session). If the live count differs significantly, the pagination pattern still handles it correctly (it doesn't hardcode a row count), but the phase's expected-volume framing (Assumptions Log entries A3/A4) could be off |
| A3 | Tier 1 exact-name match will resolve "the large majority" of the 1,324 dataset exercises against production | Summary, Anti-Patterns | Medium — this is an informed prediction from lineage evidence (same ExerciseDB-style taxonomy, near-identical counts, an exact spot-check match on "3/4 sit-up"), not an empirical result. CONTEXT.md's D-04/D-09 explicitly acknowledge this can only be confirmed once the matcher actually runs — if wrong, the planner's assumed "low ambiguous volume" framing for D-09's top-N presentation choice should be revisited |
| A4 | Production's legacy `body_part`/`equipment`/`target_muscle` data derives from Kaggle `omarxadel/fitness-exercises-dataset`, itself ExerciseDB-lineage, same lineage family as `hasaneyldrm/exercises-dataset` | Summary, Architecture Patterns (Pattern re: Tier 3) | Low — directly evidenced by `scripts/csv-to-seed.js`'s header comment citing the exact Kaggle URL and the matching `body_part` enum values; not verified that `hasaneyldrm/exercises-dataset` itself is *literally* the same corpus rather than a similar independent one, though the shared `body_part` enum (`waist`, `lower arms`, etc.) and `gif_url`/`media_id`/attribution-to-Gym-visual pattern make this highly likely |
| A5 | The `SUPABASE_PUBLISHABLE_KEY`/`EXPO_PUBLIC_SUPABASE_KEY`-style publishable key is sufficient for this phase's reads (no service-role key needed) | Architecture Patterns (Pattern 3) | Low — directly verified against the `read_exercises` RLS policy text in `001_initial_schema.sql`; the only way this is wrong is if a later migration overrode/removed that policy, which a `grep -r "read_exercises"` across migrations did not surface |

**If this table is empty:** N/A — see entries above.

## Open Questions (RESOLVED)

> All three questions were closed during Phase 02 planning (2026-08-15). Each carries an inline
> `RESOLVED:` marker naming the plan/task that closes it. None gate execution.

1. **Exact production exercise row count and any existing name duplicates**
   - What we know: `scripts/exercise_names.txt` shows 1,318 unique names as of the last seed-generation run; the DB schema has no UNIQUE constraint on `name`.
   - What's unclear: The live count today (rows may have been added/edited since that file was generated), and whether any duplicate names currently exist in production.
   - Recommendation: `match.ts` should compute this itself at runtime (per Pattern 2 + the Pitfall 4 safety check) rather than the planner hardcoding an assumed count anywhere in the plan. Do not gate planning on a live `\d exercises`/SQL query — the pagination + dedup-check pattern above makes the script self-verifying regardless of the actual count.
   - **RESOLVED:** Answered at runtime, never assumed. **02-02 Task 3** (`lib/supabase-client.ts`) reads the live `exercises` table with keyset pagination and no hardcoded row count. **02-04 Task 1** (`lib/matcher.ts`) exports `findDuplicateNames(production)` and builds an array-valued name index, so duplicate production names surface in the report's `warnings.duplicate_production_names` (threat `T-02-10`) instead of collapsing silently. **02-04 Task 2** asserts both behaviours against fixtures. No plan hardcodes 1,318 or 1,324.

2. **Real match-tier volumes (how many ambiguous/unmatched-legacy/unmatched-new rows actually result)**
   - What we know: Strong lineage evidence suggests high Tier 1 hit rate; CONTEXT.md's D-04/D-09/D-10 all explicitly defer their final shape to "once real data is seen."
   - What's unclear: The actual numbers — could only be resolved by running `match.ts` against real production + real dataset data, which is implementation, not research.
   - Recommendation: The planner should design the report schema and Tier 3/ambiguous-presentation logic to be **cheap to re-tune** (e.g., threshold as a named constant, not hardcoded inline in multiple places) rather than trying to pre-guess exact numbers. Plan for a "run once, inspect report, adjust threshold, re-run" loop as an explicit task, not a single-pass implementation.
   - **RESOLVED:** Planned as an explicit measure-then-tune loop rather than a guess. **02-06 Task 1** performs the first real dry run and a structural report check; **02-06 Task 2** is the dedicated Tier 2 threshold tuning iteration (single named threshold constant, re-run and re-inspect); **02-06 Task 3** is the human review/approval checkpoint on the resulting report. No plan pre-commits to an expected tier volume.

3. **Whether `hasaneyldrm/exercises-dataset`'s upstream `main` branch could change between the time this research was done and Phase 2 execution**
   - What we know: `git clone --depth 1` always pulls the current `main` HEAD; the schema/counts verified today (2026-08-15, repo `pushed_at: 2026-07-16`) are a snapshot.
   - What's unclear: Whether the repo owner will push updates before this phase executes.
   - Recommendation: The zod-schema-validation pattern (Don't Hand-Roll) exists specifically to make any drift a loud, early failure rather than a silent one — the planner should include it as a task, not treat today's schema as permanently locked-in without a runtime check.
   - **RESOLVED:** Drift is a loud runtime failure on every run, and today's snapshot is never treated as locked in. **02-02 Task 1** defines `DatasetExerciseArraySchema` in `lib/types.ts`; **02-03 Task 1** `loadDatasetJson()` parses through that schema and lets `ZodError` propagate, and `verifyDataset()` compares `exercises.json`'s array length against live `images/`/`videos/` counts with no hardcoded expected count (so legitimate upstream growth passes, a corrupt/partial clone fails); **02-03 Task 2** re-labels a `ZodError` as a schema-drift failure and exits non-zero with no report written (D-11); **02-05 Task 3** re-validates on every `match.ts` run. Threat `T-02-06` tracks this.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `git` | `git clone --depth 1` (IMPORT-01) | ✓ | 2.53.0 | — |
| `node` | Running the scripts | ✓ | v26.4.0 (well above the `engines.node >=18.0.0` floor in root `package.json`) | — |
| `npm` | Package install | ✓ | 11.17.0 | — |
| `tsx` (via `npx`) | Running `.ts` scripts without a build step | ✓ | 4.21.0 resolves via `npx tsx` today; `backend/api/package.json` pins `^4.19.0` | — |
| `fastest-levenshtein` | Tier 2 fuzzy matching | ✗ (not yet installed anywhere in the monorepo) | — | Install via `npm install fastest-levenshtein` — no viable in-repo fallback exists (confirmed via grep across all `package.json` files) |
| Network access to `github.com` / `raw.githubusercontent.com` / `api.github.com` | Dataset clone + (this research session's) verification | ✓ (verified during this session) | — | — |
| Network access to the live Supabase project | Reading production `exercises` | Not verified in this session (no live DB query performed — research operated entirely from migration files) | — | If unavailable at execution time, `fetch.ts`/`match.ts` should fail loudly with a clear "cannot reach Supabase" error, not silently produce a report based on stale/cached data |

**Missing dependencies with no fallback:**
- `fastest-levenshtein` must be installed before `match.ts` can run (Tier 2 has no viable hand-rolled substitute per the Don't Hand-Roll guidance above — though the planner could technically implement Tier 1+3 only and defer Tier 2 if this blocks unexpectedly, that would violate IMPORT-02's explicit "3-tier" requirement).

**Missing dependencies with fallback:**
- None beyond the above — everything else needed (git, node, npm, tsx, supabase-js, zod) is already present/available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 (`backend/api/package.json` — the only test framework configured anywhere in the monorepo; root has no test runner) |
| Config file | `backend/api/vitest.config.*` (not directly relevant — this phase's scripts live at repo root under `scripts/`, outside `backend/api`'s test scope) |
| Quick run command | N/A — this phase has no existing test file coverage; see Wave 0 Gaps |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | Fetch clones dataset, verifies file count, fails loudly on mismatch | unit | `npx vitest run scripts/exercise-import/fetch.test.ts` (proposed — test the verification logic against a mocked/fixture directory tree, not a real network clone) | ❌ Wave 0 |
| IMPORT-02 | 3-tier matcher categorizes every dataset exercise correctly; zero DB writes; excludes `is_custom=true` and `coach_exercises` | unit | `npx vitest run scripts/exercise-import/match.test.ts` (proposed — test `tier1Match`/`tier2Match`/`tier3Match`/`normalizeExerciseName` as pure functions against fixture data, independent of live Supabase/dataset) | ❌ Wave 0 |

**Note on test strategy:** Because this phase's correctness depends on real data neither Context7 nor this research session had DB/network access to fully snapshot, unit tests should target the **pure logic** (normalization, tier decision functions, report-shape construction) against small hand-written fixture arrays — not the live clone/live DB integration paths, which are better exercised via a manual dry-run (`npx tsx fetch.ts && npx tsx match.ts` against real data) as the actual verification step for this phase, consistent with "zero DB writes... produces a written report" being an observable, manually-inspectable outcome.

### Sampling Rate
- **Per task commit:** `npx vitest run scripts/exercise-import/*.test.ts` (once created in Wave 0)
- **Per wave merge:** Same command (no separate "full suite" distinct from this phase's own tests — root has no monorepo-wide test aggregation)
- **Phase gate:** A full manual `fetch.ts` + `match.ts` run against real data, with human inspection of `match-report.md`, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/api` or root — decide where `vitest` config lives for `scripts/exercise-import/*.test.ts` (root `package.json` currently has no test runner configured at all; simplest path is adding a minimal root-level `vitest.config.ts` scoped to `scripts/`, or colocating tests under `backend/api/test/` — planner's call)
- [ ] `scripts/exercise-import/lib/normalize.test.ts` — covers normalization edge cases (accents, "3/4", punctuation)
- [ ] `scripts/exercise-import/match.test.ts` — covers Tier 1/2/3 decision logic and report-shape output against fixtures
- [ ] Framework install: `vitest` is already a `backend/api` devDependency; if tests are placed outside `backend/api`, a root-level `vitest`/`@vitest/coverage-v8` devDependency addition is needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Script is unauthenticated (publishable key only); no user-facing auth surface |
| V3 Session Management | No | N/A — no session state |
| V4 Access Control | Yes | Rely entirely on the existing `read_exercises` RLS policy (`is_custom = FALSE OR user_id = auth.uid()`) rather than any app-level filtering logic — do not construct a service-role client "to be safe," since that would grant broader access than the phase needs (least privilege) |
| V5 Input Validation | Yes | `zod` schema validation of the parsed `exercises.json` before it's used anywhere in matching logic (see Don't Hand-Roll) — the dataset is an external, mutable upstream source (`git clone` of someone else's repo), not a trusted internal input |
| V6 Cryptography | No | No secrets generated/stored by this phase; only reads an existing env var (`SUPABASE_URL` + a publishable key, which is meant to be public per Supabase's own key-naming convention) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/corrupted upstream dataset content (e.g. a compromised `hasaneyldrm/exercises-dataset` `main` branch pushing unexpected data shapes or path-traversal-crafted `image`/`gif_url` values) | Tampering | zod schema validation (rejects unexpected shapes) + the existing path pattern checks in `exercises.schema.json` (`^images/.+\.(jpg|jpeg|png)$`, `^videos/.+\.gif$`) should be re-validated in `fetch.ts`, not trusted blindly, before ever joining those paths with `datasetRoot` on disk |
| Accidentally granting write/service-role privilege to a read-only script | Elevation of Privilege | Explicitly use the publishable key (Pattern 3) — no `SUPABASE_SERVICE_KEY` should appear anywhere in this phase's code or `.env.example` additions |

## Sources

### Primary (HIGH confidence)
- `https://api.github.com/repos/hasaneyldrm/exercises-dataset/contents/` and `.../contents/data` — direct GitHub API calls, confirmed repo file listing and absence of a manifest file
- `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.schema.json` — full raw JSON Schema fetched via `curl`, not summarized
- `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json` (partial, first 3000 bytes via HTTP range request) — confirmed real record shape and the "3/4 sit-up" spot-check match against production data
- `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/NOTICE.md` — full raw attribution/license text
- `https://api.github.com/repos/hasaneyldrm/exercises-dataset/git/trees/{images,videos}` — confirmed exactly 1,324 files in each directory
- `C:\ziko-platform\supabase\migrations\001_initial_schema.sql`, `004_exercises_extended.sql`, `031_exercises_name_fr.sql`, `055_coach_exercises_schema.sql`, `20260814_exercise_media_schema.sql` — full read, confirmed no UNIQUE constraint on `name`, confirmed `read_exercises` RLS policy text, confirmed `exercise_import_log` schema
- `C:\ziko-platform\scripts\csv-to-seed.js`, `json-to-seed.js`, `exercise_names.txt` — confirmed production legacy data's Kaggle lineage and seed-time name-dedup behavior
- `npm view fastest-levenshtein version/time.created/repository.url/scripts.postinstall`, `slopcheck scan --pkg npm fastest-levenshtein --json` — live registry + slopcheck verification

### Secondary (MEDIUM confidence)
- `https://supabase.com/docs/reference/javascript/select`, `https://dev.to/michelfaure/why-your-supabase-query-stops-at-exactly-1000-rows-and-never-tells-you-4g57` (WebSearch, cross-referenced against official Supabase docs link in the same result set) — confirms the 1000-row default cap and `.range()` pagination requirement

### Tertiary (LOW confidence)
- Prediction that Tier 1 exact-name matching will resolve "the large majority" of rows (Assumptions Log A3) — informed by strong circumstantial lineage evidence, not an empirical run against real data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `fastest-levenshtein`/`tsx`/`@supabase/supabase-js`/`zod` versions all verified live against the npm registry or already present in the repo
- Architecture: HIGH — dataset schema and production schema both independently verified via direct API/file reads, not recalled from training data
- Pitfalls: HIGH for Pitfalls 1-3 (schema-verified facts), MEDIUM for Pitfall 4 (uniqueness risk is real but unquantified without live DB access)
- Match-volume predictions: MEDIUM — informed estimate, explicitly flagged as requiring empirical confirmation once the matcher runs (per CONTEXT.md's own framing of D-04/D-09/D-10)

**Research date:** 2026-08-15
**Valid until:** ~7 days for the dataset-schema findings (upstream `hasaneyldrm/exercises-dataset` `main` branch could change without notice — re-verify via `fetch.ts`'s own zod validation at execution time regardless); ~30 days for the production-schema findings (stable, migration-file-backed)
