# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.1 — Smart Pantry Plugin

**Shipped:** 2026-04-02
**Phases:** 4 (6–9) | **Plans:** 14 | **Sessions:** ~8

### What Was Built
- Full pantry CRUD plugin with barcode scanner (Open Food Facts), low-stock thresholds, expiry color indicators, storage location grouping
- AI-powered recipe suggestions via `generateObject` — macro-aware (pantry contents + remaining daily calories), serving size adjuster
- Recipe cooking sync → one-tap macro log to Nutrition plugin + pantry quantity decrements
- Rule-based shopping list auto-populated from low-stock items + recipe ingredient adder; native share export

### What Worked
- 4-phase dependency structure was clear and executed cleanly in order — each phase had a precise gate
- Thin Expo Router wrapper pattern (`apps/mobile/app/(app)/(plugins)/pantry/*.tsx`) kept plugin screens isolated
- `pantry_update_item` doubling as add-or-update (upsert by name lookup) reduced AI tool surface area
- `useRef` scan guard pattern (not `useState`) successfully prevented re-render races in barcode scanner — discovered in Phase 6, reused in Phase 11

### What Was Inefficient
- Phase 7 SUMMARY files lacked `requirements-completed` frontmatter — `milestone complete` CLI produced "One-liner:" entries instead of real accomplishments
- Nyquist VALIDATION.md files were not updated post-execution — required retroactive fix in v1.2 (DEBT-04)
- SHOP-03 UX gap (recipe check-off → pantry insert) was identified at the end rather than during planning

### Patterns Established
- Central i18n: all plugin translations in `packages/plugin-sdk/src/i18n.ts` (FR + EN flat dicts) — reference copies in `plugins/<name>/src/i18n/` are docs only
- Cross-plugin navigation uses `router.replace` with full path (e.g. `/(app)/(plugins)/nutrition/dashboard`) — prevent confirm screen from sitting in back-stack
- Nutrition plugin gate uses `.maybeSingle()` not `.single()` — avoids PGRST116 when `user_plugins` row absent
- `calories` column is INTEGER (use `parseInt`), `protein_g/carbs_g/fat_g` are NUMERIC(6,1) (use `parseFloat`)

### Key Lessons
1. Write VALIDATION.md immediately post-execution — retroactive documentation is more expensive than contemporaneous
2. SUMMARY.md `one_liner` field must be filled or the CLI milestone tool produces garbage accomplishments
3. UX gaps that require schema changes (SHOP-03) need to be caught at planning time, not audit time

### Cost Observations
- Model mix: ~60% sonnet, ~35% opus (planning + research), ~5% haiku
- Sessions: ~8 across 4 phases
- Notable: Parallel plan execution (Phase 7 used 3 parallel waves) worked well for backend-frontend splits

---

## Milestone: v1.2 — Barcode Enrichment + Tech Debt

**Shipped:** 2026-04-02
**Phases:** 2 (10–11) | **Plans:** 6 | **Sessions:** ~4

### What Was Built
- `food_products` shared-catalogue Supabase table (migration 024) — RLS via `auth.role() = 'authenticated'` (no user_id), `offApi.ts` caching utility with 7-day TTL
- LogMealScreen 4th Barcode tab — inline CameraView scanner, product card (photo, name, brand, macros per 100g, Nutri-Score + Eco-Score badges), serving size adjuster
- Nutri-Score + Eco-Score badges on journal entry rows (barcode-logged only); daily average Nutri-Score widget on dashboard (hidden when 0 scanned meals)
- SHOP-03 fix: quantity prompt Modal before any shopping list check-off (recipe or low-stock); insert or restock pantry accordingly
- `pantry_log_recipe_cooked` AI tool registered in `registry.ts`; direct Supabase call removed from `RecipeConfirm.tsx`
- Nyquist VALIDATION.md for phases 07 and 09

### What Worked
- Phase 10 / Phase 11 split — data foundation before UI — meant zero schema surprises during UI phase
- ScoreBadge returning `null` for null/unknown grades (instead of empty View) cleanly handled older journal entries
- IIFE pattern for scaled macros in Barcode tab avoided extra state for derived values

