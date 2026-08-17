# Phase 4: Mobile Consumption & Attribution - Research

**Researched:** 2026-08-17
**Domain:** React Native (Expo) media rendering, Supabase Storage public URLs, TanStack Query cache versioning, bilingual content rendering
**Confidence:** HIGH

## Summary

This phase is a pure consumption/rendering phase — no new packages, no schema changes, no backend work. Every data source it needs (`exercises.image`, `.gif`, `.instructions_fr`, `.instruction_steps`) already exists in production (migrations `20260814_exercise_media_schema.sql`, `20260815_exercises_merge_backup_and_i18n.sql`) and is already populated for 1,318/1,324 rows by the completed Phase 3 merge. The `04-UI-SPEC.md` (approved) already locks every pixel value, color, and copy string needed — this research focuses on verifying the *code-level* integration points the UI-SPEC references but doesn't fully resolve: the exact Supabase Storage URL-building convention, the exact `expo-image` usage precedent, the exact `instruction_steps` shape/typing, the third (previously unflagged) TanStack Query consumer of `exercises`, and the absence of a query-cache persistence layer (which changes the risk calculus of MOBILE-06).

**Primary recommendation:** Follow the codebase's existing `supabase.storage.from(BUCKET).getPublicUrl(path)` pattern (seen in `avatar.tsx`/`profile/index.tsx` for the `avatars`/`profile-photos` buckets) with bucket `'exercise-media'`, build both URLs in the two touched files, render via `expo-image`'s `<Image>` (already a dependency, already used with `contentFit` in `app/(app)/ai/index.tsx`), wire `instruction_steps[locale] ?? instruction_steps.en ?? []` directly (no parsing needed — it's already JSONB, and `Locale` type `'fr' | 'en'` matches the JSON keys exactly), and bump three query keys to a versioned form, not two — `ExercisePicker.tsx`'s `SearchOverlay.tsx` sibling also queries `exercises` but does not render media, so it needs no version bump (documented below, not a silent gap).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public media URL construction | Mobile client (Expo) | — | DB stores relative paths by design (Phase 1 D-02); Supabase Storage client builds the public URL locally, no backend round-trip needed (bucket is public-read) |
| GIF/image rendering + autoplay/loop | Mobile client (Expo, `expo-image`) | — | Native image component, no server involvement |
| Bilingual name/instructions selection | Mobile client (`plugin-sdk` i18n) | — | Locale is a client-only UI concern (`useI18nStore`), data for both languages is already in the row from Supabase |
| Attribution badge enforcement | Mobile client (`packages/ui` shared component) | — | Purely a rendering contract; `<AttributedMedia>` is a shared React Native component, not a backend concern |
| Query cache versioning | Mobile client (TanStack Query key) | — | In-memory cache scoping, no server involvement |
| Exercise media/instructions data | Supabase Postgres (`public.exercises`) | Supabase Storage (`exercise-media` bucket, public) | Already fully owned/populated by Phases 1–3; this phase only reads |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-image` | `~3.0.11` | Renders the GIF hero and PNG thumbnails, including animated GIF autoplay/loop | [VERIFIED: apps/mobile/package.json line 52] Already a direct dependency, already used with `contentFit` in `app/(app)/ai/index.tsx:14,322,325`. No config needed for GIF looping — GIFs authored with an infinite loop count animate automatically. |
| `@tanstack/react-query` | `^5.62.0` | Query keys for `exercise`, `exercises-picker` data, version bump for MOBILE-06 | [VERIFIED: apps/mobile/package.json line 28] Already the app-wide data-fetching layer, `QueryClient` configured in `apps/mobile/app/_layout.tsx:43-50` with `staleTime: 5min`, no persister attached. |
| `@ziko/plugin-sdk` (`useTranslation`, `useI18nStore`, `Locale`) | workspace package | `tExercise(name, nameFr)` for bilingual name, `locale` for `instruction_steps[locale]` selection | [VERIFIED: packages/plugin-sdk/src/i18n.ts:1706-1752, re-exported via src/index.ts:7] Already the established pattern, used in 9+ other mobile files (`app/(app)/index.tsx`, `store/index.tsx`, etc.) |
| `@ziko/ui` (new `AttributedMedia` export) | workspace package | Shared attribution-enforcing component | [VERIFIED: packages/ui/package.json — `main: ./src/index.ts`, no build step, Metro/TS resolves source directly] New file only needs to be added under `packages/ui/src/components/` and re-exported from `packages/ui/src/index.ts` — no build/publish step. |

No new npm packages are introduced by this phase.

### Supporting
None beyond the above — `@expo/vector-icons` (Ionicons, already used in both touched files) supplies the `barbell-outline` fallback icon.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-image` | React Native's built-in `Image` | RN's `Image` does support animated GIFs on both platforms today, but the codebase has already standardized on `expo-image` for remote/animated content (caching, `contentFit`, `transition` props) — introducing RN `Image` here would be an inconsistent second pattern for no benefit. |

**Installation:** none — all dependencies already present.

## Package Legitimacy Audit

Not applicable — this phase installs zero new packages. `expo-image` is a pre-existing dependency already vetted and in production use elsewhere in the app; no new registry surface is introduced.

## Architecture Patterns

### System Architecture Diagram

```
[public.exercises row]                [exercise-media Storage bucket, public]
  id, name, name_fr                      {exercise_id}/thumb.png
  image, gif  (relative paths) ────┐      {exercise_id}/animation.gif
  instructions_fr, instruction_steps│
  (JSONB {en:[], fr:[]})            │
        │                            │
        │ useQuery(['exercise', ...])│ supabase.storage
        │ useQuery(['exercises-     │   .from('exercise-media')
        │   picker', ...])          │   .getPublicUrl(path)
        ▼                            ▼
 [exerciseId].tsx  ──────────► publicGifUrl ──► <AttributedMedia uri size=180>
   (detail screen)                              ├─ <Image expo-image, contentFit=cover>
                                                 └─ badge "© Gym visual — ..." (D-05: once/screen)
   instruction_steps[locale] ?? .en ?? []
        ▼
   numbered-steps list (Consignes tab)
   or <EmptyState variant="no-data"> if empty

 ExercisePicker.tsx ─────────► publicThumbUrl ──► <Image 40x40, contentFit=cover>
   (row thumbnails)                               (no AttributedMedia — D-06)
                                 null/missing ──► barbell-outline placeholder (40x40 slot)

 SearchOverlay.tsx  ─────────► (selects id,name,category only — no media, OUT OF SCOPE for MOBILE-01/02/03)
```

### Recommended Project Structure
```
packages/ui/src/components/
└── AttributedMedia.tsx      # new — badge + 180px cap + fallback placeholder, exported via packages/ui/src/index.ts

apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx   # hero block replacement, instructions rewire, query key bump
apps/mobile/src/components/ExercisePicker.tsx              # thumbnail insertion, select() column addition, query key bump
```

### Pattern 1: Supabase Storage public URL construction
**What:** DB stores a relative path (e.g. `{uuid}/thumb.png`); client builds the full public URL via the Storage client at render time — never store full URLs in the DB.
**When to use:** Any time `exercise.image` or `exercise.gif` is read for rendering.
**Example:**
```typescript
// Source: apps/mobile/app/(app)/profile/avatar.tsx:109 (established pattern for the 'avatars' bucket)
const { data } = supabase.storage.from('avatars').getPublicUrl(path);
// this phase's equivalent, bucket confirmed in supabase/migrations/20260814_exercise_media_schema.sql:15
const { data: gifUrlData } = supabase.storage.from('exercise-media').getPublicUrl(exercise.gif);
const publicGifUrl = gifUrlData.publicUrl;
```
Do **not** append a cache-busting `?t=timestamp` query param the way `avatar.tsx:111` does for user-uploaded avatars — that pattern exists there because avatars are mutable per-user uploads; `exercise-media` assets are immutable once written by the Phase 3 merge script (same `exercise_id/animation.gif` path is never re-uploaded with different content), so cache-busting would only hurt CDN/image-cache hit rates for no benefit.

### Pattern 2: `expo-image` for remote/animated media
**What:** Use `Image` from `'expo-image'`, not React Native's built-in `Image`.
**When to use:** Hero GIF and picker thumbnails.
**Example:**
```tsx
// Source: apps/mobile/app/(app)/ai/index.tsx:14,322-325 (existing precedent in this codebase)
import { Image } from 'expo-image';

<Image
  source={{ uri: publicGifUrl }}
  style={{ width: '100%', height: '100%' }}
  contentFit="cover"
  transition={150}
/>
```
No extra prop is needed to make a GIF autoplay/loop in `expo-image` — this is native behavior for GIFs with an infinite loop count, confirmed by the UI-SPEC's D-03 note and consistent with `expo-image`'s documented animated-image support.

### Pattern 3: Bilingual content selection
**What:** `useTranslation()` returns `{ t, tExercise, tMuscle, tCategory, tMeal, locale }`; `locale` is typed `'fr' | 'en'` — the exact same two keys used inside `instruction_steps` JSONB (`{en: string[], fr: string[]}`), confirmed against the Phase 3 merge script's write path (`scripts/exercise-import/lib/merge-row.ts:96-98`, which writes `record.instruction_steps` verbatim from the dataset).
**Example:**
```typescript
// Source: packages/plugin-sdk/src/i18n.ts:1712-1734 (tExercise pattern to mirror)
import { useTranslation } from '@ziko/plugin-sdk';

const { tExercise, locale } = useTranslation();
const displayName = tExercise(exercise.name, exercise.name_fr);
const steps: string[] = exercise.instruction_steps?.[locale]
  ?? exercise.instruction_steps?.en
  ?? [];
```
No file currently imports `useTranslation`/`tExercise` in either `[exerciseId].tsx` or `ExercisePicker.tsx` — this phase is the first to wire it into these two files, but the pattern is already established in 9 other mobile screens (`app/(app)/index.tsx:256`, `app/(app)/ai/index.tsx:172`, `profile/settings.tsx:617`, `store/index.tsx:80`, `store/[id].tsx:73`, `BugReportModal.tsx:62`).

### Anti-Patterns to Avoid
- **Re-introducing `JSON.parse`/`.split('\n')`:** `instruction_steps` is already `JSONB` — Supabase's client deserializes it to a plain JS object automatically. Do not `JSON.parse()` it again (it is not a stringified string in this column, unlike the old `instructions` TEXT column the current fallback chain was built for).
- **Hardcoding the bucket name inline in both files:** Existing codebase precedent (`avatar.tsx`, `edit.tsx`, `index.tsx` under `profile/`) hardcodes bucket strings inline per call site rather than centralizing a constant — follow that precedent for consistency (`scripts/exercise-import/lib/merge-row.ts:24` does define a shared `BUCKET` constant server-side, but that's a Node script, not the mobile client; no existing mobile helper/constants file wraps Storage bucket names).
- **Cache-busting query params on immutable Storage assets:** see Pattern 1 — would defeat downstream CDN/image caching for no correctness benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated GIF rendering/looping | Custom frame-stepping animation or `react-native-fast-image` | `expo-image`'s native `<Image>` | Already a dependency, already proven in this codebase for remote images; native animated-GIF support requires no extra config |
| Public URL construction | Manual string concatenation (`${SUPABASE_URL}/storage/v1/object/public/exercise-media/${path}`) | `supabase.storage.from(bucket).getPublicUrl(path)` | The Supabase JS client's `getPublicUrl` already handles the correct URL shape/encoding and is the exact function used by 3 existing call sites in this codebase — manual concatenation risks silent breakage if Supabase's URL scheme changes |
| Bilingual string selection | New locale-switch utility | `useTranslation()`'s existing `locale` value + optional-chaining fallback | The locale store, its type (`'fr'|'en'`), and the fallback convention (`nameFr ?? dict[name] ?? name`) are already established; inventing a second bilingual-selection mechanism for instructions would fragment the pattern |

**Key insight:** Every piece of infrastructure this phase needs (Storage client, i18n store, TanStack Query, `expo-image`, `packages/ui` component pattern) already exists and has 2-9 live precedents elsewhere in this codebase. The only genuinely new code is the `<AttributedMedia>` component itself (already fully specified by `04-UI-SPEC.md` §2) and the two touched screens' rewiring.

## Common Pitfalls

### Pitfall 1: Versioning only 2 of 3 `exercises`-reading query keys
**What goes wrong:** MOBILE-06 names `['exercise', exerciseId]` and `['exercises-picker']` explicitly, but a third consumer exists: `apps/mobile/src/components/SearchOverlay.tsx:44`, `queryKey: ['search_exercises', debouncedQuery]`, `select('id, name, category')`.
**Why it happens:** Not surfaced in CONTEXT.md's code_context section (only the two files from the phase's stated touch scope were flagged).
**How to avoid:** `SearchOverlay.tsx` does **not** select `image`/`gif` and renders no media (confirmed: `select('id, name, category')` at line 48, no `<Image>` in its exercise results section) — it is genuinely out of scope for MOBILE-06's "no screen shows a mix of old/new media" concern, since it shows no media at all. **Do not silently version-bump it as an afterthought and do not silently skip it** — the plan should note it was checked and excluded, so a future auditor doesn't have to re-derive this.
**Warning signs:** If `SearchOverlay.tsx` is ever changed in a future phase to show thumbnails, its query key must be added to the versioned set at that time.

### Pitfall 2: Assuming TanStack Query cache persists across app updates (it doesn't, here)
**What goes wrong:** MOBILE-06's premise ("previously-installed client shows a mix of old/new media") implies a stale-cache risk across app updates. This codebase's `QueryClient` (`apps/mobile/app/_layout.tsx:43-50`) has no persister (no `persistQueryClient`, no `AsyncStoragePersister`, no MMKV-backed persist plugin) — it is a plain in-memory cache with `staleTime: 5min`.
**Why it happens:** On a normal app-store or EAS-Update rollout, the JS process fully restarts on next launch, which already clears any in-memory `QueryClient` — so a query-key version bump has limited *additional* protective effect against the specific "installed client shows stale media after an update" scenario as literally described, beyond what a process restart already provides.
**How to avoid:** Implement the version bump anyway — it's the locked requirement (MOBILE-06 is in REQUIREMENTS.md, not open for reinterpretation) and it's cheap, zero-risk insurance against edge cases (e.g., a user resuming a long-backgrounded app session where `staleTime` hasn't expired, or a future persister being added without this phase's author's knowledge). Document in the plan that the change is defense-in-depth rather than a fix for an observed persistence bug, so a reviewer doesn't go looking for a persister that doesn't exist.
**Warning signs:** None currently — this is a proactive/preventive note, not a bug report.

### Pitfall 3: Treating `instruction_steps` as a string needing `JSON.parse`
**What goes wrong:** The existing fallback chain at lines ~126-136 was built for the old `instructions` TEXT column, which sometimes held a JSON-stringified array. `instruction_steps` is a genuine `JSONB` column — Supabase's PostgREST/JS client deserializes JSONB automatically into a JS object/array, so wrapping it in `JSON.parse()` will throw (it's already an object, not a string) or silently no-op depending on how it's guarded.
**Why it happens:** Muscle memory from the code right above it in the same file.
**How to avoid:** Access it directly as `exercise.instruction_steps?.[locale]` — no parsing.
**Warning signs:** A `try/catch` block around `instruction_steps` access is itself a code smell for this column — the legacy `instructions` TEXT fallback chain is exactly what MOBILE-04 asks to remove, not to reproduce for the new column.

### Pitfall 4: `ExercisePicker`'s `select()` not including `image`
**What goes wrong:** `ExercisePicker.tsx:50` currently selects `'id, name, muscle_groups, equipment, target_muscle'` — no `image` column. Adding a thumbnail `<Image>` without adding `image` to the `select()` string will render `undefined` for every row (silently falls to the missing-media placeholder for 100% of rows, masking the real Phase 3 data).
**Why it happens:** Easy to add UI without touching the query string above it.
**How to avoid:** Add `image` (and only `image` — not `gif`, per D-09's "static thumb.png, not animated gif" for list rows) to the `select()` call, and to the `ExerciseRow` interface (`apps/mobile/src/components/ExercisePicker.tsx:27-33`).
**Warning signs:** If every row shows the placeholder icon after implementation, check the `select()` string first.

## Code Examples

### Detail screen hero — happy + missing-media paths
```tsx
// New composition, following 04-UI-SPEC.md §1-§2, using patterns verified above
const { data: gifUrlData } = exercise?.gif
  ? supabase.storage.from('exercise-media').getPublicUrl(exercise.gif)
  : { data: null };
const publicGifUrl = gifUrlData?.publicUrl ?? null;

<AttributedMedia uri={publicGifUrl} size={heroWidth} showBadge />
```

### ExercisePicker row thumbnail
```tsx
// Source: 04-UI-SPEC.md §3, uses the same getPublicUrl pattern with the 'image' (thumb.png) column
const publicThumbUrl = ex.image
  ? supabase.storage.from('exercise-media').getPublicUrl(ex.image).data.publicUrl
  : null;
```

### Instructions — replacing the fallback chain
```tsx
// Replaces apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx:125-136
const { tExercise, locale } = useTranslation();

const steps: string[] =
  exercise?.instruction_steps?.[locale] ??
  exercise?.instruction_steps?.en ??
  [];

// Claude's-Discretion fallback (CONTEXT.md, per UI-SPEC's locked resolution):
// when instruction_steps is empty AND legacy instructions/instructions_fr TEXT are
// also empty (the 6 unmatched-new rows), render EmptyState — see UI-SPEC Copywriting
// Contract row "Instructions empty state". The UI-SPEC does NOT specify falling back to
// the plain instructions/instructions_fr TEXT block for rows where instruction_steps is
// null but legacy instructions text exists — see Open Questions below.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fake `Démo · 0:42` / `HD` video chrome over a 16:9 placeholder | Real 180×180 square GIF, no chrome, attribution badge | This phase (MOBILE-01/02, D-01/D-02) | Screen now shows real content; square aspect ratio change affects layout below the hero (stat tiles etc. — unaffected structurally, just a taller/shorter hero depending on device width) |
| `JSON.parse`/`.split('\n')` fallback chain on `instructions` TEXT | Direct `instruction_steps[locale] ?? .en ?? []` JSONB read | This phase (MOBILE-04) | Removes a fragile string-parsing code path entirely |
| Exercise media served from `exercisedb.io` (third-party CDN, broken per this milestone's core value statement) | Self-hosted in Supabase Storage `exercise-media` bucket | Phase 1 (already live) | This phase is the final leg — wiring the mobile client to the already-migrated data source |

**Deprecated/outdated:** The 16:9 video-placeholder hero design is fully removed, not deprecated-but-kept — no fallback to the old visual.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `instruction_steps` JSONB always has exactly the shape `{en: string[], fr: string[]}` for every non-null row (never a partial object with only one language key) | Pattern 3, Code Examples | If a row has only `en` populated and no `fr` key at all, `instruction_steps?.[locale]` for `locale='fr'` returns `undefined`, correctly falling through to `.en` — behavior is safe either way, but if a row somehow has neither key the `?? []` catches it. Low risk either way given the fallback chain already handles `undefined`. |
| A2 | No other screen in the mobile app (beyond `[exerciseId].tsx`, `ExercisePicker.tsx`, `SearchOverlay.tsx`) reads `exercises.image`/`.gif`/`.instructions`/`.instruction_steps` via TanStack Query | Pitfall 1, MOBILE-06 scope | A grep-based sweep (`queryKey.*exercise`) covered `apps/mobile/app` and `apps/mobile/src` — a plugin under `plugins/*` reading exercises directly was not separately audited; if one exists and renders media, it would need its own query-key version bump, currently undiscovered |

## Open Questions (RESOLVED)

1. **RESOLVED — Should the plain `instructions`/`instructions_fr` TEXT columns be used as a fallback display when `instruction_steps` is null but the legacy text columns are populated?**
   - What we know: CONTEXT.md flags this explicitly as Claude's Discretion ("whether to fall back to the plain instructions/instructions_fr TEXT columns as a single unstructured block, or show an empty/'no instructions yet' state"). The approved `04-UI-SPEC.md` (which supersedes CONTEXT.md's discretion items with locked pixel/copy values per the standard GSD flow) specifies only the `EmptyState` behavior for "both `instruction_steps` and legacy `instructions`/`instructions_fr` are empty" — it does not explicitly address the case where `instruction_steps` is null/missing but the legacy TEXT columns are non-empty for the same row.
   - What's unclear: For the 6 known unmatched-new exercises (dataset ids 1371, 1394, 1628, 1766, 0576, 0656, per STATE.md), do these rows have `instructions`/`instructions_fr` TEXT populated at all, or are those also empty (since they're unmatched-new inserts, not merge-updated rows)? If `merge-row.ts`'s INSERT path for unmatched-new rows sets `instructions_fr`/`instruction_steps` from the dataset directly (same as the UPDATE path, per `merge-row.ts:96-98` which is shared logic, not branched on insert-vs-update), these 6 rows likely have both `instructions_fr` and `instruction_steps` populated already (they came from the same dataset, just didn't match an existing production row) — meaning the "both empty" case may currently affect **zero** production rows, not the 6 flagged ones.
   - Recommendation: Verify against production (`SELECT id, instructions, instructions_fr, instruction_steps FROM exercises WHERE id IN (...)` for the 6 known ids, or more generally `WHERE instruction_steps IS NULL`) before/during planning to determine whether the "legacy TEXT fallback" question is even reachable in current data, or purely a defensive code path for hypothetical future `needs_review` rows. The UI-SPEC's `EmptyState` "both empty" handling is sufficient either way — no plan-blocking gap — but confirming the row count affected (0 vs 6) will let the planner correctly scope this as either "dead code path, implement per spec and move on" or "confirmed to affect N live rows today."
   - **Resolution (verified during planning against `merge-run.md` check 6):** `instruction_steps not.is.null` count is exactly 1,318 — matching the full non-custom row count. The 6 unmatched-new dataset rows were never actually inserted (deterministic category-CHECK-constraint failure, retried identically across merge runs, tracked separately in STATE.md). So the "both empty" case currently affects **zero** non-custom production rows — the legacy-TEXT fallback branch exists purely for `is_custom=true` coach/user-authored exercises (which carry free-text `instructions` and no structured `instruction_steps` by design, a separate system per REQUIREMENTS.md's Out of Scope table). Plan `04-03-PLAN.md` Task 2 implements the three-branch fallback (`instruction_steps` → legacy prose paragraph → `EmptyState`) exactly on this basis — the legacy branch is live code serving custom exercises today, not dead defensive code.

## Environment Availability

Skipped — this phase has no external tool/service dependencies beyond the already-configured Supabase project and already-installed npm packages (`expo-image`, `@tanstack/react-query`, `@ziko/plugin-sdk`, `@ziko/ui`), all verified present above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no `jest.config.*`, no `*.test.tsx`/`*.test.ts` files, no `"test"` script in `apps/mobile/package.json` or root `package.json` |
| Config file | none — see Wave 0 |
| Quick run command | n/a — no automated test runner configured for `apps/mobile` |
| Full suite command | n/a |

`scripts/exercise-import/` (the Phase 2/3 import pipeline) does have `merge-row.test.ts`, confirming Vitest or similar is available *somewhere* in the monorepo tooling, but it is not wired to `apps/mobile`. Installing/configuring a mobile test framework is out of scope for this phase (visual/UI-heavy React Native screen work with no business-logic branching complex enough to justify introducing a new test harness as a phase side-quest).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOBILE-01 | Hero shows real GIF, no fake chrome | manual-only | — | ❌ no RN test infra |
| MOBILE-02 | Picker rows show thumbnails | manual-only | — | ❌ |
| MOBILE-03 | Attribution badge renders once on detail hero, never on picker rows | manual-only | — | ❌ |
| MOBILE-04 | `instruction_steps` renders as numbered list, no JSON.parse | manual-only | — | ❌ |
| MOBILE-05 | Name/instructions follow locale | manual-only | — | ❌ |
| MOBILE-06 | Query keys versioned, no mixed-media flash after update | manual-only | — | ❌ |

Justification for manual-only across the board: this is a visual React Native phase with no isolated business logic module (the `instruction_steps[locale] ?? .en ?? []` selection is a 3-line inline expression, not a function worth unit-testing in isolation absent an existing test harness) and no mobile test runner exists in this monorepo today. Per the philosophy of not padding validation architecture with theater, the honest state is: this phase's correctness is verified via manual device/simulator inspection against the approved `04-UI-SPEC.md`, consistent with how the rest of `apps/mobile` is currently validated (zero existing `*.test.tsx` files in the app).

### Sampling Rate
- **Per task commit:** manual visual check against `04-UI-SPEC.md` component specs
- **Per wave merge:** manual walk of exercise detail + picker screens with a mix of exercises (has-media, missing-media, `fr` locale, `en` locale)
- **Phase gate:** `/gsd:verify-work` manual verification checklist (no automated suite to gate on)

### Wave 0 Gaps
- None required to block this phase — introducing a full RN test harness (`jest-expo` or similar) is a larger cross-cutting decision outside this phase's scope. If a future phase adds one, `instruction_steps[locale] ?? .en ?? []` selection logic would be a good first unit-test candidate.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase touches no auth flow |
| V3 Session Management | no | — |
| V4 Access Control | no | `exercise-media` bucket is public-read by design (MEDIA-02, already shipped); no new access-control surface introduced |
| V5 Input Validation | marginal | `exercise.gif`/`.image` are DB-controlled relative paths written only by the service-role merge script (Phase 3, not user input) — no untrusted input flows into `getPublicUrl()` in this phase. `debouncedQuery` in `SearchOverlay.tsx` is pre-existing and out of scope. |
| V6 Cryptography | no | No crypto/secrets touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `image`/`gif` column value passed to `getPublicUrl()` | Tampering | Not exploitable here — these columns are written exclusively by the service-role Phase 3 merge script (`storagePaths()` in `merge-row.ts:66-69` generates paths from `exerciseId` only, never from arbitrary dataset text), and RLS/Storage write policy already blocks client writes to `exercise-media` (migration `20260814_exercise_media_schema.sql:11-16`, "no INSERT/UPDATE/DELETE policy"). This phase only *reads* the column, it does not introduce a new write path. |

No new threat surface is introduced by this phase — it is a read/render-only feature built entirely on already-hardened Phase 1-3 infrastructure.

## Project Constraints (from CLAUDE.md)

- **No `StyleSheet`** — use inline style objects (both touched files already follow this; new `AttributedMedia` component must too).
- **Icons: Ionicons names only**, never emoji, passed to `<Ionicons name={...} />` — `barbell-outline` for the fallback placeholder satisfies this.
- **Light sport theme only, no dark mode** — use `useThemeStore((s) => s.theme)`, already the pattern in both files.
- **`showAlert` from `@ziko/plugin-sdk`, never `Alert` from `react-native`** — not directly relevant to this phase (no new alerts introduced), but any error-path code added must respect this if it needs one.
- **Card styling convention** (`borderRadius: 14`, `theme.surface`, `theme.border` 1px, `shadowOpacity: 0.08`/`shadowRadius: 12`/`elevation: 3`) — locked in `04-UI-SPEC.md` §1, matches CLAUDE.md's own "Reusable Assets" note.
- **i18n:** all user-facing strings should use `t('key')` — the `04-UI-SPEC.md` Copywriting Contract provides literal FR/EN strings for new copy (missing-media caption, empty-state text); planner should decide whether these get added as new `t()` dictionary keys in `plugin-sdk/src/i18n.ts` (consistent with CLAUDE.md's stated convention) or inlined as `locale === 'fr' ? '...' : '...'` (matching this phase's otherwise-locale-inline approach for `tExercise`). Given the existing 500+-key dictionary convention and that both touched files will already import `useTranslation()` for `tExercise`/`locale`, **adding proper `t()` keys is the CLAUDE.md-compliant choice** and should be preferred over ad hoc ternaries.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOBILE-01 | Detail screen shows real GIF + thumbnail, fake placeholder removed | UI-SPEC §1 (locked), Pattern 1 (URL construction), Pattern 2 (`expo-image` usage), Code Examples |
| MOBILE-02 | `ExercisePicker` rows show thumbnails | UI-SPEC §3 (locked), Pitfall 4 (`select()` gap), Code Examples |
| MOBILE-03 | `<AttributedMedia>` shared component enforces badge + 180×180 cap | UI-SPEC §2 (locked component contract), Standard Stack (`@ziko/ui` integration), D-06 documented as deliberate scope-narrowing |
| MOBILE-04 | `instruction_steps` wired in, fragile fallback chain removed | Pattern 3, Pitfall 3, Code Examples, Open Question 1 (edge-case fallback scope) |
| MOBILE-05 | Bilingual name + instructions per locale | Pattern 3, Project Constraints (i18n `t()` key convention) |
| MOBILE-06 | TanStack Query key versioned, no mixed-media flash | Pitfall 1 (3rd consumer found — `SearchOverlay.tsx`, confirmed out of scope), Pitfall 2 (no persister exists — defense-in-depth framing) |
</phase_requirements>

## Sources

### Primary (HIGH confidence — verified directly against this codebase)
- `apps/mobile/app/(app)/workout/exercise/[exerciseId].tsx` — full file read, current hero/instructions/query-key code
- `apps/mobile/src/components/ExercisePicker.tsx` — full file read, current row/query-key code
- `apps/mobile/src/components/SearchOverlay.tsx` — third `exercises` consumer, confirmed no media rendering
- `apps/mobile/app/_layout.tsx` — `QueryClient` config, confirmed no persister
- `apps/mobile/app/(app)/profile/avatar.tsx`, `profile/index.tsx`, `profile/edit.tsx` — `getPublicUrl()` precedent
- `apps/mobile/app/(app)/ai/index.tsx` — `expo-image` usage precedent
- `packages/plugin-sdk/src/i18n.ts` — `useTranslation`, `tExercise`, `useI18nStore`, `Locale` type definitions
- `packages/ui/src/index.ts`, `packages/ui/package.json`, `packages/ui/src/components.tsx` — export pattern, no-build-step confirmation, `spacing` scale
- `packages/ui/src/components/EmptyState.tsx` — exact props signature for the empty-instructions state
- `supabase/migrations/20260814_exercise_media_schema.sql` — `image`/`gif` columns, `exercise-media` bucket definition (public, no write policy)
- `supabase/migrations/20260815_exercises_merge_backup_and_i18n.sql` — `instructions_fr`, `instruction_steps` column definitions
- `scripts/exercise-import/lib/merge-row.ts` — `storagePaths()` (folder-per-id, fixed filenames), `instruction_steps`/`instructions_fr` write mapping
- `apps/mobile/package.json` — confirmed `expo-image ~3.0.11`, `@tanstack/react-query ^5.62.0`
- `.planning/config.json` — `nyquist_validation: true` (absent security_enforcement key = enabled), no persistence/test config found

### Secondary (MEDIUM confidence)
- None — all findings for this phase were directly verifiable in-repo; no external library research was required since every dependency used is already present and already has in-codebase precedent.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, every pattern has 2+ existing in-repo precedents
- Architecture: HIGH — UI-SPEC already locks the component contract; this research only fills code-level integration gaps
- Pitfalls: HIGH — all four pitfalls found via direct code inspection (grep + read), not inference

**Research date:** 2026-08-17
**Valid until:** 30 days (stable — no external API/library surface at risk of drifting; only risk is production data changing, e.g. the 6 unmatched-new rows being resolved before Phase 4 executes, which would resolve Open Question 1 favorably)
