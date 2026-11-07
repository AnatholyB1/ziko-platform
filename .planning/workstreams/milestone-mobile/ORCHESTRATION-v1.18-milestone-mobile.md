# Orchestration v1.18 (milestone-mobile) - resume file

Orchestrator: orch-mobile. Integration branch: `milestone/v1.18` @ worktree `.claude/worktrees/integration-v1.18` (from origin/main 71d240e7; local `main` is STALE, never use it as base).
Ports 3100-3139, throwaway PG 54400-54439. Machine lock: mkdir C:\ziko-platform\.planning\.machine-lock.

## Reality check (lead brief was stale)
Phases 42, 43, 44 are COMPLETE and already in origin/main (44 verified 5/5, device checkpoint approved). Remaining: 45, 46, 47. Tables are now `ziko_`-prefixed (portfolio migration).

## Wave plan
| Wave | Phases | Why | Conflict files | Human gates |
|---|---|---|---|---|
| A (now) | 45 backend+migrations, 46 SDK/loader/authStore, 47a (8th context query, cost-log helper, source fixes) | independent; 46 only reads athlete_state.level; 47a touches context/user.ts, routes/onboarding.ts, onboarding-retroactive.ts | 45 owns coaching-engine/apply.ts+registry.ts; 47a only adds lib/ helper + context; additive in registry | gray-area answers, mockups |
| A-design | 45 reveal overlay, 46 locked drawer + unlock toast | UI phases, mockup-first | - | mockup validation (one pass) |
| B | 45 UI, 46 drawer UI, 47b push (needs 45 reward wording) + create_reward cost log | after A merged | apply.ts (45 then 47b) | ANJ/JONUM counsel review (release note) |
| Close | audits (review/security/verify) per phase, fixes, gate, UAT, DEPLOY-CHECKLIST-v1.18.md | | | migrations applied only after user approval |

## Status
- [x] integration worktree created
- [x] scouting of 45/46/47 gray areas done (reports summarized in MILESTONE-RUN.md)
- [ ] user answers (batch 1 sent to team-lead)
- [ ] 47a builder
