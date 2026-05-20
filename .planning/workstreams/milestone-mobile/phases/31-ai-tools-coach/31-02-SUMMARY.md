---
plan: 31-02
phase: 31-ai-tools-coach
status: complete
commit: fd21f4f
checkpoint: pending-user-verification
---

# Plan 31-02 Summary: Registry Wiring + Manifest Update

## What was built

**backend/api/src/tools/registry.ts** — three-point update:
- `import * as CoachTools from './coach.js'` added after NavigationTools import
- `coach_get_link` and `coach_revoke_link` entries added to executors map
- `coachToolSchemas` const added with full JSON Schema for both tools
- `...coachToolSchemas` spread added to `allToolSchemas`

**plugins/coach/src/manifest.ts** — two additions:
- `aiTools` array populated with `coach_get_link` (no params) and `coach_revoke_link` (confirmed: boolean required)
- `aiSystemPromptAddition` set to D-08 exact string

## Verification

- `npx tsc --noEmit -p backend/api/tsconfig.json` → 0 errors
- No coach/manifest TypeScript errors in mobile tsconfig
- Human end-to-end check (GET /ai/tools + POST /ai/tools/execute + full type-check) pending user confirmation
