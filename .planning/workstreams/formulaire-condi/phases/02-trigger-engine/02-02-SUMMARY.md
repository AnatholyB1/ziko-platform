---
phase: 02-trigger-engine
plan: "02"
subsystem: formulaire-condi
tags: [forms, triggers, rpc, supabase, hono]
dependency_graph:
  requires:
    - formulaire-condi/01-db-schema-backend-api/01-01 # coach_forms + form_instances tables
    - formulaire-condi/01-db-schema-backend-api/01-02 # formsRouter mounted at /forms
    - formulaire-condi/02-trigger-engine/02-01       # create_form_instances_for_trigger RPC
  provides:
    - TRIGGER-01: first-contact hook fires after invitation redemption
    - TRIGGER-04: POST /forms/coach/forms/:id/send manual send endpoint
  affects:
    - backend/api/src/coach/clients/service.ts
    - backend/api/src/routes/forms.ts
tech_stack:
  added: []
  patterns:
    - fire-and-forget RPC via .then() (no await) to avoid blocking the response envelope
    - supabase.rpc() per-athlete loop with sequential awaits and skipped-count tracking
key_files:
  modified:
    - backend/api/src/coach/clients/service.ts
    - backend/api/src/routes/forms.ts
decisions:
  - Used a module-scope adminClient (autoRefreshToken: false, persistSession: false) in service.ts to call the SECURITY DEFINER RPC without the athlete's JWT context
  - fire-and-forget pattern with .then() error logging preserves the constant-time envelope for /links/redeem
  - /send iterates athlete_ids sequentially (not Promise.all) to avoid overwhelming the DB with parallel RPC calls on large lists
metrics:
  duration: 8m
  completed: "2026-05-26T12:34:29Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 02 Plan 02: Trigger Wiring — TRIGGER-01 first-contact hook + TRIGGER-04 /send route Summary

Wire two trigger points to the `create_form_instances_for_trigger` Supabase RPC: a fire-and-forget first-contact hook injected into the invitation redemption flow, and a new `POST /coach/forms/:id/send` endpoint for manual dispatch.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | TRIGGER-01 — first-contact hook in service.ts | 529db45 | backend/api/src/coach/clients/service.ts |
| 2 | TRIGGER-04 — POST /coach/forms/:id/send in forms.ts | 529db45 | backend/api/src/routes/forms.ts |

## What Was Built

### TRIGGER-01 — First-Contact Hook (`service.ts`)

Added `createClient` import and a module-scope `adminClient` (publishable key, sessions disabled) to `backend/api/src/coach/clients/service.ts`. In the `POST /links/redeem` handler, immediately after `redeemInvitation` returns `ok: true`, a non-blocking RPC call fires:

```ts
adminClient
  .rpc('create_form_instances_for_trigger', {
    p_trigger_type: 'first_contact',
    p_athlete_id: athleteId,
    p_coach_id: coachId,
  })
  .then(({ error }) => {
    if (error) console.warn('[forms/first_contact trigger]', error.message);
  });
```

The call is fire-and-forget — no `await`, no blocking the constant-time response envelope. A failure only logs a warning; redemption always succeeds.

### TRIGGER-04 — Manual Send Route (`forms.ts`)

Added `POST /coach/forms/:id/send` to `backend/api/src/routes/forms.ts` after the existing `/publish` handler. The route:

1. Validates `athlete_ids` array: non-empty, max 100 entries, each a valid UUID (regex)
2. Fetches form ownership via `.eq('coach_id', userId)` — returns 404 if not found or not owned
3. Checks `form.status === 'active'` — returns 409 if not
4. Iterates `athlete_ids` sequentially, calling `create_form_instances_for_trigger('manual', athleteId, userId)` for each
5. Returns `{ sent: totalCount, skipped: athlete_ids.length - totalCount }` where `skipped` reflects ON CONFLICT DO NOTHING silently deduped instances

## Verification

- `tsc --noEmit`: zero errors
- `grep -c "create_form_instances_for_trigger" backend/api/src/coach/clients/service.ts` → 1 match
- `grep -c "coach/forms/:id/send" backend/api/src/routes/forms.ts` → 2 matches (registration + log prefix)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

Both threat mitigations from the plan's threat model are implemented:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-02-04 | UUID regex validates every entry in `athlete_ids` before passing to RPC |
| T-02-05 | `.eq('coach_id', userId)` ownership gate before any RPC calls |
| T-02-06 | `athlete_ids.length > 100` returns 400 |
| T-02-07 | Hook failure is console.warn only; redemption succeeds regardless |

No new threat surface introduced beyond what was planned.

## Self-Check: PASSED

- `backend/api/src/coach/clients/service.ts` — exists and contains TRIGGER-01 hook
- `backend/api/src/routes/forms.ts` — exists and contains /send route
- Commit `529db45` — verified in git log
