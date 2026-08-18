---
phase: 25
plan: 07b
subsystem: web/coach
tags: [refonte, phase-24-design-parity, dashboard, settings, next-intl]
requires:
  - 25-01 (Wave 1 foundations)
  - 25-07a (ProfileForm refactor — consumed but not modified)
provides:
  - coach dashboard surface aligned to UI-SPEC / Ziko-Onboarding mockup
  - coach settings surface aligned to UI-SPEC / Ziko-Onboarding mockup
  - ProfileForm dual-context reuse verified (Wizard Step 2 + /coach/settings)
affects:
  - apps/web/src/components/coach/WelcomeCard.tsx
  - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
  - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
  - apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx
  - apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx
  - apps/web/messages/{fr,en}.json
tech-stack:
  added: []
  patterns:
    - useTranslations wiring on WelcomeCard ('Dashboard') and SettingsClient ('Settings')
    - getTranslations server-side on settings/page.tsx
    - Primary CTA token rounded-xl (UI-SPEC §Buttons line 149)
    - Card padding p-8 (consistent with Phase 25 Step2 card pattern)
    - Layout-owned max-width: max-w-3xl in (coach)/coach/layout.tsx (UI-SPEC §Page Layouts line 188)
key-files:
  created: []
  modified:
    - apps/web/src/components/coach/WelcomeCard.tsx
    - apps/web/src/app/[locale]/(coach)/coach/layout.tsx
    - apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx
    - apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
decisions:
  - Mockup remains base64-bundled (468 KB, not pixel-parseable from executor) — aligned to UI-SPEC tokens (same approach as Plan 07a)
  - Max-width moved from per-page wrappers to layout (single owner: max-w-3xl per UI-SPEC §Page Layouts)
  - All Phase 24 hardcoded French literals on dashboard + settings now flow through next-intl namespaces
  - ProfileForm.tsx NOT modified — dual-context render verified via static analysis (props signature compatible, useTranslations('Onboarding') namespace shared)
metrics:
  duration: 24 min
  tasks_completed: 2
  files_modified: 7
  commits: 2
  completed_date: 2026-05-17
---

# Phase 25 Plan 07b: Refonte Phase 24 (2/2) — coach dashboard + settings Summary

Refactored the remaining two already-shipped Phase 24 web surfaces — `/coach/dashboard` and `/coach/settings` — plus the shared `(coach)/coach/layout.tsx` shell. All hardcoded French strings now flow through next-intl. Card patterns, primary-button rounding, and main-content max-width aligned to UI-SPEC tokens (Phase 25 design contract). All Server Action wiring, Phase 23 D-11/D-12 invariants, and ProfileForm dual-context reuse preserved.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refonte coach dashboard (WelcomeCard + layout + dashboard/page) | bf8b0ca | WelcomeCard.tsx, (coach)/coach/layout.tsx, dashboard/page.tsx |
| 2 | Refonte coach settings + i18n wiring + ProfileForm dual-context | 58f1689 | settings/page.tsx, SettingsClient.tsx, fr.json, en.json |

## Refonte Visual Diff

Per Plan 07a precedent, the canonical mockup (`.planning/mockups/Ziko-Onboarding.html`) is a Claude Design base64-bundled HTML export (468 KB). The raw HTML cannot be parsed for pixel-level visual specs from the executor environment (visual content lives inside JS-decoded blob URLs at runtime). Diff was therefore performed against:

- Phase 25 UI-SPEC tokens (25-UI-SPEC.md §Page Layouts line 188 `max-w-3xl`, §Buttons line 149 `rounded-xl`, §Card line 106 `bg-white rounded-2xl p-6 border border-border shadow-sm`)
- Plan 07a baseline (rounded-xl primary buttons, p-8 card padding on WizardStep cards, gap-5 form vertical rhythm)