### What Was Inefficient
- SCAN-01 and SCAN-03 in REQUIREMENTS.md were left as `[ ]` at phase 10 completion — the CLI didn't pick them up as validated (both are schema work in 10 + UI work in 11)
- Phase 11 required reading the full LogMealScreen before adding a 4th tab — could have had an architecture context file

### Patterns Established
- `food_products` (shared catalogues) use `auth.role() = 'authenticated'` RLS — NOT the standard `auth.uid() = user_id` pattern — because there is no `user_id` column
- `offApi.ts` uses `world.openfoodfacts.org` (production); pantry `barcode.ts` uses `.net` (staging) — these two utilities are intentionally independent and must not be merged
- `ecoscore_grade` returns `'a-plus'` and `'not-applicable'` — ScoreBadge must handle both before render
- Tab font size reduced from 14 → 12 for 4-tab layouts to prevent overflow

### Key Lessons
1. When a requirement spans two phases (schema in phase N, UI in phase N+1), mark it Complete only after the UI phase — update REQUIREMENTS.md at the right time
2. `food_products` as a shared catalogue (no `user_id`) is a non-obvious pattern — document it explicitly in CLAUDE.md for the next engineer
3. Phase 11 UAT: 14/14 tests passed on first run — the data-foundation-first strategy eliminated integration bugs

### Cost Observations
- Model mix: ~55% sonnet, ~40% opus, ~5% haiku
- Sessions: ~4
- Notable: Two phases in one session day — rapid execution when scope is tight and data layer is solid

---

## Milestone: v1.3 — Security + Cloud Infrastructure

**Shipped:** 2026-04-05
**Phases:** 5 (12–16) | **Plans:** 8

### What Was Built
- Upstash Redis sliding window rate limiting — IP flood (200/60s) + per-user AI/scan/tools quotas; 429 with Retry-After
- CORS locked to explicit origins, `secureHeaders()` on all responses, Zod `.strict()` on all AI POST routes
- Supabase Storage: 3 private buckets, path-prefix RLS, signed URL upload bypassing Vercel 4.5MB limit
- Lifecycle cron (Vercel, daily 4am UTC) — purges scan-photos >90d and exports >7d via Promise.allSettled
- Phase 16 regression fix — Phase 15 commit reverted Phase 12+13 middleware; audit detected it; targeted restore

### What Worked
- Milestone audit caught the Phase 15 regression before shipping — saved a security regression reaching production
- Three-phase storage design (bucket creation → signed URLs → lifecycle) kept each phase cleanly scoped
- `Promise.allSettled` for cron cleanup was the right choice — partial failures don't abort the run

### What Was Inefficient
- Phase 16 existed only because Phase 15 introduced a regression — better pre-commit review of middleware file ordering would have prevented it
- Rate limiting constants were hardcoded rather than extracted to a config file — makes future tuning harder

### Patterns Established
- Signed URL upload pattern: mobile → `GET /storage/upload-url` → Supabase Storage directly (bypasses Vercel limit)
- Path-prefix RLS: `(storage.foldername(name))[1] = auth.uid()` — no user_id column on storage objects
- Sliding window over fixed window for rate limiting — prevents boundary spike bursts

### Key Lessons
1. Middleware ordering bugs are silent — a lint or ordered-import check would catch revert regressions
2. The audit step before milestone close paid off immediately: caught a real security regression
3. Lifecycle cleanup with `Promise.allSettled` is the correct pattern for multi-bucket cron jobs

---

## Milestone: v1.4 — Système de Crédits IA & Monétisation

**Shipped:** 2026-04-29
**Phases:** 5 (17–21) | **Plans:** 11

