---
phase: 25-invitations-mobile-mon-coach-minimal
plan: 09
subsystem: ui
tags: [tailwind, next-intl, coach-invitations, redeem, pixel-perfect]

# Dependency graph
requires:
  - phase: 25-invitations-mobile-mon-coach-minimal
    provides: Phase 25 coach/invitations and /redeem web surfaces built in plans 25-01 through 25-08

provides:
  - All 9 Phase 25 coach components pixel-perfect against UI-SPEC.md canonical class strings
  - RevokeConfirmModal confirm input corrected (py-3/text-sm/font-normal vs old h-12/text-base)
  - InvitationsTable status chips corrected (font-semibold vs old font-bold)
  - InvitationsTable empty state heading corrected (text-base font-semibold vs old text-xl font-bold)
  - InvitationCodeCard label "Code d'invitation" via new cardLabel i18n key (vs old table.code "Code")

affects: [phase-26, phase-27, phase-28]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI-SPEC.md canonical class strings are the authoritative source — any divergence is a bug"
    - "i18n keys shared across table and card (table.code) should be distinct when display context differs"

key-files:
  created: []
  modified:
    - apps/web/src/components/coach/InvitationCodeCard.tsx
    - apps/web/src/components/coach/InvitationsTable.tsx
    - apps/web/src/components/coach/RevokeConfirmModal.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json

key-decisions:
  - "Added distinct cardLabel i18n key to CoachInvitations namespace so InvitationCodeCard shows 'Code d'invitation' rather than the table column header 'Code'"
  - "RevokeConfirmModal confirm input: removed h-12/bg-white/text-base, replaced with py-3/text-sm/font-normal matching UI-SPEC modal pattern exactly"
  - "Pre-existing TypeScript error in test/safe-next.spec.ts (safeNext export) is out of scope — deferred to deferred-items"

patterns-established:
  - "Pattern: card label keys should not reuse table column header keys even if the displayed text is similar"

requirements-completed: [INVITE-01, INVITE-02, INVITE-03, INVITE-05, INVITE-06]

# Metrics
duration: 12min
completed: 2026-05-17
---

# Phase 25 Plan 09: UI Pixel-Perfect Audit Summary

**Systematic class-string audit of all 9 Phase 25 coach/athlete components against UI-SPEC.md; 4 deviations found and fixed — RevokeConfirmModal input, InvitationsTable chips, empty state, and InvitationCodeCard label.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-17T20:16:00Z
- **Completed:** 2026-05-17T20:28:46Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Audited all 9 Phase 25 components (InvitationCodeCard, GeneratePanel, InvitationsTable, ExpirationChipGroup, FilterChipGroup, InvitationsClient, CoachPreviewCard, CodeInput, RedeemStateMachine) against UI-SPEC.md — 5 already matched exactly
- Fixed 4 class-string deviations across 3 components + 2 i18n files
- RevokeConfirmModal focus trap (dialogRef + keydown handler) verified preserved
- All fr.json CoachRedeem i18n keys verified: stateA.heading/body/submit and stateB.back are correct

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit and fix coach-side components** - `968907a` (fix)
2. **Task 2: Audit and fix athlete-side components** - `381cbc6` (fix)

## Files Created/Modified

- `apps/web/src/components/coach/InvitationCodeCard.tsx` - Label now uses `t('cardLabel')` = "Code d'invitation" instead of `t('table.code')` = "Code"
- `apps/web/src/components/coach/InvitationsTable.tsx` - Status chip `font-bold` → `font-semibold`; empty state heading `text-xl font-bold` → `text-base font-semibold`
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` - Confirm input: `h-12 bg-white text-base` → `py-3 text-sm font-normal` per UI-SPEC modal pattern
- `apps/web/messages/fr.json` - Added `CoachInvitations.cardLabel: "Code d'invitation"`
- `apps/web/messages/en.json` - Added `CoachInvitations.cardLabel: "Invitation code"`

## Decisions Made

- Added distinct `cardLabel` i18n key rather than reusing `table.code` — the card label and the table column header happen to show similar text but serve different UI contexts; sharing the key is a maintenance risk.
- Pre-existing TypeScript error in `test/safe-next.spec.ts` (L19: `safeNext` property missing) is out of scope for this plan — deferred.

## Deviations from Plan

### Auto-fixed Issues

None. All fixes were within the plan's stated scope — this plan is itself the audit-and-fix plan.

---

**Total deviations:** 0 unplanned
**Impact on plan:** Plan executed exactly as specified.

## Issues Encountered

- Pre-existing TypeScript error in `test/safe-next.spec.ts` (safeNext export reference). Unrelated to plan files — zero errors in all modified components.

## Known Stubs

None. All components render real data from their props/server actions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All Phase 25 web surfaces now match UI-SPEC.md canonical class strings exactly
- Visual audit baseline is clean; any future regressions are detectable via grep battery
- Phase 26 (coach clients/programs) can build on these established component patterns

---
*Phase: 25-invitations-mobile-mon-coach-minimal*
*Completed: 2026-05-17*
