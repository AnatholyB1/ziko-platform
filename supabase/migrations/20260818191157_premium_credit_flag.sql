-- ============================================================
-- 20260816 — Premium credit-gate alignment: lifetime-premium
-- provenance flag + activation flag (Phase 4, v1.16, CRED-04/CRED-05)
--
-- Two additive statements, no DDL beyond one new column, no new policy or
-- privilege statement of any kind — app_config's existing deny-all RLS
-- posture (Phase 1) covers the new row for free, exactly like
-- waitlist_reveal_threshold and waitlist_retention_years before it.
--
-- Behavior change note: 026_ai_credits.sql:181-182's comment
-- ("Enables premium bypass in Phase 18") becomes stale prose the
-- moment this phase ships — per house rule, that migration is not
-- edited. As of this migration, `tier='premium'` alone no longer
-- unconditionally bypasses the AI credit gate; see
-- backend/api/src/middleware/creditGate.ts, which now reads the
-- `premium_credit_cap_enabled` flag below to decide, per request,
-- whether premium and free users run the identical balance-checked
-- path. The flag ships false — this migration changes no observable
-- behavior on its own; Phase 6 owns flipping it in production.
-- ============================================================

-- 1. Lifetime-premium provenance flag (CRED-04).
--    Nothing in this milestone reads or writes this column — it exists
--    so a future subscription-lapse downgrade (v1.12 DA Coach's planned
--    paid tier reusing tier='premium') can never silently strip a
--    founder's lifetime benefit (D-04). The future redemption flow that
--    sets tier='premium' for a claimed founder spot also sets this true.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_lifetime_premium BOOLEAN NOT NULL DEFAULT false;

-- 2. Activation flag (CRED-05), reusing Phase 1's app_config table.
--    Value literal is a single-quoted `false` with no inner double
--    quotes so Postgres parses it as JSON and stores a JSONB boolean —
--    matching the existing waitlist_reveal_threshold ('30', a JSONB
--    number) and waitlist_retention_years ('3', a JSONB number) rows.
--    A bare unquoted `false` is a SQL type error; a double-quoted
--    "false" stores a JSON string the gate's `=== true` check would
--    never accept. Read via a direct service-role SELECT in
--    creditGate.ts, re-evaluated on every gated request — no
--    in-process cache, no env var, no build-time constant. Shipped
--    false; activation is Phase 6's job via a plain UPDATE, never a
--    redeploy.
INSERT INTO public.app_config (key, value)
VALUES ('premium_credit_cap_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
