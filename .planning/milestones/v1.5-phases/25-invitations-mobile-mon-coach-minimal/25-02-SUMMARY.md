---
phase: 25
plan: 02
subsystem: backend-coach-invitations
tags: [hono, supabase, rls, nanoid, bounded-module]
requires:
  - .planning/phases/25-invitations-mobile-mon-coach-minimal/25-01-SUMMARY.md (nanoid + coach-sdk schemas)
  - supabase/migrations/035_coach_invitations_links_rls.sql (coach_invitations table + RLS)
  - backend/api/src/coach/identity/ (canonical bounded-module pattern)
  - backend/api/src/middleware/auth.ts (authMiddleware → c.set('auth', ...))
provides:
  - POST /coach/invitations (generate code) → INVITE-01
  - GET /coach/invitations?status=active|used|expired|revoked|all → INVITE-02
  - DELETE /coach/invitations/:id (idempotent revoke) → INVITE-02
  - insertInvitation / listInvitations / revokeInvitation (db.ts exports)
  - invitationsRouter (sole public symbol from this module per ARCH-01)
affects:
  - downstream plan 04 (web /coach/invitations UI consumes these three endpoints)
  - downstream plan 06 (validation suite writes integration tests against these endpoints)
tech-stack:
  added:
    - none (uses nanoid@3.3.12 already installed in plan 01)
  patterns:
    - Bounded module shape mirrors coach/identity/ exactly: service.ts (sole public),
      db.ts (createUserClient(jwt)), types.ts (module-internal)
    - Per-request JWT Supabase client (ARCH-03) — no SUPABASE_SERVICE_KEY anywhere
      under coach/invitations/
    - 3-retry on PG 23505 (unique_violation on code) before throwing
    - Idempotent revoke: UPDATE WHERE revoked_at IS NULL — second call no-ops with
      `.maybeSingle()` returning null, treated as success
    - Defense-in-depth ownership check: `.eq('coach_id', coachId)` even though RLS
      already enforces (T-25-tampering mitigation)
key-files:
  created:
    - backend/api/src/coach/invitations/types.ts
    - backend/api/src/coach/invitations/db.ts
    - backend/api/src/coach/invitations/service.ts
    - backend/api/test/coach/invitations.spec.ts
  modified:
    - backend/api/src/app.ts (+2 lines: import + mount)
decisions:
  - Inlined `computeInvitationStatus` in db.ts (instead of importing from
    `@ziko/coach-sdk`) to preserve the backend's deliberate no-workspace-dep
    convention. The function is pure and identical byte-for-byte to the SDK source.
    Documented inline with a NOTE comment so future maintainers keep them in lockstep.
  - Mirrored the auth-only middleware chain from identity/service.ts (no creditCheck
    here either — invitations are non-AI ops with no credit cost; matches identity's
    D-08 footnote rationale).
  - UUID regex validation in DELETE handler — defense in depth on top of RLS, gives
    a clean 400 instead of a misleading 500 for malformed ids.
metrics:
  duration_seconds: ~604
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  commits: 2
  completed_at: 2026-05-17T13:08:09Z
---

# Phase 25 Plan 02: Backend coach/invitations bounded module Summary

Shipped the coach-owned invitation lifecycle backend: generate / list / revoke. Three module files plus a single mount-point addition in `app.ts`, exactly mirroring the `coach/identity/` bounded-module shape (ARCH-01/02/03). Two atomic commits, typecheck clean, all three routes verified to gate on `authMiddleware` via mocked `app.request()`.

## What shipped

### 1. `backend/api/src/coach/invitations/types.ts` — module-internal types

Five exported types, none of which leak to consumers outside the folder:
- `GenerateCodePayload` — `{ expires_at: string | null }` (POST body shape)
- `ListStatusFilter` — `'active' | 'used' | 'expired' | 'revoked' | 'all'`
- `CoachInvitationRow` — DB row shape mirroring migration 035 columns
- `ComputedInvitationStatus` — `'active' | 'used' | 'expired' | 'revoked'` (no `'all'`)

Public types for cross-package consumption live in `@ziko/coach-sdk` (plan 01) — `CoachInvitation`, `ComputedStatus`, `CoachInvitationWithStatus`.

### 2. `backend/api/src/coach/invitations/db.ts` — DB layer

