---
status: awaiting_human_verify
trigger: "DATA_START First coach (Ziko) conversation bug: chat shows the user message 'Conclus maintenant et donne-moi ma mission, s'il te plaît.' twice, no AI reply, then footer 'On dirait qu'on tourne en rond — appuie pour qu'on conclue quand même.' with button 'Terminer quand même'. iOS TestFlight 1.5.2 DATA_END"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
expected: First conversation (post-onboarding) with Ziko coach AI answers, then concludes and gives the user a mission/quest.
actual: The auto "conclude" message is sent twice (duplicate), AI never replies, loop-detection footer appears with "Terminer quand même".
errors: none visible; check backend /ai/chat/stream, credit gate, conversation persistence (duplicate append), client send logic (double trigger / retry / effect running twice).
timeline: TestFlight testing 2026-11-18/19
reproduction: Fresh account -> onboarding -> first coach conversation screen

## Current Focus
status_note: fix applied in working tree, awaiting human verify (tests not run: node_modules absent)
root_cause: backend/api/src/routes/onboarding.ts emitted cap_reached on ANY turn without assess_profile (and ignored fullStream error parts). Opening turn sends messages [] -> empty prompt rejected by Anthropic -> error part swallowed -> cap_reached -> footer. Failed turns also persisted the user message (duplicates on retry); client had no sync re-entrancy guard for double tap.
fix: synthetic user kick-off message when no/leading-assistant messages; handle error part (error event, no cap_reached, no persistence); cap_reached only when user turns > 6; client inFlightRef guard in ziko-chat.tsx; spec updated.
files_changed: backend/api/src/routes/onboarding.ts, backend/api/test/routes/onboarding.spec.ts, apps/mobile/app/(auth)/onboarding/ziko-chat.tsx
