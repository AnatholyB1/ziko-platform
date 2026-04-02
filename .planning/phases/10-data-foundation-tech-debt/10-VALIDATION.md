---
phase: 10
slug: data-foundation-tech-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc`) via `npm run type-check` |
| **Config file** | `tsconfig.json` in each package |
| **Quick run command** | `cd /c/ziko-platform && npm run type-check` |
| **Full suite command** | `cd /c/ziko-platform && npm run type-check` |
| **Estimated runtime** | ~30 seconds |

No Jest / Vitest configured in this project. Validation is TypeScript compile + manual UAT.

---

## Sampling Rate

- **After every task commit:** Run `npm run type-check`
- **After every plan wave:** Run `npm run type-check`
- **Before `/gsd:verify-work`:** Type-check green + human UAT of Modal prompts + tool execution
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | SCAN-01, SCAN-03 | manual | verify migration file exists | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | SCAN-01 | compile | `npm run type-check` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | DEBT-01, DEBT-02 | manual UAT | `npm run type-check` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | DEBT-03 | manual + compile | `npm run type-check` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 3 | DEBT-04 | documentation | N/A | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/024_food_products.sql` — covers SCAN-01, SCAN-03
- [ ] `plugins/nutrition/src/utils/offApi.ts` — covers SCAN-01 utility layer
- [ ] `plugins/pantry/src/screens/ShoppingList.tsx` (modify) — covers DEBT-01, DEBT-02
- [ ] `backend/api/src/tools/pantry.ts` (modify) — covers DEBT-03
- [ ] `backend/api/src/tools/registry.ts` (modify) — covers DEBT-03
- [ ] `plugins/pantry/src/screens/RecipeConfirm.tsx` (modify) — covers DEBT-03
- [ ] `.planning/phases/07-ai-recipe-suggestions/07-VALIDATION.md` — covers DEBT-04
- [ ] `.planning/phases/09-smart-shopping-list/09-VALIDATION.md` — covers DEBT-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `food_products` table exists in DB | SCAN-01 | Requires Supabase migration apply | Apply migration 024 and verify table in Supabase dashboard |
| `getOrFetchProduct` cache hit on 2nd call | SCAN-01 | Network call mock not available | Call twice with same barcode, verify no second API call via network log |
| Recipe checkoff shows Modal, inserts/updates pantry | DEBT-01 | React Native UI interaction | Tap recipe shopping item, enter qty, confirm — verify pantry updated |
| Low-stock checkoff shows Modal, sets exact qty | DEBT-02 | React Native UI interaction | Tap low-stock shopping item, enter qty, confirm — verify pantry qty = entered value |
| `pantry_log_recipe_cooked` executes via AI tool | DEBT-03 | Requires backend running | Ask AI to log recipe cooked, verify tool fires and no console error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
