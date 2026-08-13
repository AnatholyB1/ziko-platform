# Milestones

## v1.0 Onboarding Import IA (Shipped: 2026-08-13)

**Phases completed:** 4 phases, 10 plans, 13 tasks

**Key accomplishments:**

- One-liner:
- One-liner:
- Phase 3 visual layer complete — classification bubbles, ambiguity pills, coach reply, docType badges, and canAdvance-gated Continue CTA rendered in WizardStep4Import with 10 new i18n keys.
- Materialized the undeclared-but-uninstalled `@testing-library/dom` peer dependency via root `npm install` (fixing a real RTL module-resolution crash), and added nine locked-copy Onboarding i18n keys (fr+en, including two ICU plural strings) needed by the upcoming review/commit screens.
- Built the fetch-mocking RTL test harness the codebase previously lacked and wrote 6 named RED tests (REVIEW-01/02/03, COMPLETE-01/02, D-09) that drive `WizardStep4Import` through the full 6-call import pipeline up to the not-yet-built review screen — every test fails on a clean, review-screen-naming assertion, setting the GREEN target for plan 04-04.
- Added the Phase 4 state machine and commit logic to `WizardStep4Import.tsx` (parsed_data persistence, review view state, parallel commit with per-doc retry, and the reactive 1500ms auto-redirect effect) with zero JSX changes — a pure logic layer mirroring Phase 3's own 03-01/03-02 split.
- Rendered the three-state (editing/committing/done) review screen inside `WizardStep4Import.tsx`, wired it to plan 04-03's handlers, and fixed a same-effect timer-cancellation bug in the completion effect that was silently swallowing the 1500ms auto-redirect — turning all 6 RED tests from plan 04-02 GREEN and closing all five Phase 4 requirements.

---