### What Was Built
- Atomic PostgreSQL credit system — SECURITY DEFINER `deduct_ai_credits` RPC with SELECT FOR UPDATE row lock; partial unique index for idempotent earn; `balance_after` trigger; new-user welcome credit trigger
- `creditService.ts` — single authoritative credit logic; `creditCheck`/`creditDeduct` Hono middleware pair gating routes without modifying handlers; premium bypass via `user_profiles.tier`
- Credit API routes, AI cost telemetry, Haiku vision migration (~70% cost reduction), monthly cost ceiling ≤ €0.75 verified
- Fire-and-forget earn hooks on 5 backend tool executors + 6 mobile screens; idempotent via record-UUID keys
- Full credit UI: Zustand creditStore, earn toast (MotiView), exhaustion bottom sheet with 6-activity checklist, balance chip, dual-balance card, cost labels; `/ai/programs/generate` monthly quota route

### What Worked
- Phase dependency order (17 DB → 18 service → 19 routes + 20 earn → 21 UI) was correct — no integration surprises
- Separating the credit deduction concern into a SECURITY DEFINER RPC from the start eliminated the concurrency bug class entirely
- Pre-close audit (`/gsd-audit-milestone`) was highly effective: found the AIBridge truncation bug (200→500 chars) and the CRED-03 dead code — both fixed before tagging
- Fire-and-forget `.catch(() => {})` pattern for earn hooks kept activity saves unblocked — correct architectural choice

### What Was Inefficient
- REQUIREMENTS.md traceability table was not updated after Phase 17 (stale through Phases 18–21) — the audit had to cross-reference VERIFICATION.md files instead of the requirements doc
- Phase 20 ROADMAP.md progress table showed `0/2` after execution — STATE.md and SUMMARY.md were correct but ROADMAP.md was not updated at phase completion
- Audit found 2 gaps (CRED-03, CRED-05) that required 4 fix commits post-audit — these could have been caught earlier with more integration testing

### Patterns Established
- `SECURITY DEFINER + SELECT FOR UPDATE` in credit deduction RPC — the correct pattern for atomic balance ops under serverless concurrency
- `POST /earn` always returns HTTP 200 `{ credited: boolean }` — fire-and-forget endpoints must never 4xx; let the caller ignore failures
- Inline earnCredit helper in plugins (not cross-package import) — plugins cannot import from `apps/mobile/src`; 13-line inline is acceptable duplication
- `workoutStore` uses `require()` for creditStore import — avoids circular Zustand store dependency
- AIBridge 402 body size: always size the slice to the known-bounded max response size, not an arbitrary small constant

### Key Lessons
1. Update REQUIREMENTS.md traceability table after each phase — stale requirements docs create audit overhead
2. Update ROADMAP.md progress table at phase completion, not milestone close — prevents accumulation of stale entries
3. The `/gsd-audit-milestone` step is worth the time: it found 2 real bugs in v1.4 that would have shipped broken
4. Size error response body slices to the actual max payload size — a 200-char limit on a 250-char response is a silent failure mode

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~5 | 5 | Established Next.js + i18n + legal foundation |
| v1.1 | ~8 | 4 | First mobile plugin — pantry + AI tools pattern established |
| v1.2 | ~4 | 2 | Data-before-UI strategy, shared catalogue pattern |
| v1.3 | ~6 | 5 | Security hardening + audit-before-close catches regression |
| v1.4 | ~12 | 5 | Gamified credit system — DB-first concurrency safety, pre-close audit finds 2 bugs |

### Top Lessons (Verified Across Milestones)

1. **Split data layer from UI layer** — always a separate phase, never mixed. Zero integration surprises in v1.2, v1.4.
2. **Write SUMMARY one_liners immediately** — missing them costs time at milestone close and makes audit harder
3. **useRef for scan guards** (not useState) — prevents re-render races in camera/barcode flows
4. **`.maybeSingle()` not `.single()`** for optional plugin checks — PGRST116 is a common gotcha
5. **Run `/gsd-audit-milestone` before close** — caught a security regression (v1.3) and 2 functional bugs (v1.4)
6. **Keep REQUIREMENTS.md traceability current** — stale traceability forces audit to cross-reference VERIFICATION.md files
