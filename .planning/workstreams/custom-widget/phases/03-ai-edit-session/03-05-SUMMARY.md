---
phase: 03-ai-edit-session
plan: "05"
subsystem: testing
tags: [vitest, zod, unit-tests, dashboard, widget-tools, pitfalls]

requires:
  - phase: 03-ai-edit-session/03-01
    provides: applyAddWidget, applyUpdateWidget, applyRemoveWidget, applyReorderWidgets in tools.ts
  - phase: 03-ai-edit-session/03-02
    provides: SSE /ai-edit endpoint with appendMessages + stepCountIs(2) + tool_result events
  - phase: 03-ai-edit-session/03-03
    provides: DashboardEditOverlay + EditChatPanel with configRef pattern
  - phase: 03-ai-edit-session/03-04
    provides: dashboard/page.tsx wired with Personnaliser button + overlay

provides:
  - "17 passing unit + integration tests for the 4 dashboard tool handler functions"
  - "D-18 two-turn integration test proves multi-turn state propagation works"
  - "Explicit PITFALLS checklist clearance for all 15 items with file/line evidence"

affects: [custom-widget-phase-04, any-future-dashboard-tools]

tech-stack:
  added: []
  patterns:
    - "Widget fixtures use valid RFC 4122 v4 UUIDs (Zod z.string().uuid() enforces this)"
    - "applyAddWidget input typed as Record<string, unknown> — callers use `as unknown as Record<string, unknown>` cast"

key-files:
  created:
    - backend/api/src/coach/dashboards/tools.test.ts
  modified: []

key-decisions:
  - "UUID fixtures must be valid RFC 4122 v4 format — WidgetSchema enforces z.string().uuid() which rejects shorthand IDs like 'aaa-111'"
  - "Cast Widget to Record<string,unknown> at test call sites — applyAddWidget signature accepts unknown to allow schema rejection tests"

patterns-established:
  - "Two-turn integration test pattern: simulate appendMessages by reassigning currentWidgets = after_turn1 between turns"
  - "PITFALLS clearance: grep evidence in SUMMARY, not inline code comments alone"

requirements-completed:
  - EDIT-02
  - INFRA-02b

duration: 12min
completed: "2026-05-28"
---

# Phase 03 Plan 05: Unit Tests for Dashboard Tool Handlers Summary

**17 vitest unit + integration tests for the 4 pure tool handlers, WidgetSchema strict rejection, and D-18 two-turn scenario — all passing, 0 TypeScript errors**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-28T14:00:00Z
- **Completed:** 2026-05-28T14:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `backend/api/src/coach/dashboards/tools.test.ts` with 17 tests covering all 4 tool handler pure functions
- All tests pass: `npx vitest run src/coach/dashboards/tools.test.ts` — 17/17 passed
- D-18 two-turn integration test confirms state propagation: turn 1 add, simulate appendMessages, turn 2 update references correct widget
- TypeScript compilation: 0 errors (`npx tsc --noEmit`)

## Task Commits

1. **Task 1: Unit tests for 4 tool functions + D-18 integration** - `6407022` (test)

**Plan metadata:** `[pending docs commit]`

## Files Created/Modified

- `backend/api/src/coach/dashboards/tools.test.ts` — 17 vitest tests: 5 applyAddWidget, 3 applyUpdateWidget, 2 applyRemoveWidget, 2 applyReorderWidgets, 3 WidgetSchema rejection, 2 D-18 two-turn integration

## Decisions Made

- Fixture IDs must be valid RFC 4122 v4 UUIDs. Initial fixtures used shorthand IDs (`aaa-111-...`) which were rejected by Zod's `z.string().uuid()`. Fixed to `aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa` pattern.
- `applyAddWidget` takes `Record<string, unknown>` — test callsites use `as unknown as Record<string, unknown>` cast to allow passing both valid `Widget` objects and invalid objects for rejection tests without TypeScript errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed UUID format in test fixtures**
- **Found during:** Task 1 — first vitest run
- **Issue:** Fixtures used shorthand IDs (`aaa-111-aaa-111-aaa111aaa111`) which are not valid RFC 4122 UUIDs. `WidgetSchema` uses `z.string().uuid()` which correctly rejected them, causing 5 test failures.
- **Fix:** Changed fixture IDs to `aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa` and `bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb` (valid v4 UUIDs).
- **Files modified:** `backend/api/src/coach/dashboards/tools.test.ts`
- **Verification:** All 17 tests pass after fix.
- **Committed in:** `6407022` (same task commit)

**2. [Rule 1 - Bug] Fixed TypeScript type cast for applyAddWidget test calls**
- **Found during:** Task 1 — `tsc --noEmit` pass
- **Issue:** `applyAddWidget` takes `Record<string, unknown>` but `Widget` interface has no index signature — 6 TypeScript errors.
- **Fix:** Added `as unknown as Record<string, unknown>` cast at all test callsites where `Widget` objects are passed to `applyAddWidget`.
- **Files modified:** `backend/api/src/coach/dashboards/tools.test.ts`
- **Verification:** `tsc --noEmit` reports 0 errors.
- **Committed in:** `6407022` (same task commit, amend-style in same session)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs from first test run)
**Impact on plan:** Both fixes required for correctness. No scope creep.

## PITFALLS Checklist Clearance