- `createUserClient(jwt)` — clones the canonical pattern from `coach/identity/db.ts` verbatim. Reads `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`, attaches `Authorization: Bearer ${jwt}` so RLS sees `auth.uid()` as the calling coach.
- `generateCode` — `customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789', 6)` exactly matches the DB `CHECK '^[A-Z2-9]{6}$'` (Phase 22 D-06).
- `insertInvitation(jwt, coachId, payload)` — for-loop bounded by `MAX_GENERATE_RETRIES = 3`: regenerates code only on PG `error.code === '23505'`; any other error throws immediately; after 3 unique-violation attempts throws with a descriptive ops-alertable message.
- `listInvitations(jwt, coachId, filter)` — SELECT WHERE `coach_id = userId` ORDER BY `created_at DESC`. RLS would enforce ownership too — the explicit `eq` is belt + suspenders. Computes status in JS via `computeInvitationStatus()` (per Phase 22 D-01 timestamp-predicate rule — no DB `status` column). Filters by status in-memory unless filter === `'all'`.
- `revokeInvitation(jwt, coachId, id)` — idempotent. `UPDATE ... SET revoked_at = now() WHERE id = :id AND coach_id = :coachId AND revoked_at IS NULL`. Uses `.maybeSingle()` so a no-op match (already revoked, or owned by another coach) returns `data === null`, which is then returned as `{ id, revoked_at: null }` — caller can treat as success.
- `computeInvitationStatus` — pure helper inlined here instead of imported from `@ziko/coach-sdk` (see decision in frontmatter); identical to the SDK source.

### 3. `backend/api/src/coach/invitations/service.ts` — Hono sub-router (public entry)

- `invitationsRouter.use('*', authMiddleware)` — every route requires JWT.
- `POST /` — light validation (`expires_at` must be null or a parseable ISOString); 400 on malformed JSON or invalid date; 201 + new row on success.
- `GET /` — `?status=active|used|expired|revoked|all` validated against allowlist; 400 on unknown filter; default = `'active'`.
- `DELETE /:id` — UUID regex check before DB call (defense in depth); 400 on malformed id; 200 `{ ok: true }` on success and on already-revoked.
- All handlers wrap db calls in `try/catch (err: any)` → `c.json({ error: err.message }, 500)` matching identity/service.ts pattern.

### 4. `backend/api/src/app.ts` — mount point (+2 lines)

```ts
import { invitationsRouter } from './coach/invitations/service.js';
...
app.route('/coach/invitations', invitationsRouter);
```

Placed immediately after the identity equivalents per the plan's "do not pre-add clientsRouter" instruction.

### 5. `backend/api/test/coach/invitations.spec.ts` — TDD stub (21 todos)

18 unit-contract todos for db.ts + 9 route-handler todos for service.ts (total 21 todos). Integration tests will be written in plan 06 against this contract surface.

## Verification results

### Static

- `npx tsc --noEmit` in `backend/api` → exit 0 (no type errors).
- `! grep -rE "SERVICE_KEY|SERVICE_ROLE" backend/api/src/coach/invitations/` → no matches. ARCH-02 holds.
- `grep -q "import { invitationsRouter } from './coach/invitations/service.js'" backend/api/src/app.ts` → found at line 14.
- `grep -q "app.route('/coach/invitations', invitationsRouter)" backend/api/src/app.ts` → found at line 56.

### Mock-request smoke test (via `app.request()` with dummy env vars)

| Request                                                      | Status | Notes                                  |
|--------------------------------------------------------------|--------|----------------------------------------|
| `GET /coach/invitations` (no auth)                           | 401    | authMiddleware engages                 |
| `POST /coach/invitations` (no auth)                          | 401    | authMiddleware engages                 |
| `DELETE /coach/invitations/<valid-uuid>` (no auth)           | 401    | authMiddleware engages before UUID check |
| `GET /health` (no auth)                                      | 200    | Untouched control path                 |

Live `POST` / `GET` / `DELETE` against a real Supabase project deferred to plan 06's integration suite (no `.env.local` in worktree, by design).

### Test stub collection

