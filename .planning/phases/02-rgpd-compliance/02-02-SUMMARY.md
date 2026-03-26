---
phase: 02-rgpd-compliance
plan: 02
subsystem: ui
tags: [nextjs, react, server-actions, next-intl, tailwind, rgpd]

# Dependency graph
requires:
  - phase: 02-rgpd-compliance
    plan: 01
    provides: "deleteAccount Server Action, DeleteAccountState type, Supabase admin client, Upstash rate limiter"
provides:
  - "DeleteAccountForm client component with high-friction confirmation UX (email + checkbox + SUPPRIMER)"
  - "/supprimer-mon-compte static page route"
  - "Footer link to deletion page in both FR and EN locales"
  - "Footer.deleteAccount translation keys in fr.json and en.json"
affects: [03-marketing, 04-seo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useActionState from 'react' (not useFormState from 'react-dom') for Server Action integration"
    - "Client Component island inside a static Server Component page shell"
    - "High-friction deletion UX: email + irreversible checkbox + typed SUPPRIMER confirmation"

key-files:
  created:
    - src/components/account/DeleteAccountForm.tsx
    - src/app/[locale]/supprimer-mon-compte/page.tsx
  modified:
    - src/components/layout/Footer.tsx
    - messages/fr.json
    - messages/en.json

key-decisions:
  - "Success state hides the form entirely (no stale inputs visible after submission)"
  - "Submit button uses red (bg-red-600) to signal destructive action — departs from primary orange"
  - "Page text hardcoded French (no i18n keys) consistent with D-07 for legal/compliance copy"
  - "Footer deletion link styled text-muted to visually separate from core legal links"

patterns-established:
  - "Client Component island pattern: 'use client' form inside async Server Component page"
  - "useActionState(serverAction, initialState) wiring for progressive-enhancement form handling"

requirements-completed: [RGPD-01, RGPD-02]

# Metrics
duration: 25min
completed: 2026-03-26
---

# Phase 02 Plan 02: Account Deletion UI Summary

**Client Component deletion form with email + checkbox + typed SUPPRIMER confirmation, wired to deleteAccount Server Action via useActionState, accessible from footer on every page**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-26
- **Completed:** 2026-03-26
- **Tasks:** 3 (2 auto + 1 checkpoint verified)
- **Files modified:** 5

## Accomplishments

- DeleteAccountForm client component with three-layer confirmation (email + irrevocable checkbox + type "SUPPRIMER")
- Static /supprimer-mon-compte page following Next.js 15 setRequestLocale pattern
- Footer updated with deletion link in both FR ("Supprimer mon compte") and EN ("Delete my account") locales
- Form uses useActionState from React 19 — success state replaces form with green confirmation, errors render inline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DeleteAccountForm client component and page route** - `9ce2ed7` (feat)
2. **Task 2: Add footer deletion link and translation keys** - `87715e5` (feat)
3. **Task 3: Human verification checkpoint** - approved by user (no commit)

## Files Created/Modified

- `src/components/account/DeleteAccountForm.tsx` — Client Component form with useActionState, success/error states, canSubmit guard
- `src/app/[locale]/supprimer-mon-compte/page.tsx` — Static Server Component page shell rendering DeleteAccountForm
- `src/components/layout/Footer.tsx` — Added Link to /supprimer-mon-compte using t('deleteAccount')
- `messages/fr.json` — Added Footer.deleteAccount = "Supprimer mon compte"
- `messages/en.json` — Added Footer.deleteAccount = "Delete my account"

## Decisions Made

- Used red submit button (bg-red-600) instead of primary orange to signal destructive action — consistent with RGPD high-friction intent
- Page heading/description hardcoded French JSX (not i18n keys) per D-07 decision from Plan 01
- Footer deletion link styled as text-muted to visually differentiate from the three legal navigation links

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this plan. Upstash and Supabase credentials are handled by Plan 01.

## Next Phase Readiness

- Full RGPD Art. 17 deletion flow is complete: rate limiter (Plan 01) + Server Action (Plan 01) + UI (this plan)
- Phase 02 Plan 03 (legal pages) was already completed: Mentions Légales, Politique de Confidentialité, CGU
- Phase 02 RGPD compliance is fully delivered — ready for Phase 03 marketing content

---
*Phase: 02-rgpd-compliance*
*Completed: 2026-03-26*