All 15 items from `.planning/workstreams/custom-widget/research/PITFALLS.md` verified:

| # | Red Flag | Status | Evidence |
|---|----------|--------|----------|
| 1 | `additionalProperties: true` or `any` type in widget schema | **CLEARED** | `grep "additionalProperties.*false" backend/api/src/coach/dashboards/tools.ts` — 4 matches in `jsonSchema()` calls for all 4 tools. All Zod schemas use `.strict()` (`schemas.ts` lines 10, 25, 37, 51, 63, 75, 88, 100). Test `"throws on additionalProperties violation (PITFALLS #1)"` passes. |
| 2 | `response.messages` not appended after tool-call steps | **CLEARED** | `grep "appendMessages" backend/api/src/coach/dashboards/service.ts` — present in `finally` block (line 195). D-18 two-turn test simulates the side-effect: `currentWidgets = after_turn1` between turns 1 and 2, proving correct multi-turn state propagation. |
| 3 | Tool result emitted from streamed text (not atomic) | **CLEARED** | `grep "tool_result" backend/api/src/coach/dashboards/service.ts` — present only inside `onStepFinish` callback (line 136). Comment: `// PITFALLS #3: tool results emitted only in onStepFinish (atomic)`. Never emitted from `text-delta` loop. |
| 4 | `configRef.current` absent from SSE handler (stale closure) | **CLEARED** | `grep "configRef.current" apps/web/src/components/coach/dashboard/EditChatPanel.tsx` — present in POST body at line 100: `currentWidgets: configRef.current`. Comment: `// always current — avoids stale closure`. |
| 5 | `configRef.current` not updated alongside `setPendingWidgets` | **CLEARED** | `grep "configRef.current" apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — assigned at line 49 (`configRef.current = widgets`) in the same handler that calls `setPendingWidgets`. Comment: `// Both pendingWidgets (re-render) and configRef (async closures) updated together`. |
| 6 | System prompt not scoped ("close the editor" guard absent) | **CLEARED** | `grep "close the editor" backend/api/src/coach/dashboards/service.ts` — present in system prompt string (line 125): "For coaching questions, ask the coach to close the editor first." |
| 7 | Undo stack / version history scoped mid-sprint | **CLEARED** | `grep -i "history\|undo stack\|version" apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — only `previousConfigRef` (one-tap undo, D-14). No undo stack, no version drawer. |
| 8 | `schema_version` missing from stored configs | **CLEARED** | `grep "schema_version" backend/api/src/coach/dashboards/service.ts` — line 62: `{ schema_version: 1 as const, ...row }` returned on PUT. `DashboardConfigSchema` enforces `schema_version: z.literal(1)`. |
| 9 | `appendMessages` call absent (same as #2) | **CLEARED** | See #2 above. |
| 10 | `configRef` not set (same as #4/#5) | **CLEARED** | See #4 and #5 above. |
| 11 | "Personnaliser" button requires more than 1 tap | **CLEARED** | `grep "Personnaliser" apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` — button at line 113, always visible in view mode (comment line 68: "visible only when not in AI edit session"). One tap opens overlay. |
| 12 | Opening message is generic ("How can I help you?") | **CLEARED** | `grep "Votre dashboard affiche" apps/web/src/components/coach/dashboard/EditChatPanel.tsx` — line 31: opening content starts with `Votre dashboard affiche actuellement : [widget names]`. Action-oriented, not generic. |
| 13 | `stepCountIs(5)` inherited from global agent | **CLEARED** | `grep "stepCountIs(2)" backend/api/src/coach/dashboards/service.ts` — line 128: `stopWhen: stepCountIs(2)`. Comment: `// PITFALLS #13: stepCountIs(2) — not 5`. |
| 14 | Auto-save on every tool call (no explicit Save button) | **CLEARED** | `grep "onLayoutChange\|useEffect.*save\|autoSave" apps/web/src/components/coach/dashboard/DashboardEditOverlay.tsx` — 0 matches. Save requires explicit button press. |
| 15 | "Extensible widget set" mentioned mid-sprint | **CLEARED** | `grep -ri "extensible\|infinite\|custom widget" backend/api/src/coach/dashboards/` — 0 matches. Widget set is a hard 7-type enum in `WidgetSchema`. |

**Result: 15/15 CLEARED**

## Known Stubs

None — this plan creates only test code; no UI rendering or data-source wiring.

## Threat Flags

None — test file introduces no network endpoints, auth paths, or schema changes.

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## Next Phase Readiness

Phase 03 is complete. The checkpoint `type="checkpoint:human-verify"` (Task 2 in this plan) documents the full manual verification checklist:

1. Backend type-check: `cd backend/api && npx tsc --noEmit` → 0 errors (CONFIRMED)
2. Unit tests: `npx vitest run src/coach/dashboards/tools.test.ts` → 17/17 passed (CONFIRMED)
3. PITFALLS checklist: 15/15 CLEARED (CONFIRMED in this SUMMARY)
4. Frontend type-check and smoke test: pending human verification

## Self-Check: PASSED

- `backend/api/src/coach/dashboards/tools.test.ts` — FOUND
- Commit `6407022` — FOUND
- 17 tests passing — CONFIRMED
- 0 TypeScript errors — CONFIRMED

---
*Phase: 03-ai-edit-session*
*Completed: 2026-05-28*
