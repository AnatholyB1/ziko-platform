---
phase: 34-auth-onboarding-redesign
plan: 01
subsystem: auth
tags: [react-native, expo-router, supabase-auth, nativewind, reanimated, ionicons]

requires:
  - phase: 32-design-system-foundation
    provides: design tokens (colors, spacing, typography)
provides:
  - AuthWelcome with Apple (white) + Google (glass) + Email buttons in correct CTA order
  - AuthSignin with hardcoded light-theme tokens, generic error messages
  - AuthSignup with 4-segment real-time password strength bar
  - AuthForgot with form/sent state, FadeIn success card, green rgba tokens
affects:
  - 34-02-onboarding (same auth shell pattern)
  - any future OAuth Apple integration (placeholder in place)

tech-stack:
  added: []
  patterns:
    - "Hardcoded design tokens pattern: auth screens use literal hex/rgba values (no useThemeStore)"
    - "T-34-01 mitigated: generic error message on login failure (no raw Supabase error leak)"
    - "T-34-02 accepted: Apple OAuth placeholder via showAlert pending real OAuth integration"

key-files:
  created: []
  modified:
    - apps/mobile/app/(auth)/welcome.tsx
    - apps/mobile/app/(auth)/login.tsx
    - apps/mobile/app/(auth)/register.tsx
    - apps/mobile/app/(auth)/forgot.tsx

key-decisions:
  - "Hardcode all design tokens in auth screens (remove useThemeStore) — auth screens don't need dynamic theming, tokens are stable from Phase 32 DS"
  - "Apple button uses showAlert placeholder — T-34-02 accepted, OAuth not wired in this phase"
  - "Generic Connexion impossible message on login error — T-34-01 mitigated, prevents account existence leakage"
  - "FadeIn.duration(250) from react-native-reanimated on AuthForgot success card — already installed per Registry Safety"

patterns-established:
  - "Auth screens: #F7F6F3 bg / #FFFFFF surface / #E2E0DA border — no theme tokens"
  - "Back button: 36x36, borderRadius 12, rgba(28,26,23,0.06), chevron-back size 16"
  - "CTA disabled state: rgba(28,26,23,0.18) for dark CTAs, rgba(255,92,26,0.30) for primary CTAs"
  - "Valid primary CTA shadow: shadowColor rgba(255,92,26,0.55), shadowOffset 0 8, shadowRadius 22"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05

duration: 18min
completed: 2026-05-22
---

# Phase 34 Plan 01: Auth Screens Redesign Summary

**4 auth screens rebuilt pixel-for-pixel per UI-SPEC: Apple/Google/Email CTA order on dark welcome screen, hardcoded light-sport tokens on form screens, 4-segment real-time password strength bar, FadeIn success card on forgot screen**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-22T10:00:00Z
- **Completed:** 2026-05-22T10:18:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- AuthWelcome: Apple button (white bg, logo-apple) added as first CTA, Google restyle to glass border (rgba(255,250,246,0.06)), CTA order now Apple > Google > Email per spec
- AuthSignin + AuthSignup: removed useThemeStore, all theme.x tokens replaced with hardcoded hex/rgba values matching the Phase 32 DS; strength bar STRENGTH_COLORS/LABELS confirmed correct; CTA shadow on valid state
- AuthForgot: form/sent state with FadeIn.duration(250) animation on success card using exact rgba green tints; T-34-01 threat mitigation applied (generic login error message)

## Task Commits

1. **Task 1: AuthWelcome — add Apple button + fix CTA order** - `281717d` (feat)
2. **Task 2: AuthSignin + AuthSignup — lock exact style values** - `c02cfcf` (feat)
3. **Task 3: AuthForgot — lock style values, verify sent-state card** - `c27be15` (feat)

## Files Created/Modified

- `apps/mobile/app/(auth)/welcome.tsx` — Apple button first, Google glass style, Email transparent border
- `apps/mobile/app/(auth)/login.tsx` — hardcoded tokens, rgba(28,26,23,0.18) disabled CTA, generic error (T-34-01)
- `apps/mobile/app/(auth)/register.tsx` — hardcoded tokens, rgba(255,92,26,0.30) disabled CTA, shadowRadius 22 on valid CTA
- `apps/mobile/app/(auth)/forgot.tsx` — hardcoded tokens, rgba(46,158,91,0.08/0.25) success card, FadeIn animation

## Decisions Made

- Hardcoded all design tokens (removed useThemeStore from all 3 form screens) — auth screens are fixed light-theme only, tokens are stable from Phase 32 DS, no runtime theming needed
- Apple OAuth stays as showAlert placeholder — T-34-02 accepted (spoofing risk mitigated by not attempting fake OAuth flow)
- Generic "Connexion impossible" error message — T-34-01 mitigated (raw Supabase errors could expose account existence)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] T-34-01 generic error message applied**
- **Found during:** Task 2 (AuthSignin)
- **Issue:** Plan's threat model lists T-34-01 as `mitigate` — original code used raw `err.message` from Supabase which could leak account existence
- **Fix:** Changed catch block to `showAlert('Connexion impossible', 'Email ou mot de passe incorrect.')` — generic message regardless of Supabase error
- **Files modified:** apps/mobile/app/(auth)/login.tsx
- **Verification:** Error message is hardcoded generic string, not Supabase error passthrough
- **Committed in:** c02cfcf

---

**Total deviations:** 1 auto-fixed (Rule 2 — threat model mitigated)
**Impact on plan:** Correctness fix per threat register. No scope creep.

## Issues Encountered

None — all tasks executed cleanly. Pre-existing TypeScript errors in chat.tsx and ImportFileScreen.tsx are out-of-scope and documented in deferred items.

## Known Stubs

None — all 4 screens are fully wired to Supabase auth. Apple OAuth is a placeholder by design (T-34-02 accepted).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| No new flags | — | T-34-01 mitigated (generic error), T-34-02 accepted (Apple placeholder). No new surfaces introduced beyond plan. |

## User Setup Required

None — no external service configuration required for UI-only changes.

## Next Phase Readiness

- 4 auth screens match UI-SPEC pixel-for-pixel
- Ready for Plan 34-02 (Onboarding screen rebuild — OBGoal, OBLevel, OBFreq, OBEquip, OBBio, OBPrep, OBReady)
- No blockers

---
*Phase: 34-auth-onboarding-redesign*
*Completed: 2026-05-22*
