---
phase: 03-auth-merge
plan: 04
subsystem: web-coach-crm
tags: [relogin-notice, next-intl, vitest, D-12]
requires: []
provides:
  - getReloginNoticeState date-window helper (reused by Plan 13 on mobile)
  - ReloginNoticeBanner mounted in coach CRM layout
affects: [phase-06-cutover]
tech-stack:
  added: []
  patterns: [pure date helper + server component reading NEXT_PUBLIC env]
key-files:
  created:
    - apps/web/src/lib/reloginNotice.ts
    - apps/web/src/lib/reloginNotice.test.ts
    - apps/web/src/components/coach/ReloginNoticeBanner.tsx
  modified:
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
    - apps/web/.env.example
key-decisions:
  - "Cutover parsed strictly as UTC YYYY-MM-DD; overflowed dates (2026-02-31) also treated as not configured"
  - "Banner has no link, button or dismiss control (T-3-16)"
requirements-completed: []
requirements-partial: [AUTHMIG-05]
duration: ~10 min
completed: 2026-10-01
---

# Phase 3 Plan 04: Web Re-login Notice Banner Summary

Inert-until-configured re-login notice banner on the Ziko coach CRM, driven by `NEXT_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE`, visible from 21 days before to 7 days after the cutover date.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 RED: failing date-window test | c1ead8f8 | 7 tests |
| 1 GREEN: `getReloginNoticeState` | 035062b1 | exports `NOTICE_LEAD_DAYS = 21`, `NOTICE_TAIL_DAYS = 7` |
| 2 Banner, layout mount, FR/EN messages, env example | 6db462d9 | mounted first child of `<main>` |

## Verification

- `vitest run src/lib/reloginNotice.test.ts`: 7/7 pass.
- Messages check (`reloginNotice.before/after` in fr and en): ok.
- Banner contains no `dark:` and no `href=`.
- `tsc --noEmit` in apps/web: no errors in files touched by this plan. Pre-existing errors exist only in `test/purge/*.test.ts` (logged in `deferred-items.md`).

## UI-SPEC waiver

`config.json` enables the UI phase/safety gate and no `03-UI-SPEC.md` exists. Waived: this is a text-only notice strip reusing existing Tailwind semantic tokens (`bg-primary/10`, `border-border`, `text-primary`) and an existing `react-icons/io5` icon, introducing no new screen, layout, navigation or component pattern. The waiver covers only this banner (and the Plan 13 mobile alert); anything beyond a single notice strip requires a UI-SPEC first.

## AUTHMIG-05 status

PARTIAL, not completed. This plan delivers an inert web surface only. Setting the cutover date and the email send are Phase 6 tasks. Not marked complete in REQUIREMENTS.md.

## Deviations from Plan

None functionally. Minor: the banner uses `en-GB`/`fr-FR` Intl locales for date formatting, and also gets `flex-shrink-0` so the strip does not collapse inside the flex column.

## Threat Flags

None. T-3-15 mitigated by strict parse (tested); T-3-16 mitigated by no link/input.

## Self-Check: PASSED

All created files exist; commits c1ead8f8, 035062b1, 6db462d9 present.