| Surface | Result | Notes |
|---------|--------|-------|
| /fr/coach/dashboard (with sidebar visible — sidebar styling owned by Plan 04) | FLAG (deferred to human visual gate) | Token-aligned refactor applied: layout owns `max-w-3xl px-8 py-10`; WelcomeCard `p-8`, h1 `text-2xl font-bold`, all 3 strings i18n-wired through `Dashboard` namespace. Manual visual diff required at Plan 06 validation gate. |
| /fr/coach/settings | FLAG (deferred to human visual gate) | Token-aligned refactor applied: section cards `p-8`, primary buttons `rounded-xl`, all hardcoded FR strings i18n-wired through `Settings` namespace (incl. 2 new keys: `saving`, `loading`). |

Remediation for FLAG items: Plan 06 (Wave 4 validation) or follow-up visual-only refonte ticket must perform side-by-side comparison in a browser (mockup requires JS to render). The refactor IS aligned with the UI-SPEC design tokens, which is the closest deterministic source available from the executor environment.

## Behavior Preservation

| Phase 24 Acceptance Flow | Status |
|--------------------------|--------|
| Dashboard renders WelcomeCard with correct profile data + KYC chip (Phase 24 flow #3) | PRESERVED — Server Component `auth.getUser()` + redirect, coach_profiles fetch, WelcomeCard props `{displayName, kycStatus}` signature all unchanged |
| Settings renders ProfileForm pre-filled + saves edits (Phase 24 flow #4) | PRESERVED — Server Component `auth.getUser()` + redirect, coach_profiles fetch, SettingsClient `{userId, initialProfile}` props unchanged; useActionState + `<form action={profileAction}>` + `<form action={kycAction}>` wiring intact |
| ProfileForm dual-context (refactored in Plan 07a Task 3) renders in /coach/settings (regression check) | PRESERVED — ProfileForm.tsx not modified by this plan; props signature `{initial, userId, apiUrl, jwt}` consumed identically by SettingsClient (line 46-57); `useTranslations('Onboarding')` namespace reused (all Onboarding.displayNameLabel/bioLabel/specialtiesLabel/websiteLabel keys exist in both fr.json + en.json since Phase 24). No layout breakage inherited from Plan 07a onboarding-context styling (ProfileForm renders a leaf flex column, identical in both contexts). |

## Lint / Type-check / Build

| Check | Result | Notes |
|-------|--------|-------|
| TypeScript (npx tsc --noEmit) | PASS — 0 new errors in scope files | 17 pre-existing failures in `src/lib/supabase/{server,client,middleware}.ts` + `__tests__/factories.spec.ts` (missing `@supabase/ssr` module declarations) — same set Plan 07a documented; NOT introduced by this plan |
| ESLint (`npm run lint`) | PASS — 0 new errors | 6 pre-existing warnings (coach-identity.ts unused params, CoachPreviewCard `<img>`, FileUploadRow/PhotoUpload `apiUrl` unused, ratelimit.ts unused param) — all in files NOT touched by this plan |
| Phase 23 D-11 invariant (no direct `@supabase/supabase-js`) | PASS | grep over all 5 refactored files returned no matches |
| Phase 23 D-12 invariant (no SERVICE_KEY in web) | PASS | no env additions; no SERVICE_KEY references introduced |
| Build (`npm run build`) | DEFERRED — pre-existing `supabase/ssr` type errors documented in Plan 07a block clean build independent of this plan |

## i18n Key Additions

| Key | FR | EN |
|-----|----|----|
| Settings.saving | Enregistrement… | Saving… |
| Settings.loading | Chargement… | Loading… |

Existing keys consumed (no rename): Dashboard.welcome / Dashboard.subtitle / Dashboard.inviteTeaser; Settings.title / Settings.profileSection / Settings.kycSection / Settings.saveCta. All keys exist in both fr.json and en.json (parity verified by side-by-side read).

## ProfileForm Dual-Context Regression Result

**PASS.** ProfileForm.tsx (refactored in Plan 07a Task 3) renders correctly in `/coach/settings` context:

- Props compatibility: SettingsClient (line 46-57) passes `{initial: {display_name, bio, specialties, website, photo_url}, userId, apiUrl, jwt}` — identical to ProfileForm's typed contract on `ProfileForm.tsx` line 21-26.
- i18n namespace reuse: ProfileForm.tsx uses `useTranslations('Onboarding')` for labels (displayNameLabel, bioLabel, specialtiesLabel, websiteLabel, displayNamePlaceholder, bioPlaceholder). All these keys exist in `Onboarding` namespace of both fr.json + en.json. No additional `Settings` namespace overrides needed.
- Form composition: SettingsClient wraps ProfileForm in `<form action={profileAction}>` with hidden inputs `photo_url` + `specialties` rendered inside ProfileForm. Form post body contract intact.
- No FLAG raised — no follow-up edit to Plan 07a Task 3 required.

## Deviations from Plan

### 1. [Rule 3 - Environment-Workaround] PreToolUse:Edit/Write READ-BEFORE-EDIT hook reminders

Found during: All 5 file modifications

Issue: Every Edit / Write tool call against an existing file triggered a `PreToolUse:READ-BEFORE-EDIT REMINDER` system-reminder, even though the file had been Read earlier in the same session. The Edit and Write tool calls themselves DID succeed on disk (verified via subsequent Read + git status) — the reminder appears to be a precautionary hook, not a hard failure. No fallback to `cat << EOF` heredoc was needed for this plan (Plan 07a Deviation 2 documented a stale-cache scenario that did NOT manifest here).

Decision: Continue using Edit/Write tools, re-read after each modification to confirm on-disk state, and proceed. All 5 files verified post-write by `Read` tool against actual disk content (line numbers + content matched intended writes exactly).

Files modified: All 5 plan-scope files

Commit: workaround pattern applied across both task commits

## Self-Check: PASSED

### Files modified verification

```
$ test -f apps/web/src/components/coach/WelcomeCard.tsx                                  && echo FOUND
$ test -f "apps/web/src/app/[locale]/(coach)/coach/layout.tsx"                            && echo FOUND
$ test -f "apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx"                   && echo FOUND
$ test -f "apps/web/src/app/[locale]/(coach)/coach/settings/page.tsx"                    && echo FOUND
$ test -f "apps/web/src/app/[locale]/(coach)/coach/settings/SettingsClient.tsx"          && echo FOUND
$ test -f apps/web/messages/fr.json                                                        && echo FOUND
$ test -f apps/web/messages/en.json                                                        && echo FOUND
```

All 7 modified files verified on disk.

### Commits verification

- FOUND bf8b0ca (Task 1 — coach dashboard surface refonte)
- FOUND 58f1689 (Task 2 — coach settings surface refonte + i18n wiring)

### Invariant checks

- PASS D-11: no direct `@supabase/supabase-js` imports in any of 5 refactored .tsx files (grep verified)
- PASS Server Action wiring: SettingsClient uses `useActionState` + `<form action={profileAction}>` + `<form action={kycAction}>` (unchanged)
- PASS ProfileForm not modified: file content identical to Plan 07a Task 3 baseline (grep `useTranslations.*Onboarding` confirms namespace intact)
- PASS TypeScript: 0 new errors in scope files; 17 pre-existing errors unchanged (all in src/lib/supabase/ — same set Plan 07a documented)
- PASS ESLint: 0 new errors; 6 pre-existing warnings unchanged (all in files NOT touched by this plan)
- PASS i18n parity: both fr.json and en.json have matching key sets (Settings.saving + Settings.loading added to both; verified by side-by-side offset read)
- PASS No CoachSidebar.tsx modification (owned by Plan 04) — git diff confirms
- PASS No ProfileForm.tsx modification (owned by Plan 07a Task 3) — git diff confirms
