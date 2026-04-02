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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~5 | 5 | Established Next.js + i18n + legal foundation |
| v1.1 | ~8 | 4 | First mobile plugin — pantry + AI tools pattern established |
| v1.2 | ~4 | 2 | Data-before-UI strategy, shared catalogue pattern |

### Top Lessons (Verified Across Milestones)

1. **Split data layer from UI layer** — always a separate phase, never mixed. Zero integration surprises in v1.2.
2. **Write SUMMARY one_liners immediately** — missing them costs time at milestone close and makes audit harder
3. **useRef for scan guards** (not useState) — prevents re-render races in camera/barcode flows
4. **`.maybeSingle()` not `.single()`** for optional plugin checks — PGRST116 is a common gotcha
