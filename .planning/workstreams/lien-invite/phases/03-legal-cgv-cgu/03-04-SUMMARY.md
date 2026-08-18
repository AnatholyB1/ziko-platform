---
phase: 03-legal-cgv-cgu
plan: 04
subsystem: legal-content
tags: [legal, cgv, cgu, counsel-approval, gdpr, i18n]

requires:
  - phase: 03-legal-cgv-cgu (plans 01-03)
    provides: bilingual CGV route, CGU AI-credit-cap consistency, retention/erasure mechanism, counsel-briefing package
provides:
  - "03-COUNSEL-APPROVAL.md — written record of real outside counsel's approval, per-question resolutions, git SHA of the approved text, LEGAL-05 statement"
  - "SHUTDOWN_MODIFICATION_CLAUSE with the [TBD] notice-period placeholder resolved to 90 days/90 jours in both locales"
  - "CGV and CGU pages with the draft-pending-review banner removed"
affects: [phase-4-credit-gate-alignment, phase-6-founder-offer-go-live]

actuals:
  tokens: 4547
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Approval record ties a completion state (LEGAL-05) to a specific commit SHA, not to a memory of what was reviewed"
    - "Banner removal and its guarding test assertion removed in the same commit, so the marking can never silently drop while its guard is still red"

key-files:
  created:
    - .planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-COUNSEL-APPROVAL.md
  modified:
    - apps/web/src/content/legal/founder-offer.ts
    - apps/web/src/app/[locale]/(marketing)/cgv/page.tsx
    - apps/web/src/app/[locale]/(marketing)/cgu/page.tsx
    - apps/web/test/legal/cgv-content.test.ts
    - apps/web/test/legal/cgv-cgu-consistency.test.ts
    - .planning/workstreams/lien-invite/REQUIREMENTS.md

key-decisions:
  - "Task 2's checkpoint resolved to approved-as-drafted, decided by the real user/founder outside this session, not by Claude — recorded verbatim in 03-COUNSEL-APPROVAL.md rather than re-litigated"
  - "Approving lawyer's name withheld at their own explicit request — recorded as 'name withheld at the approver's request' rather than fabricated or left unexplained"
  - "The plan text named cgv-content.test.ts as also carrying a banner assertion to remove; on inspection only cgv-cgu-consistency.test.ts actually contained one (D-04's [TBD]-integrity assertion in cgv-content.test.ts was a separate, unrelated check re-derived instead — see Deviations)"

patterns-established:
  - "Legal-copy approval gate: a checkpoint:decision task records the user's real answer, a docs commit writes the durable approval record naming the commit SHA of the approved text, then a single coupled commit removes both the draft marking and its guarding test"

requirements-completed: [LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05]

coverage:
  - id: D1
    description: "SHUTDOWN_MODIFICATION_CLAUSE's [TBD] notice-period placeholder resolved to counsel-approved 90 days / 90 jours in both locales"
    requirement: LEGAL-03
    verification:
      - kind: unit
        ref: "apps/web/test/legal/cgv-content.test.ts#D-04 — notice-period placeholder resolved to counsel-approved figure"
        status: pass
    human_judgment: false
  - id: D2
    description: "03-COUNSEL-APPROVAL.md records approving counsel, approval date, selected option, all seven per-question resolutions, the approved-text git SHA, and the LEGAL-05 statement"
    requirement: LEGAL-05
    verification: []
    human_judgment: true
    rationale: "Legal-approval validity cannot be verified by an automated test — it is a process record whose correctness depends on the real checkpoint answer given by the user, which this plan transcribes rather than re-derives."
  - id: D3
    description: "Draft-pending-review banner removed from /cgv and /cgu, coupled in one commit with removal of the test assertion that guarded its presence"
    requirement: LEGAL-01
    verification:
      - kind: unit
        ref: "apps/web/test/legal/cgv-cgu-consistency.test.ts (banner assertion removed; remaining 6 tests pass)"
        status: pass
      - kind: other
        ref: "grep -r DRAFT_REVIEW_BANNER apps/web/src apps/web/test — no match"
        status: pass
    human_judgment: false
  - id: D4
    description: "LEGAL-01 through LEGAL-05 marked Complete in REQUIREMENTS.md's Traceability table"
    requirement: LEGAL-05
    verification:
      - kind: other
        ref: ".planning/workstreams/lien-invite/REQUIREMENTS.md Traceability table"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-15
