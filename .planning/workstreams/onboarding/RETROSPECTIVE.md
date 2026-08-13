# Retrospective — Coach Onboarding Import IA

## Milestone: v1.0 — Import IA

**Shipped:** 2026-08-13
**Phases:** 4 | **Plans:** 10 | **Timeline:** 2026-05-30 → 2026-08-12 (calendar span; Phase 4 picked up after a multi-week gap)

### What Was Built

1. WizardStep4Import wired as a 4th wizard step — KYC (Step 3) success redirects to `?step=4`; skip button routes to dashboard
2. Drop-zone UI + Phase 28 pipeline orchestration (create → upload → status → parse) triggered automatically per file, 4-file cap, live status pills
3. AI classification chat layer — doc-type bubbles, ambiguity clarification pills, docType badges, canAdvance-gated Continue CTA
4. Consolidated review/commit screen (editing/committing/done states), per-doc retry, parallel commit of `coach_template` docs via `PUT /coach/imports/:id/commit`

### What Worked

- **RED→GREEN test discipline in Phase 4:** plan 04-02 wrote 6 named RED tests against the not-yet-built review screen before any rendering code existed; 04-04 turned all 6 GREEN and caught a real bug (timer-cancellation) in the process.
- **Logic/rendering split (03-01/03-02 and 04-03/04-04):** each phase's final two plans separated pure state/logic changes from JSX rendering — kept diffs reviewable and let the logic land with zero JSX churn.
- **Phase 28 backend reused as-is:** no backend changes needed in v1.0; the existing create→upload→status→parse→commit contract absorbed the new UI cleanly.

### What Was Inefficient

- **REQUIREMENTS.md traceability table went stale:** WIZARD-01/02/03 (Phase 1) and PARSE-01/02/03 (Phase 3) stayed marked "Pending" even after both phases were fully verified and summarized — required a manual reconciliation pass at milestone close instead of being caught during execution. Same failure mode recorded in the `da-coach` workstream's v1.12 retrospective — this is now a confirmed cross-milestone pattern, not a one-off.
- **Verification gaps deferred, not resolved:** Phases 1 and 2 both scored 100% on automated verification but were flagged `human_needed` for browser-interactive behaviors (redirects, drag-over states, live polling) — nobody clicked through them before close. Deferred and acknowledged in STATE.md rather than blocking, but the gap sat unaddressed for ~2.5 months between Phase 2 and Phase 4.
- **~6-week gap between Phase 3 (2026-05-31) and Phase 4 start:** timeline stat is misleading as a velocity signal — actual active work was concentrated in two short bursts.

### Patterns Established

- **Confidence-banded auto-classification:** `>= 0.6` = template_programme (auto), `< 0.4` or null = da_coach (auto), `0.4–0.6` = ambiguous → clarification pills. Reusable threshold pattern for any future AI-classification UI.
- **Reactive completion effect must own its own timer:** a single `useEffect` that both sets `reviewPhase(done)` and schedules a redirect timer will cancel its own timer on the next dependency-triggered re-run. Split into two effects — this is now the documented fix for that shape of bug (see PROJECT.md Key Decisions).
- **`sessions count` null-sentinel:** use `null` (not `0`) when a count is unavailable, to enable a distinct fallback i18n string rather than rendering "0".

### Key Lessons

1. Update the REQUIREMENTS.md traceability table as part of each phase's SUMMARY step, not only at milestone close — this is the second workstream in this project to hit the exact same stale-checklist gap at archive time.
2. When a verification report is scored `human_needed`, schedule the manual click-through before the next phase starts, not at milestone close — the gap otherwise sits open for the full remaining timeline.
3. Logic/rendering plan splits (state changes in one plan, JSX in the next) paid off twice in this milestone (Phase 3, Phase 4) — worth defaulting to for any phase with a non-trivial state machine.

### Cost Observations

- Sessions: multiple, with a ~6-week gap between Phase 3 and Phase 4
- Notable: Phase 4 alone (04-01 through 04-04) accounted for 4 of the milestone's 10 plans and closed a real bug via its RED→GREEN test harness

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.12 (da-coach) | ~4 | 3 | Traceability table left stale through execution — flagged as lesson |
| v1.0 (onboarding) | multiple, gapped | 4 | Same stale-traceability gap recurred — now confirmed cross-milestone, needs a process fix (SUMMARY-step reconciliation) rather than a one-off note |

### Top Lessons (Verified Across Milestones)

1. **REQUIREMENTS.md traceability checkboxes are not updated automatically by phase execution** — confirmed independently in `da-coach` v1.12 and `onboarding` v1.0. Treat this as a systemic gap: either enforce the traceability update as a SUMMARY.md step, or stop relying on the table's checkbox state as a completeness signal at milestone close.
