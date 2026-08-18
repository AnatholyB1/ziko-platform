---
phase: 11
slug: barcode-ui-score-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript type-check (`tsc --noEmit`) + Expo dev build |
| **Config file** | `apps/mobile/tsconfig.json` |
| **Quick run command** | `cd apps/mobile && npx tsc --noEmit` |
| **Full suite command** | `npm run type-check` (from repo root) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/mobile && npx tsc --noEmit`
- **After every plan wave:** Run `npm run type-check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | SCAN-02 | type-check | `cd apps/mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | SCAN-02 | type-check | `cd apps/mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | SCAN-02 | type-check | `cd apps/mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | SCORE-01 | type-check | `cd apps/mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | SCORE-02 | type-check | `cd apps/mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | SCORE-03 | type-check | `cd apps/mobile && npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `plugins/nutrition/src/components/ScoreBadge.tsx` — stub for score badge component
- [ ] `plugins/nutrition/src/components/ProductCard.tsx` — stub for product card
- [ ] `plugins/nutrition/src/components/BarcodeScanner.tsx` — stub for barcode scanner component

*Existing TypeScript infrastructure covers compilation checks; stub files needed for import resolution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera viewfinder displays and scans EAN-13 | SCAN-02 | Requires physical device + barcode | Launch app on device, open log meal, tap Barcode tab, scan a product barcode |
| Product card shows photo, name, brand, macros, Nutri-Score and Eco-Score | SCAN-02 | Requires live UI rendering | After scan, verify ProductCard renders all fields correctly |
| "Not found" message + fallback to manual | SCAN-02 | Requires UI flow | Scan unknown barcode, verify fallback message and manual entry opens |
| Score badge visible in journal entry | SCORE-01, SCORE-02 | Requires UI rendering | Log a barcode meal, open journal, verify badge appears |
| Dashboard widget hidden on days without barcode meals | SCORE-03 | Requires state-dependent UI | Log manual-only meals, verify widget absent; log barcode meal, verify widget present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