status: complete
---

# Phase 3 Plan 04: Counsel-approval gate cleared, notice period resolved, draft banner removed Summary

**Real outside counsel approved the CGV/CGU as drafted, supplying the 90-day shutdown-notice
figure; the draft-pending-review banner and its guarding test assertion came down together in one
commit, and Phase 3's five CGV/CGU-owning requirements (LEGAL-01 through 05) are now Complete.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-15
- **Tasks:** 2 (Task 1 — the pre-review walkthrough — was already complete before this session)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- Task 2's blocking `checkpoint:decision` gate (D-01) resolved to `approved-as-drafted` by the
  real user, with the Q6 notice-period figure (90 days) supplied — recorded, not re-derived.
- `SHUTDOWN_MODIFICATION_CLAUSE`'s `[TBD — nombre de jours à confirmer par le conseil]` /
  `[TBD — day count to be confirmed by counsel]` placeholder replaced with `90 jours` / `90 days`
  in both locales — no other clause wording changed.
- `03-COUNSEL-APPROVAL.md` written: approving counsel identity (name withheld at their own
  request), approval date, selected option, per-question resolutions for all seven
  03-COUNSEL-BRIEFING.md questions, the git SHA of the approved-text commit, and an explicit
  LEGAL-05 statement restating the ordering constraint binding Phase 4 and Phase 6.
- Draft-pending-review banner removed from both `/cgv` and `/cgu`, together with the one test
  assertion (`cgv-cgu-consistency.test.ts`) that guarded its presence, in a single commit — the
  coupling T-03-19 requires so the banner could never be silently dropped while review was open.
- `DRAFT_REVIEW_BANNER` export and `IoWarningOutline` imports removed as now-unused; `CGU`'s
  trailing last-updated line bumped to the approval month (août 2026); `CGV_LAST_UPDATED` already
  read August 2026 and needed no change.
- LEGAL-01 through LEGAL-05 marked Complete in `REQUIREMENTS.md`'s Traceability table (LEGAL-06
  through LEGAL-09 were already Complete from plans 02/03) — Phase 3 is now 5/5 legal requirements
  Complete, 4/4 plans executed.

## Task Commits

Task 1 (the pre-review walkthrough checkpoint) completed in a prior session; its one fix commit
is `848ecc8` (fix: decode literal HTML entities in CGU section-6 heading), already on `main`
before this session started.

