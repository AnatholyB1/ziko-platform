---
phase: 6
slug: smart-inventory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test infrastructure exists in this project |
| **Config file** | none |
| **Quick run command** | N/A — all verification is manual |
| **Full suite command** | N/A |
| **Estimated runtime** | ~5–10 min manual walkthrough |

---

## Sampling Rate

- **After every task commit:** Visual inspection of changed files (grep for required patterns)
- **After every plan wave:** Manual app smoke test covering wave deliverables
- **Before `/gsd:verify-work`:** Full manual walkthrough of all 5 success criteria
- **Max feedback latency:** N/A (no automated tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| DB migration | 01 | 1 | PANTRY-01 | grep | `grep -r "pantry_items" supabase/migrations/` | ✅ | ⬜ pending |
| PluginLoader registration | 01 | 1 | PANTRY-01 | grep | `grep "plugin-pantry" apps/mobile/src/lib/PluginLoader.tsx` | ❌ W0 | ⬜ pending |
| registry.ts wiring | 01 | 1 | PANTRY-01 | grep | `grep "pantry" backend/api/src/tools/registry.ts` | ❌ W0 | ⬜ pending |
| Add item form | 02 | 2 | PANTRY-01 | manual | Run app → Pantry → Add Item | N/A | ⬜ pending |
| Edit item | 02 | 2 | PANTRY-02 | manual | Run app → tap item → edit fields | N/A | ⬜ pending |
| Delete with confirm | 02 | 2 | PANTRY-03 | manual | Run app → swipe item → confirm delete | N/A | ⬜ pending |
| Low-stock badge | 03 | 2 | PANTRY-04 | manual | Set threshold, reduce qty | N/A | ⬜ pending |
| Barcode scan | 03 | 3 | PANTRY-05 | manual | Scan barcode → name auto-fills | N/A | ⬜ pending |
| AI tools | 04 | 3 | PANTRY-06 | manual+curl | POST /ai/chat "Add 500g chicken breast" → check pantry_items | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test infrastructure exists. The following grep-verifiable checks serve as Wave 0 registration guards:

- [ ] `grep -r "plugin-pantry" apps/mobile/src/lib/PluginLoader.tsx` — plugin registered in loader
- [ ] `grep -r "pantry_items" supabase/migrations/` — migration 022 exists
- [ ] `grep "pantry" backend/api/src/tools/registry.ts` — AI tools registered

*These can be checked after Wave 1 (infrastructure plan).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Add pantry item saves to Supabase | PANTRY-01 | No test infra | Open app → Pantry tab → tap + → fill form → Save → confirm row in Supabase dashboard |
| Edit item pre-fills form | PANTRY-02 | No test infra | Tap existing item → edit inline → confirm updated value in list |
| Delete with confirmation prompt | PANTRY-03 | No test infra | Swipe/long-press item → confirm modal → item removed from list |
| Low-stock badge appears | PANTRY-04 | No test infra | Set threshold=2 on item, set qty=1 → confirm badge visible in list |
| Barcode scan auto-fills name | PANTRY-05 | No test infra | Tap barcode button → point camera at product → confirm name field populated |
| Grouping by storage location | PANTRY-01 | No test infra | Add fridge/freezer/pantry items → confirm grouped sections in dashboard |
| Expiry color indicators | PANTRY-06 | No test infra | Add items with past, today, 3-day, 10-day expiry dates → confirm red/red/yellow/green |
| AI chat adds pantry item | PANTRY-06 | Requires live backend | POST /ai/chat {"messages":[{"role":"user","content":"Add 500g chicken breast to my pantry"}]} → check pantry_items table |

---

## Validation Sign-Off

- [ ] All tasks have grep-verifiable acceptance criteria or manual test instructions
- [ ] Wave 0 registration guards checked after infrastructure plan
- [ ] Barcode scan tested on physical device (not simulator — camera required)
- [ ] AI tool test run against staging backend
- [ ] `nyquist_compliant: true` set in frontmatter when all checks pass

**Approval:** pending
