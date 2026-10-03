---
phase: 03-auth-merge
plan: 13
subsystem: mobile-app
tags: [relogin-notice, showAlert, i18n, D-12]
requires: []
provides:
  - mobile getReloginNoticeState / reloginAckKey helper
  - one-time re-login alert in the authenticated app layout
affects: [phase-06-cutover]
key-files:
  created:
    - apps/mobile/src/lib/reloginNotice.ts
  modified:
    - apps/mobile/app/(app)/_layout.tsx
    - packages/plugin-sdk/src/i18n.ts
    - apps/mobile/.env.example
key-decisions:
  - "Same 21d lead / 7d tail window and strict UTC YYYY-MM-DD parse as the web helper"
  - "OK button uses existing general.confirm key (no general.ok exists)"
requirements-completed: []
requirements-partial: [AUTHMIG-05]
completed: 2026-10-01
---

# Phase 3 Plan 13: Mobile Re-login Notice Summary

Inert-until-configured one-time showAlert on mobile, driven by `EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE`, shown once per cutover date (ack stored via `appStorage`).

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Mobile date-window helper + ack key | fc9b707a | `NOTICE_LEAD_DAYS = 21`, `NOTICE_TAIL_DAYS = 7`, `relogin_notice_ack_<date>` |
| 2 Alert in layout, FR/EN keys, env example | 63f977f0 | showAlert, `{date}` interpolation, no link/input |

## Verification

- `tsc --noEmit` in apps/mobile: clean after both tasks.
- `reloginNotice` keys present in fr and en dictionaries; no `Alert.alert` in layout; env example has the variable.

## Coverage caveat

The alert only reaches users on a binary built after Phase 6 sets the variable (no forced OTA, per REQUIREMENTS Out of Scope). Partial mobile coverage is expected.

## UI-SPEC waiver

`config.json` enables the UI phase/safety gate and no `03-UI-SPEC.md` exists. Waived: the only visual is a single alert rendered by the existing `showAlert`/`CustomAlert` system; no new screen, component or style. Covers only this alert (and the Plan 04 web banner).

## AUTHMIG-05 status

PARTIAL, not completed. Inert surface only; setting the date and sending the email are Phase 6 tasks. Not marked complete in REQUIREMENTS.md.

## Deviations from Plan

None. Minor: `general.ok` does not exist, so `general.confirm` is used for the button.

## Threat Flags

None. T-3-50 mitigated by strict parse; T-3-51 by an alert with no link or credential input.

## Self-Check: PASSED