1. **Task 2 — checkpoint resolved (no code change of its own; recorded via Task 3's artifact)**
   — decision transcribed verbatim into `03-COUNSEL-APPROVAL.md` (commit `7d16471`).
2. **Task 3a: resolve the notice-period placeholder** — `04a2490` (fix)
3. **Task 3b: record the counsel approval** — `7d16471` (docs)
4. **Task 3c: remove the draft banner, coupled with its guarding assertion** — `30f1bb3` (feat)

**Plan metadata:** (this commit, following this Summary)

## Files Created/Modified

- `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-COUNSEL-APPROVAL.md` — the written
  LEGAL-05 approval record
- `apps/web/src/content/legal/founder-offer.ts` — `[TBD]` resolved to 90 days/jours;
  `DRAFT_REVIEW_BANNER` export removed
- `apps/web/src/app/[locale]/(marketing)/cgv/page.tsx` — banner block, `IoWarningOutline` import,
  and `DRAFT_REVIEW_BANNER` import removed
- `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` — same removal, plus last-updated line
  bumped to août 2026
- `apps/web/test/legal/cgv-content.test.ts` — D-04 assertion re-derived to check the resolved
  90-day figure and the absence of `[TBD`, instead of asserting the placeholder's presence
- `apps/web/test/legal/cgv-cgu-consistency.test.ts` — banner-presence assertion removed
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — LEGAL-01 through LEGAL-05 marked Complete
  in both the requirement checklist and the Traceability table

## Decisions Made

- **Task 2's resolution is a transcription, not a Claude decision.** The real user/founder
  answered the blocking gate outside this execution session (`approved-as-drafted`, individual
  outside solo-practitioner lawyer, name withheld at their own request, approval date 2026-08-15,
  Q6 = 90 days chosen from a 30/60/90-day menu). This plan records that answer; it does not
  evaluate or second-guess it.
- **The withheld lawyer name is recorded, not omitted.** `03-COUNSEL-APPROVAL.md` states plainly
  that the name was withheld at the approver's own request — satisfying the "no fabricated name,
  no silent gap" requirement from this plan's own instructions.
- **Only one test file actually needed banner-assertion removal.** The plan's action prose named
  both `cgv-content.test.ts` and `cgv-cgu-consistency.test.ts` as carrying banner assertions to
  remove; on inspection, `cgv-content.test.ts` never asserted the banner's presence — only
  `cgv-cgu-consistency.test.ts` did (`toContain('DRAFT_REVIEW_BANNER')` /
  `toContain('border-warning')`). That one assertion was removed. `cgv-content.test.ts`'s D-04
  test, which asserted the `[TBD]` placeholder's *presence*, was a separate, correctly-identified
  assertion that needed re-deriving (not removing) once the placeholder resolved to a real figure
  — handled as part of the Task 3a revision commit, ahead of and separate from the banner-removal
  commit, matching the plan's own "re-run vitest, re-derive any now-failing LEGAL assertion before
  continuing" instruction.

## Deviations from Plan

**1. [Clarification, not a Rule 1-3 auto-fix] Banner-assertion location was narrower than the
plan's action prose implied**
- **Found during:** Task 3, step three (banner removal)
- **Issue:** The plan's action text says to "remove the banner assertions from
  `cgv-content.test.ts` and `cgv-cgu-consistency.test.ts`." Reading both files showed
  `cgv-content.test.ts` contains no banner assertion — its only relevant check is the D-04
  `[TBD]`-placeholder test, a distinct concern already handled by re-deriving it (not removing it)
  in the earlier revision commit.
- **Resolution:** Removed the one actual banner assertion, in `cgv-cgu-consistency.test.ts`.
  Left `cgv-content.test.ts` alone in the banner-removal commit since it had nothing banner-related
  to remove.
- **Files modified:** `apps/web/test/legal/cgv-cgu-consistency.test.ts`
- **Verification:** `cd apps/web && npx vitest run test/legal` — 6 files, 52 tests, all green
  after the change; `grep -r "DRAFT_REVIEW_BANNER" apps/web/src apps/web/test` returns no match.
- **Committed in:** `30f1bb3`

No other deviations — the plan's two remaining tasks (2 and 3) executed as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 3 is complete: 4/4 plans, 5/5 CGV/CGU-owning legal requirements (LEGAL-01–05) Complete**
  (LEGAL-06–09 were already Complete from plans 02/03). All nine Phase 3 requirements are now
  Complete.
- **Phase 4 (Credit-Gate Alignment) is unblocked per LEGAL-05.** `ROADMAP.md`'s Phase 4 entry
  already names Phase 3 in its "Depends on" line — confirmed by reading it during this plan, no
  edit needed. This plan does not start Phase 4 work.
- **Phase 6's activation checklist criterion 2** ("flag flips only after the CGU/CGV text is
  live") now has its precondition text approved and ready to ship; the checklist itself still
  verifies liveness in production at Phase 6, which this plan does not perform.
- `cd apps/web && npx vitest run test/legal` — 6 files, 52 tests, all green.
- `cd apps/web && npm run test` — 17 files passed, 1 skipped (DB-gated, unaffected), 218 tests
  passed, 4 skipped — no regression in `test/purge`, `test/actions`, or `safe-next`.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — zero errors outside the pre-existing,
  already-documented `test/purge/*.test.ts` type errors (unrelated `.mjs`-module-type-inference
  issue, out of scope per plans 01-03's documented boundary).

## Self-Check: PASSED

All 8 created/modified files verified present on disk:
- `03-COUNSEL-APPROVAL.md` (FOUND)
- `03-04-SUMMARY.md` (FOUND)
- `apps/web/src/content/legal/founder-offer.ts` (FOUND)
- `apps/web/src/app/[locale]/(marketing)/cgv/page.tsx` (FOUND)
- `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` (FOUND)
- `apps/web/test/legal/cgv-content.test.ts` (FOUND)
- `apps/web/test/legal/cgv-cgu-consistency.test.ts` (FOUND)
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` (FOUND)

All 3 task commits verified in `git log`: `04a2490`, `7d16471`, `30f1bb3`.

---
*Phase: 03-legal-cgv-cgu*
*Completed: 2026-08-15*
