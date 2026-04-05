---
phase: 17-db-foundation-model-fix
plan: 01
subsystem: api
tags: [anthropic, ai-sdk, model-management, hono, typescript]

# Dependency graph
requires: []
provides:
  - Centralized AI model constants in backend/api/src/config/models.ts
  - AGENT_MODEL constant (claude-sonnet-4-20250514) used by all AI routes
  - VISION_MODEL constant (claude-haiku-4-5-20251001) ready for Phase 19 food scan
  - Zero inline anthropic() calls in routes/ or tools/ directories
affects: [17-02, phase-18, phase-19, phase-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Centralized model constants pattern — all AI model IDs in one file, imported by consumers
    - Single-source-of-truth for model management — when ID changes, update ONE file

key-files:
  created:
    - backend/api/src/config/models.ts
  modified:
    - backend/api/src/routes/ai.ts
    - backend/api/src/tools/ai-programs.ts
    - backend/api/src/routes/pantry-recipes.ts

key-decisions:
  - "models.ts is the ONLY file calling anthropic() with model ID strings — consumers import pre-built constants"
  - "VISION_MODEL uses claude-haiku-4-5-20251001 to replace the deprecated haiku-3 model (April 19, 2026 deadline)"
  - "Comment text in models.ts must not contain deprecated model ID string — grep audit must return zero matches"

patterns-established:
  - "Model centralization: import { AGENT_MODEL } from '../config/models.js' — used in all 3 consumer files"

requirements-completed: [COST-01]

# Metrics
duration: 2min
completed: 2026-04-05
---

# Phase 17 Plan 01: DB Foundation Model Fix Summary

**Centralized AI model constants into backend/api/src/config/models.ts with AGENT_MODEL + VISION_MODEL, eliminating all inline anthropic() calls from routes and tools**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-05T12:35:06Z
- **Completed:** 2026-04-05T12:37:51Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 updated)

## Accomplishments
- Created `backend/api/src/config/models.ts` — single source of truth for all AI model IDs
- Eliminated 3 inline `anthropic('claude-sonnet-4-20250514')` references (4 total occurrences across 3 files)
- Grep audit confirmed zero occurrences of deprecated `claude-3-haiku-20240307` in all source files
- TypeScript type-check passes with zero errors after migration
- VISION_MODEL constant pre-positioned for Phase 19 food scan cost reduction (COST-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Grep audit + create shared model constants file** - `67802ca` (feat)
2. **Task 2: Migrate all inline model references to shared imports** - `7dad453` (feat)
3. **Fix: Remove deprecated model ID from comment** - `e5004cc` (fix)

## Files Created/Modified
- `backend/api/src/config/models.ts` - New centralized model constants: AGENT_MODEL + VISION_MODEL
- `backend/api/src/routes/ai.ts` - Removed `anthropic` import and inline `AGENT_MODEL`; imports from config/models.js
- `backend/api/src/tools/ai-programs.ts` - Replaced 2x inline `anthropic()` calls with `AGENT_MODEL` import
- `backend/api/src/routes/pantry-recipes.ts` - Replaced inline `anthropic()` call with `AGENT_MODEL` import

## Decisions Made
- `models.ts` is the ONLY file that calls `anthropic()` with model ID strings; all consumers import pre-built constants
- VISION_MODEL explicitly named for Phase 19's food scan endpoint to get 70% cost reduction
- Comment text in models.ts must not contain the deprecated model ID string itself — grep audit requires zero text matches

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deprecated model ID present in models.ts comment text**
- **Found during:** Post-task final verification
- **Issue:** The comment `// Replaces deprecated claude-3-haiku-20240307` in models.ts caused the grep audit to return a match — the plan requires zero matches
- **Fix:** Rewrote comment to reference "haiku-3 model" without including the deprecated ID string
- **Files modified:** backend/api/src/config/models.ts
- **Verification:** `grep -rn "claude-3-haiku-20240307" backend/ apps/ plugins/ packages/ supabase/` returns zero matches
- **Committed in:** e5004cc (fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in comment text causing grep false-positive)
**Impact on plan:** Minor documentation adjustment. No scope creep.

## Issues Encountered
None beyond the comment text grep match which was auto-fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 17 Plan 02 (DB foundation — schema additions for credits system) can proceed immediately
- Phase 19 VISION_MODEL constant is ready — the food scan endpoint can import it directly
- Any future model ID changes require only editing `backend/api/src/config/models.ts`

## Self-Check: PASSED

- FOUND: backend/api/src/config/models.ts
- FOUND: backend/api/src/routes/ai.ts
- FOUND: backend/api/src/tools/ai-programs.ts
- FOUND: backend/api/src/routes/pantry-recipes.ts
- FOUND: .planning/phases/17-db-foundation-model-fix/17-01-SUMMARY.md
- Commits verified: 67802ca, 7dad453, e5004cc

---
*Phase: 17-db-foundation-model-fix*
*Completed: 2026-04-05*
