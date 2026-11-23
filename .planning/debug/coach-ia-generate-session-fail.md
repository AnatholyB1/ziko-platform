---
status: resolved
trigger: "DATA_START Coach IA wizard step 4/4 'Où tu t'entraînes ?' (Salle complète selected) -> 'Générer ma séance' shows alert 'Impossible de générer la séance. Réessaie.' (iOS TestFlight 1.5.2, 5G) DATA_END"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
expected: Tapping "Générer ma séance" generates a workout session via backend AI.
actual: Alert "Erreur — Impossible de générer la séance. Réessaie."
errors: none beyond alert text; check backend logs (Vercel), Sentry (org anatholy, region de.sentry.io, project ziko-mobile — nothing related found in last 7d), credit gate (creditCheck), ai_cost_log.
timeline: reported during TestFlight testing 2026-11-18/19
reproduction: Entraînement tab -> Coach IA -> steps 1-4 -> Salle complète -> Générer ma séance

## Resolution
root_cause: ai-generate.tsx posted {tool, input} to /ai/tools/execute, which expects {tool_name, parameters} -> HTTP 400 every time; target tool ai_programs_generate also needs goal/days_per_week and saves a multi-day program. Screen catch hid the 400 behind a generic alert (hence nothing in Sentry). Established from code only, Vercel logs/credits not checked.
fix: new route POST /ai/session/generate ({energy,duration,zone,equipment} -> {result:{exercises,adaptation_note}}) in backend/api/src/routes/ai.ts; wizard calls it; hardcoded fake chest session on empty response removed. Uses `chat` credit gate.
verification: not run (no node_modules). Backend must be deployed to Vercel first (else 404); mobile needs new build/OTA.
files_changed: backend/api/src/routes/ai.ts, apps/mobile/app/(app)/workout/ai-generate.tsx
