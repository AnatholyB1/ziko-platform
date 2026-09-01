---
phase: 43-conversational-onboarding
plan: 02
status: complete
---

# 43-02 Summary — Mandatory-flow gate fix, i18n namespace, retroactive-recompute trigger

## What shipped

**Task 1 — `coach.onboarding.*` i18n namespace** (`packages/plugin-sdk/src/i18n.ts`)
Added all 16 keys to both `fr` and `en` dictionaries, verbatim from 43-UI-SPEC.md's Copywriting
Contract (D-11). Placed immediately after the existing `coach.revoke_modal.*`/`coach.error.*`
blocks in each dictionary. No pre-existing `onboarding.*` or `coach.*` key was touched — diff is
32 pure additions, 0 deletions.

**Task 2 — `athleteOnboardingComplete` + lazy retroactive-recompute trigger**
(`apps/mobile/src/stores/authStore.ts`, `apps/mobile/src/lib/onboardingRecompute.ts`)
`refreshProfile()` now reads `user_profiles` and `athlete_state.status` in one `Promise.all`
(`.maybeSingle()` on the second read — a brand-new athlete has no row). Exposes
`athleteOnboardingComplete: boolean` on `AuthState`, initialized `false` (fail-safe) and reset
`false` in `signOut()`. New `onboardingRecompute.ts` exports `triggerRetroactiveRecompute()` —
a fire-and-forget, never-throwing POST to `/ai/onboarding/retroactive`, guarded by a
module-scoped in-flight boolean since `refreshProfile()` can fire twice per app open (both
`getSession()` resolution and `onAuthStateChange`). Fired only when `onboarding_done` is true
and the `athlete_state` read returned `null` (pre-v1.18 athlete), per ONBOARD-06.

**Task 3 — Mandatory-flow redirect gate fix** (`apps/mobile/app/(auth)/_layout.tsx`)
Redirect to `/(app)` now requires `session && profile?.onboarding_done && athleteOnboardingComplete`
— all three. Closes the bypass (43-RESEARCH.md Pitfall 1 / D-02) where `step-7.tsx` sets
`onboarding_done = true` before the Ziko chat exists, so an app kill mid-chat previously sent the
athlete straight to `/(app)` and permanently skipped the mandatory conversation. All five existing
`Stack.Screen` entries (`welcome`, `login`, `register`, `forgot`, `onboarding`) are unchanged.

## Verification results

- i18n parity: 16 distinct `coach.onboarding.*` keys, each present exactly twice (fr + en) —
  confirmed with a corrected script (see Deviations below).
- `coach.onboarding.missionEyebrow` (fr) = `TA PREMIÈRE MISSION`; `coach.onboarding.celebrationCta`
  (en) = `Continue to the app →` — both exact matches.
- `cd packages/plugin-sdk && npx tsc --noEmit` — exits clean, no output.
- `cd apps/mobile && npx tsc --noEmit` — 6 pre-existing errors in `app/(app)/profile/settings.tsx`
  and `src/hooks/useNotificationSetup.ts` (unrelated `NotificationPermissionsStatus` typing issue).
  Confirmed present on the base commit before any of this plan's edits (verified via `git stash` +
  re-run). Zero new errors introduced by this plan's three files.
- `apps/mobile/src/stores/authStore.ts`: `athleteOnboardingComplete` appears 4×, `maybeSingle` 2×.
- `apps/mobile/src/lib/onboardingRecompute.ts`: contains the module-scoped in-flight guard, zero
  `throw` statements.
- `(auth)/_layout.tsx`: exactly one `<Redirect href="/(app)" />`, condition requires all three
  flags, 5 `Stack.Screen` entries unchanged.

## Deviations

- **Task 1's literal automated verify command has a pre-existing regex bug.** The plan's script
  matches keys with `/'(coach\.onboarding\.[a-zA-Z.]+)'/g` — this character class excludes digits,
  so it silently fails to match `coach.onboarding.sendA11y` (contains `1`, `1`), making the script
  report 15 distinct keys instead of 16 no matter what is implemented, since that key can never be
  captured by this pattern. This is a defect in the plan's verify script, not in the implementation:
  the UI-SPEC Copywriting Contract and the plan's own task action explicitly name the key
  `coach.onboarding.sendA11y`, and renmaing it would break the plan's own interface contract for
  downstream plan 43-05 (which references these keys in the Ziko chat screens). Verified correctness
  instead with the same script using `[a-zA-Z0-9.]+` (only the character class widened) — confirms
  16 distinct keys, each present exactly twice, all values verbatim from 43-UI-SPEC.md.
- **`apps/mobile` `npx tsc --noEmit` does not exit 0**, contradicting the literal text of two
  acceptance criteria (Task 2, Task 3) and the phase-level `<verification>` block. Root cause is
  pre-existing and unrelated to this plan: `expo-notifications`' `NotificationPermissionsStatus`
  type dropped `status`/`canAskAgain` in a version already installed on this branch, affecting
  `app/(app)/profile/settings.tsx` and `src/hooks/useNotificationSetup.ts` — neither file is in
  this plan's `files_modified` list and neither was touched. Confirmed identical on the base commit
  via `git stash` before implementing anything. No fix attempted — out of scope for 43-02 and not
  caused by it.

## Files changed

- `packages/plugin-sdk/src/i18n.ts` — +32/-0
- `apps/mobile/src/stores/authStore.ts` — modified (`athleteOnboardingComplete` field, combined
  `refreshProfile()` read, `signOut()` reset)
- `apps/mobile/src/lib/onboardingRecompute.ts` — new file, `triggerRetroactiveRecompute()`
- `apps/mobile/app/(auth)/_layout.tsx` — +7/-1 (third gate condition + explanatory comment)

## Commits

1. `feat(43-02): add coach.onboarding.* i18n namespace for Ziko chat`
2. `feat(43-02): add athleteOnboardingComplete + lazy retroactive-recompute trigger`
3. `fix(43-02): close mandatory-flow gate bypass in (auth)/_layout.tsx`

## Handoff notes for downstream plans

- Plan 43-04 must implement `POST /ai/onboarding/retroactive` matching the interface contract this
  plan's client already assumes (bearer-token-derived userId, `{}` body, tolerant of any response
  shape since the client never inspects the body).
- Plan 43-05 (Ziko chat screens) can now consume all 16 `coach.onboarding.*` keys via `useTranslation()`.
- The `(auth)/_layout.tsx` gate is now correct for any future onboarding UI built against
  `athlete_state` — no further gate changes should be needed for this phase.
