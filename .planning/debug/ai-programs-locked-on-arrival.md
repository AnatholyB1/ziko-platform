---
status: resolved
trigger: "DATA_START Programmes IA plugin is not accessible right after onboarding because it is 'not unlocked' — illogical, should be available on arrival. DATA_END"
created: 2026-11-19
updated: 2026-11-19
---

## Symptoms
expected: A new user can open Programmes IA (plugin ai-programs) immediately after onboarding.
actual: Plugin is locked / not unlocked on arrival (likely gamification/progression unlock gating or not auto-installed).
errors: none
timeline: TestFlight 1.5.2
reproduction: Fresh account, finish onboarding, try to open Programmes IA

## Resolution
root_cause: Phase 46 progressive-unlock gates ai-programs at minLevel 4; new users are level 1 so PluginLoader skips it and the drawer shows it locked.
fix: ai-programs minLevel 4 -> 1 in plugins/ai-programs/src/manifest.ts and PLUGIN_LEVEL_MAP in packages/plugin-sdk/src/gating.ts; expected counts updated in gating.test.ts and unlockUi.test.ts.
verification: not run (no node_modules) — run `npx vitest run` in packages/plugin-sdk. Not confirmed whether ai-programs is auto-installed after onboarding.
files_changed: plugins/ai-programs/src/manifest.ts, packages/plugin-sdk/src/gating.ts, packages/plugin-sdk/src/gating.test.ts, packages/plugin-sdk/src/unlockUi.test.ts