`backend/api/test/coach/invitations.spec.ts` is committed. Vitest fails to collect it (and the predecessor `identity.spec.ts`) in this worktree because `test/setup.ts` requires `.env.test` to be present — this is a pre-existing infra concern not introduced by plan 02 (matches the predecessor's behavior exactly). Plan 06 will fill `.env.test` and exercise the todos.

## Deviations from Plan

### Auto-fixed: 1 deviation

**1. [Rule 3 - Blocking] Inlined `computeInvitationStatus` instead of importing from `@ziko/coach-sdk`**

- **Found during:** Task 1 prep (reading backend/api/package.json)
- **Issue:** The plan instructs `import { computeInvitationStatus } from '@ziko/coach-sdk';`, but `backend/api/package.json` deliberately omits any `@ziko/*` workspace dependency to keep the Vercel build self-contained. The existing comment in `backend/api/src/tools/registry.ts` documents this convention: "Local copy of AITool type (from @ziko/plugin-sdk) to avoid workspace dep on Vercel". `packages/coach-sdk/dist/` is also not built in this worktree, which would have caused a runtime resolution failure if the import were left as-is.
- **Fix:** Inlined the 4-line `computeInvitationStatus` function in `db.ts`. The function is pure (no I/O) and byte-equivalent to the SDK source. Added a NOTE comment at the top of db.ts and above the inline function to flag the lockstep requirement for future maintainers.
- **Files modified:** `backend/api/src/coach/invitations/db.ts`
- **Commit:** `dd0c42d`
- **Why not Rule 4 (architectural):** This is a one-file, one-function workaround that preserves an existing project-wide convention. Not a structural change to the module shape or deps graph. Plan 01's SUMMARY also did not modify `backend/api/package.json` to add the workspace dep, so this is consistent with that decision.

### Other notes (not deviations)

- Added a `ComputedInvitationStatus` type to `types.ts` to keep the inlined function strictly typed without re-deriving from `@ziko/coach-sdk`.
- `_lastError` variable retained even though TypeScript's strict mode would normally flag it — used in the final throw message after 3 retries.

## Threat surface scan

No new security-relevant surface beyond what the plan's `<threat_model>` covered. All four STRIDE entries are addressed:

- **T-25-05 (Elevation):** ARCH-02 grep passes — no SERVICE_KEY/SERVICE_ROLE in `coach/invitations/`. createUserClient(jwt) only.
- **T-25-08 (Tampering, code collision):** `MAX_GENERATE_RETRIES = 3` loop over PG `23505`, descriptive throw on exhaustion.
- **Auth bypass (Spoofing):** `invitationsRouter.use('*', authMiddleware)` confirmed by mock 401s on all three routes.
- **Input fuzzing (DELETE /:id):** UUID regex check returns 400 before any DB call.
- **Cross-coach revoke:** `eq('coach_id', coachId)` belt + suspenders on top of RLS.

No `threat_flag:` entries to report.

## Known Stubs

None. All three handlers wire to real db.ts functions; no placeholder data, no hardcoded `[]` / `null` / "coming soon" strings. The TDD spec file contains `it.todo()` entries — these are intentional plan-06 hooks, not stubs in the rendering sense.

## TDD Gate Compliance

This plan is type=execute (not type=tdd). Both tasks used `tdd="true"` at the task level — the test stub was committed in the same commit as the implementation in Task 1 (single atomic feat commit covering both code and stub), and Task 2 extended the same stub file. No RED/GREEN/REFACTOR gate sequencing required for type=execute.

## Deferred Issues

1. **Live integration tests** — moved to plan 06 by design. The `.env.test` infrastructure required by `test/setup.ts` is not provisioned in this worktree (same gate that blocks `identity.spec.ts` from collecting).
2. **Live HTTP smoke test against a running backend** — `npm run dev` requires `.env.local`, not present in worktree. Replaced with `app.request()`-based mock smoke test which exercises the full Hono routing + authMiddleware path.

## Self-Check: PASSED

- `backend/api/src/coach/invitations/types.ts` — FOUND
- `backend/api/src/coach/invitations/db.ts` — FOUND
- `backend/api/src/coach/invitations/service.ts` — FOUND
- `backend/api/test/coach/invitations.spec.ts` — FOUND
- `backend/api/src/app.ts` — FOUND (modified, import + mount at lines 14 + 56)
- Commit `dd0c42d` (Task 1 — db + types + spec stub) — FOUND
- Commit `fed7598` (Task 2 — service + app.ts mount) — FOUND
- `npx tsc --noEmit` in `backend/api` — exits 0
- ARCH-02 grep — passes (no SERVICE_KEY/SERVICE_ROLE under `coach/invitations/`)
- Mock smoke test — all three routes 401 without auth, /health 200
