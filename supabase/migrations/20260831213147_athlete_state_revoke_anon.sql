-- ============================================================
-- Phase 42 — Decision-System Foundation follow-up (D-06/D-07 consistency)
-- Extends the write-path lockdown in 20260831120200_athlete_decisions_rpc.sql
-- to the `anon` role.
--
-- Why: that migration revoked INSERT/UPDATE/DELETE on athlete_state and
-- athlete_decisions from `authenticated` and `service_role`, but omitted
-- `anon`. `anon` does not have BYPASSRLS (verified live: pg_roles.rolbypassrls
-- = false), so with RLS enabled and zero write policies on either table this
-- was never an exploitable hole — Postgres denies any command with no
-- matching policy by default for non-bypassing roles. But the migration's
-- own stated rationale for revoking from `authenticated` (which also lacks
-- BYPASSRLS) was explicit defense-in-depth ("either layer alone would be
-- insufficient" — RESEARCH.md's threat model). Leaving `anon` unrevoked is
-- an inconsistency with that stated posture, not a live vulnerability: fixed
-- here for uniformity across all three PostgREST-facing roles, per D-07's
-- "no carve-out" rule applied strictly.
-- ============================================================

REVOKE INSERT, UPDATE, DELETE ON public.athlete_state FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.athlete_decisions FROM anon;
