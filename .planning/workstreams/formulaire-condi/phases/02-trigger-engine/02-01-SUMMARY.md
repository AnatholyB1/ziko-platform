---
phase: 02-trigger-engine
plan: "01"
subsystem: formulaire-condi
tags: [sql, migration, security-definer, plpgsql, rpc]
dependency_graph:
  requires:
    - "055_forms_schema.sql — coach_forms, form_instances tables + form_instances_no_dup_pending index"
  provides:
    - "public.create_form_instances_for_trigger — SECURITY DEFINER RPC callable from Hono without JWT"
  affects:
    - "form_instances — rows inserted by this function"
    - "02-02 through 02-04 — all trigger handler plans call this function via supabase.rpc()"
tech_stack:
  added: []
  patterns:
    - "SECURITY DEFINER plpgsql function with SET search_path = public"
    - "ON CONFLICT ON CONSTRAINT <named_index> DO NOTHING for idempotent upsert"
    - "GET DIAGNOSTICS ROW_COUNT for per-iteration insert counting"
    - "CASE expression inside WHERE clause for type-specific filter branches"
key_files:
  created:
    - supabase/migrations/058_form_trigger_engine.sql
  modified: []
decisions:
  - "Used CASE expression inside WHERE clause (not separate IF branches) to keep the query as a single scan over coach_forms — avoids N separate queries per trigger type"
  - "Accumulated ROW_COUNT per loop iteration rather than using a final COUNT(*) to correctly count only rows that bypassed the ON CONFLICT guard"
  - "RAISE WARNING before RAISE re-raise — logs error with contextual parameters (trigger_type, athlete_id, coach_id) without suppressing the exception"
  - "Grants to both authenticated and service_role — authenticated covers supabase.rpc() calls with a user JWT, service_role covers direct Hono backend calls without a JWT"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-26"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 02 Plan 01: Form Trigger Engine — SECURITY DEFINER Function Summary

## One-liner

SECURITY DEFINER plpgsql function `create_form_instances_for_trigger` added as migration 058, enabling Hono to create form_instances rows without a user JWT by bypassing RLS while enforcing coach ownership and deduplication internally.

## What Was Built

Migration `supabase/migrations/058_form_trigger_engine.sql` adds:

**`public.create_form_instances_for_trigger(p_trigger_type text, p_athlete_id uuid, p_coach_id uuid, p_n_sessions integer DEFAULT NULL, p_date text DEFAULT NULL) RETURNS integer`**

The function is the shared execution engine for all 4 trigger types (Plans 02-02 through 02-04 call it). It:

1. Queries `coach_forms` for all active forms owned by `p_coach_id` matching `p_trigger_type`, with type-specific sub-filters:
   - `after_n_sessions`: also requires `(trigger_config->>'n')::integer = p_n_sessions`
   - `fixed_date`: also requires `trigger_config->>'date' <= p_date` (handles past-due dates)
   - `first_contact` / `manual`: no additional filter

2. For each matching form, inserts a `pending` row into `form_instances` with `ON CONFLICT ON CONSTRAINT form_instances_no_dup_pending DO NOTHING` — the named partial UNIQUE index from migration 055 acts as a hard deduplication guard (TRIGGER-05 / D-09).

3. Returns total rows actually inserted (0 on full collision, N for N new assignments).

4. Wraps in `BEGIN / EXCEPTION WHEN OTHERS` block: logs `RAISE WARNING` with context parameters then re-raises so callers see failures.

Permissions: `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated`, `GRANT EXECUTE TO service_role`.

## Why SECURITY DEFINER

The existing RLS policy `form_instances_insert` requires `auth.uid() = coach_id`. Hono trigger handlers run without a user JWT (they use the publishable key or service role). SECURITY DEFINER lets the function run as its owner (postgres role), bypassing RLS, while enforcing equivalent business rules internally: `coach_id = p_coach_id` prevents cross-coach escalation (T-02-01), and the UNIQUE index prevents duplicate pending instances (T-02-02).

## Tasks Completed

| Task | Name | Files | Status |
|------|------|-------|--------|
| 1 | Write migration 058 — SECURITY DEFINER function | supabase/migrations/058_form_trigger_engine.sql | Done |

## Checkpoint Pending

The plan includes a `checkpoint:human-verify` gate (Task 2) requiring `supabase db push` to apply the migration to the remote project and confirm the function is visible in Supabase Dashboard → Database → Functions. This checkpoint is blocking for Wave 2.

## Deviations from Plan

None — plan executed exactly as written.

The SQL provided in the prompt instructions matched the plan spec. The UNIQUE constraint name `form_instances_no_dup_pending` was confirmed in migration 055 before writing the file.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. The function is internal to the database. Threat mitigations T-02-01 and T-02-02 from the plan's threat register are implemented:
- T-02-01: `WHERE coach_id = p_coach_id` in the SELECT guards against cross-coach form insertion
- T-02-02: `ON CONFLICT ON CONSTRAINT form_instances_no_dup_pending DO NOTHING` implements the hard deduplication guard

## Known Stubs

None.

## Self-Check

- [x] `supabase/migrations/058_form_trigger_engine.sql` exists
- [x] `SECURITY DEFINER` present in function definition (line 47)
- [x] `ON CONFLICT ON CONSTRAINT form_instances_no_dup_pending DO NOTHING` present (line 79)
- [x] `trigger_config->>'type' = p_trigger_type` present in WHERE clause (line 62)
- [x] GRANT EXECUTE to `authenticated` and `service_role` present
- [x] All 4 trigger types handled: `first_contact` (ELSE TRUE), `after_n_sessions` (n filter), `fixed_date` (date filter), `manual` (ELSE TRUE)
- [x] Function signature matches plan exactly

## Self-Check: PASSED
