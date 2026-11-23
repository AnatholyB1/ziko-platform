---
status: resolved
trigger: "DATA_START No quest/mission is shown right on arrival after onboarding (home). DATA_END"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
expected: After onboarding the user sees a first quest/mission immediately (possibly the one produced by the first coach conversation, 'donne-moi ma mission').
actual: No quest on arrival.
errors: none
timeline: TestFlight 1.5.2
reproduction: Fresh account, finish onboarding, go to home/Accueil

## Resolution
root_cause: Home "Mission du jour" card read only ziko_ai_generated_programs (active program). The onboarding chat mission (micro_action + mission_title) is stored only in ziko_athlete_decisions.outcome (decision_type onboarding_profile) and was never surfaced on home, so fresh athletes saw "Aucun programme actif". (Upstream, the first chat itself failing is the sibling coach-first-conversation-loop issue; with no decision row, no mission exists.)
fix: added useOnboardingMission hook (useHomeData.ts); MissionCardContent shows the onboarding mission with CTA to the mapped plugin route when no active program.
verification: tsc --noEmit shows no errors in touched files. Not verified on device.
files_changed: [apps/mobile/src/hooks/useHomeData.ts, apps/mobile/app/(app)/index.tsx]

## Current Focus
hypothesis: unknown (candidates: quests only generated after first coach conversation which itself is broken — see coach-first-conversation-loop; quest generation/seed not triggered at onboarding end; gamification plugin not loaded)
next_action: gather initial evidence — find quest generation/display code and what triggers the first quest. Coordinate with coach-first-conversation-loop session (shared root cause possible).
