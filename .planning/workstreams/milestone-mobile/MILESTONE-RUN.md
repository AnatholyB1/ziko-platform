# MILESTONE-RUN v1.18

| Time | Event | Branch | Commit | Gate |
|---|---|---|---|---|
| 2026-11-07 | integration worktree from origin/main | milestone/v1.18 | 71d240e7 | - |

## Scouting highlights
- 47: context/user.ts already has 7 queries -> athlete_state is the 8th (ROADMAP says 7th, stale). Cost-log gaps: routes/onboarding.ts (source defaults user_chat), tools/onboarding-retroactive.ts (no log). create_goal/create_program have no model call.
- 45: only `met` boolean stored by 44; "exceeded" rule needed. RPC v2 already accepts points/tier/level and ratchets points+tier (GREATEST), not level. New tables ziko_reward_catalog + ziko_athlete_rewards needed.
- 46: ROADMAP criteria 1 (hides) vs 3 (marks locked) conflict; no migration; authStore already reads ziko_athlete_state.

## Pending gray areas (default = recommended unless overridden)
See messages to team-lead (batch 1).

## Deploy checklist items so far
- Migrations (45: reward catalog + athlete_rewards + grant path) to apply after approval.
- ANJ/JONUM counsel review before broad release of rewards.
| 2026-11-07 | merge 47a | milestone/v1.18 | 815fd362 | builder gate: 193 pass, tsc clean |
| 2026-11-07 | merge 46 logic, 45 backend, design 45/46 (no conflicts) | milestone/v1.18 | 432a1416 | backend tsc OK, backend 249 pass/3 skip/14 todo (8 live specs skipped), root vitest 188/188, sdk tsc OK, mobile tsc 0 errors |
Not proven: migrations never executed (supabase/portfolio-migrations/20261107100{000,100,200}_*.sql); loader/guard/foreground refetch untested on device; design agent skipped most design skills (re-critique before build).
| 2026-11-07 | merge 47b, audits 45/46, fixes 45/46 | milestone/v1.18 | (see git log) | backend 267 pass, root 197 pass, mobile tsc 0 err |
Pending: user validation of design gallery (4 questions) -> then UI build (45 overlay, 46 drawer+toast+unlock queue), critique pass of mockups, final audits of UI, UAT (backend 8080 + Expo web / Playwright), 47 final verification.
| 2026-11-07 | design refine merged (skills applied, PNGs viewed); UI 45 overlay + UI 46 drawer/toast merged; overlay publishes overlayGateStore | milestone/v1.18 | see git log | mobile tsc 0 err, root vitest 234, backend 267 |
Next: UI audits 45/46 + real UAT (backend 8080 + Expo web/Playwright, throwaway PG 54420), fixes, 47 final verification, close-out.
Open: toast queue behind overlay not proven at runtime; CustomAlert default info icon + OK contrast 3.09 (shared component, out of scope).
