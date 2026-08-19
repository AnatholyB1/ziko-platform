---
phase: 4
slug: mobile-consumption-attribution
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-17
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no `jest.config.*`, no `*.test.tsx`/`*.test.ts` files, no `"test"` script in `apps/mobile/package.json` or root `package.json` |
| **Config file** | none — see Wave 0 |
| **Quick run command** | n/a — no automated test runner configured for `apps/mobile` |
| **Full suite command** | n/a |
| **Estimated runtime** | n/a |

`scripts/exercise-import/` (the Phase 2/3 import pipeline) does have `merge-row.test.ts`, confirming Vitest or similar is available *somewhere* in the monorepo tooling, but it is not wired to `apps/mobile`. Installing/configuring a mobile test framework is out of scope for this phase (visual/UI-heavy React Native screen work with no business-logic branching complex enough to justify introducing a new test harness as a phase side-quest).

---

## Sampling Rate

- **After every task commit:** Manual visual check against `04-UI-SPEC.md` component specs
- **After every plan wave:** Manual walk of exercise detail + picker screens with a mix of exercises (has-media, missing-media, `fr` locale, `en` locale)
- **Before `/gsd:verify-work`:** Manual verification checklist (no automated suite to gate on)
- **Max feedback latency:** n/a (manual-only phase)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | MOBILE-01 | — | Hero shows real GIF, no fake chrome | manual | — | ❌ no RN test infra | ⬜ pending |
| TBD | TBD | TBD | MOBILE-02 | — | Picker rows show thumbnails | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | MOBILE-03 | — | Attribution badge renders once on detail hero, never on picker rows | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | MOBILE-04 | — | `instruction_steps` renders as numbered list, no JSON.parse | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | MOBILE-05 | — | Name/instructions follow locale | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | MOBILE-06 | — | Query keys versioned, no mixed-media flash after update | manual | — | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs filled in by the planner once PLAN.md files exist.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no test framework installation is required. Introducing a full RN test harness (`jest-expo` or similar) is a larger cross-cutting decision outside this phase's scope. If a future phase adds one, the `instruction_steps[locale] ?? .en ?? []` selection logic would be a good first unit-test candidate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero media renders real GIF, autoplays/loops, no fake video chrome | MOBILE-01 | No RN test infra in `apps/mobile`; visual-only behavior | Open exercise detail screen on device/simulator for an exercise with media; confirm square GIF autoplays, no play icon/HD badge/duration text |
| ExercisePicker rows show thumbnails | MOBILE-02 | Visual-only, list rendering | Open ExercisePicker; confirm each row shows a 40×40 rounded-square thumbnail left of the checkbox |
| Attribution badge shown once per screen, corner-anchored, absent from list thumbnails | MOBILE-03 | Visual placement + the deliberate D-06 scope interpretation (once-per-screen, not every instance) | Open exercise detail screen — confirm badge appears once on hero; open ExercisePicker — confirm no badge on any row thumbnail |
| Numbered instructions sourced from `instruction_steps`, no fallback parsing | MOBILE-04 | Content correctness across bilingual data, no isolated unit worth testing without a harness | Open detail screen for exercises with and without `instruction_steps`; confirm numbered list renders correctly, no JSON parse errors in console |
| Name/instructions follow device locale (fr/en) | MOBILE-05 | Locale-dependent rendering | Toggle `useI18nStore` locale fr↔en; confirm name and instructions switch correctly, matching `tExercise` pattern |
| Missing-media exercises show icon placeholder, not broken image | Fallback (D-07/D-08) | Visual-only | Open detail screen + picker row for one of the 6 unmatched-new exercises; confirm `barbell-outline` icon placeholder renders in both places |
| Query cache invalidated after update (no mixed old/new media) | MOBILE-06 | Requires simulating an already-installed client with stale cache; not automatable without a persister to reset | Confirm `['exercise', id]`/`['exercises-picker']` keys are versioned in source (e.g. `['exercises', 'v2', ...]`); manual confirmation that no code path still references the old unversioned key |

---

## Validation Sign-Off

- [x] All tasks have manual verification instructions mapped (no automated command exists — none required, per Wave 0 gap note)
- [x] Sampling continuity: n/a — manual-only phase, no automated task chain to sample
- [x] Wave 0 covers all MISSING references — none required, justified above
- [x] No watch-mode flags — n/a, no test runner
- [x] Feedback latency — n/a, manual-only
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-17 — manual-only validation architecture is the honest state for this monorepo's current `apps/mobile` test coverage (zero existing `*.test.tsx` files), consistent with how the rest of the app is validated today.
