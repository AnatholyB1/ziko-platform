---
phase: 28
slug: ui-design-mon-coach
workstream: milestone-mobile
status: in-progress
created: 2026-05-18
context_updated: 2026-05-18
depends_on:
  - Phase 27 (Spike — Mandatory Plugin Pattern)
opens_gate_for:
  - Phase 29 (Plugin "Mon coach" — Full Implementation)
requirements:
  - COACH-10
---

# Phase 28 — UI Design: Mon coach Plugin

## Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| SC1: Design mockup covering 3 states | PASS | `coach.jsx` (primary) + Figma cloud `iFPAXWrRLsl3OkUtYUifqW` (bonus) — 5 frames confirmed |
| SC2: UI-SPEC.md approved | PASS | `grep "status: approved" 028-UI-SPEC.md` — line 4 match |
| SC3: Light sport theme + Ionicons | PASS | Checker sign-off in UI-SPEC — all 6 dimensions passed 2026-05-18 |

**Phase 28: VERIFIED COMPLETE — 2026-05-19**

---

## Goal

A complete visual design contract for the "Mon coach" plugin exists before any mobile screen is built, fixing the design-first gate.

## Key Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| UI-SPEC.md (design contract) | `.planning/workstreams/milestone-mobile/phases/28-ui-design-mon-coach/028-UI-SPEC.md` | APPROVED 2026-05-18 |
| Claude Design mockup | `C:\Users\Anatholy\Downloads\ziko\coach.jsx` | ✓ DONE 2026-05-18 |
| Figma cloud file | https://www.figma.com/design/iFPAXWrRLsl3OkUtYUifqW | ✓ DONE 2026-05-19 (bonus) |
| Checker sign-off | `/gsd-ui-check 28` all 6 dimensions | Pending |

## Success Criteria (updated from discuss-phase)

1. `028-UI-SPEC.md` exists with exact colors, shadow values, typography, copy for all 3 states. **DONE.**
2. `coach.jsx` Claude Design mockup exists covering States A/B/C + ConfirmRevocationModal + Settings row. **DONE 2026-05-18.**
3. `/gsd-ui-check 28` passes all 6 dimensions. **Pending — must complete before Phase 29.**

> **Decision (2026-05-18 discuss):** COACH-10 "Figma file via /gsd-ui-phase" is satisfied by `coach.jsx` + `028-UI-SPEC.md`. No Figma cloud file required. `coach.jsx` is the canonical visual reference with the same pixel-for-pixel authority.

## Design Constraints (from approved UI-SPEC)

- Stack: Expo SDK 54 / React Native 0.81 / NativeWind v4 — NOT web
- No StyleSheet — inline style objects or NativeWind classes only
- Icons: Ionicons from `@expo/vector-icons`
- Shadow: `shadowOpacity: 0.08`, `shadowRadius: 12`, `elevation: 3`
- `paddingBottom: 100` on all ScrollViews (tab bar clearance)
- No dark mode variants

## Phase 28 Completion Gate

Phase 29 is unblocked when ALL three are true:
- [x] `028-UI-SPEC.md` written and approved
- [x] `coach.jsx` added to Claude Design bundle (`C:\Users\Anatholy\Downloads\ziko\`)
- [ ] `/gsd-ui-check 28` all 6 dimensions PASS

## Plans

| Plan | Objective | Status |
|------|-----------|--------|
| 28-01-PLAN.md | UI-SPEC: Design Contract | Complete (retrospective) |
| 28-02-PLAN.md | Figma Mockup Generation | **Complete 2026-05-19** — coach.jsx (primary) + Figma cloud file (bonus, 5 frames with Higgsfield coach portrait) |
| 28-03-PLAN.md | Phase Verification & ROADMAP Update | Pending |

## Claude Design Mockup

**File:** `C:\Users\Anatholy\Downloads\ziko\coach.jsx`
**Wired in:** `index.html` script tag added
**Components:** `StateA`, `StateB`, `StateC`, `RevocationModal`, `CoachCard`, `CoachPreviewAll` (side-by-side preview)
**New icons added to bundle.jsx:** `person-add`, `shield-check`, `trending-up`, `info-circle`, `alert-circle`, `checkmark-circle`, `trash-outline`, `loader`, `person-outline`

## Key Decisions from Discuss-Phase (2026-05-18)

- **D-01:** Claude Design mockup (`coach.jsx`) replaces Figma cloud file — same canonical authority
- **D-02:** Checker must PASS all 6 dimensions before Phase 29 planning begins
- **D-03:** Settings section (Component #6 in UI-SPEC) is a Phase 29 implementation detail, not a Phase 28 deliverable
- **D-04:** `coach.jsx` adds stats row in State C (séances + progression %) — Phase 29 implements with real API data
- **D-05:** Registry-driven mandatory plugin from Phase 27: `mandatory: true` in coach manifest (carried forward)
