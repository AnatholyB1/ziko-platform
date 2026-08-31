# Phase 42: Decision-System Foundation - Research

**Researched:** 2026-08-31
**Domain:** Supabase Postgres schema/RLS/RPC design — compact current-state table + append-only decision journal, with DB-level write lockdown stricter than any existing precedent in this codebase
**Confidence:** HIGH

## Summary

This phase is a pure backend/data-model foundation: two tables (`athlete_state`, `athlete_decisions`), one `SECURITY DEFINER` RPC (`record_athlete_decision()`), RLS SELECT-only policies, and DB-level GRANT lockdown. There is zero application code, zero AI calls, zero UI. The project-wide research (`.planning/research/{SUMMARY,ARCHITECTURE,STACK,PITFALLS}.md`) already drafted the full schema and RPC body; this research's job is narrower and sharper: (1) apply the four CONTEXT.md decisions (D-01–D-07) on top of that draft, (2) verify the exact SQL/GRANT syntax against the codebase's own most recent precedent rather than the older draft, and (3) resolve — with verified evidence, not a guess — whether revoking table-level GRANTs from `service_role` is even meaningful given Supabase's `service_role` carries `BYPASSRLS`.

The central technical question (D-06/D-07's GRANT-revocation strategy) is answered with certainty: **`BYPASSRLS` and table-level `GRANT`/`REVOKE` are two independent Postgres authorization layers.** `BYPASSRLS` (which `service_role` holds) only exempts a role from *row-level security policy evaluation* — it has no effect on the ordinary SQL privilege system. A role must still pass the `GRANT`-based privilege check before Postgres even looks at RLS policies. This means `REVOKE INSERT ON athlete_decisions FROM service_role` **will** block a service-role-authenticated client from inserting, exactly as D-06 intends, and this is not a novel technique — it is verified live in this exact codebase's `20260822120000_gamification_economy_rpc.sql` (revokes from `authenticated`) and, more importantly, `20260818190601_premium_credit_grant.sql`'s header comment, which documents that **this specific Supabase project's `ALTER DEFAULT PRIVILEGES` on schema `public` auto-grants both table CRUD and function `EXECUTE` to `anon`/`authenticated`/`service_role` at creation time** — "verified live." This is the load-bearing fact for the whole phase: every new table and the new RPC needs an *explicit* `REVOKE` naming each role by name (a bare `REVOKE ... FROM PUBLIC` is insufficient — proven by this project's own prior incident, documented in `20260813182644_waitlist_founder_offer.sql`).

**Primary recommendation:** Model `athlete_state`/`athlete_decisions`/`record_athlete_decision()` directly on `20260818190601_premium_credit_grant.sql` (the most recent, most rigorous local precedent — not the older `026_ai_credits.sql`, which lacks the RPC-level `REVOKE EXECUTE` this project has since learned it needs), apply D-01–D-07 on top, and add the stricter table-level `REVOKE ... FROM authenticated, service_role` that no existing precedent in this codebase does yet (existing precedents only revoke from `authenticated`) — this is a deliberately new, stricter bar for this table, consistent with D-06/D-07's explicit rationale that `level`/`readiness` are security-relevant.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01/D-02 (readiness):** `readiness` is a top-level `TEXT` column on `athlete_state`, not JSONB-nested, not numeric. `CHECK (readiness IN ('fragile','building','ready'))`, `DEFAULT 'fragile'` (fail-safe/cautious default).
- **D-03 (track cut):** The `track TEXT DEFAULT 'general'` column from the original `research/ARCHITECTURE.md` draft is **removed entirely** from `athlete_state`. Out of scope — conflicts with SEED-001 deferral (factions/tracks RPG layer).
- **D-04/D-05 (rolling-summary scope):** Phase 42 ships the `rolling_summary TEXT` column on `athlete_state` plus a **documented read convention** (always read `rolling_summary` + last N raw `athlete_decisions` rows verbatim; never replay the full journal). Phase 42 does **NOT** ship a callable `fetchAthleteContext()`/`fetchWeeklyReviewContext()` helper function — that is Phase 44's job. Exact numeric caps (token/char budget for `rolling_summary`, N for the raw-decision window) are Claude's discretion, informed by `research/STACK.md`'s ~300–500 token / last 3–4 decisions starting point, validated conceptually against a synthetic 12-month-tenure athlete.
- **D-06 (DB-level write lockdown):** Both `athlete_state` and `athlete_decisions` get `REVOKE UPDATE` (on `athlete_state`) / `REVOKE INSERT` (on `athlete_decisions`) from **both** `authenticated` AND `service_role`. `record_athlete_decision()` — `SECURITY DEFINER`, owned by a privileged role — is the *only* code path capable of writing either table, even from backend code holding the service-role key.
- **D-07 (no exceptions):** This lockdown applies uniformly to both tables — no carve-out for a future manual/admin correction tool. A future admin-correction path must call `record_athlete_decision()` too (e.g., `source = 'manual_admin'`, already in the drafted enum), never bypass it.

### Claude's Discretion

- Exact `rolling_summary` token/char cap and exact N for the raw-decision window (D-05) — pick now, validate conceptually against synthetic 12-month athlete data (see Rolling-Summary Budget section below).
- Exact migration file names/timestamps, and whether the two tables + RPC land in one migration file or split across two-plus-RPC files — follow existing repo convention (never edit an existing migration; `YYYYMMDDHHMMSS_description.sql` format).
- `decision_type` / `source` CHECK-constraint enum membership — the drafted lists (`decision_type`: `onboarding_profile`, `weekly_focus`, `level_change`, `reward_grant`, `program_created`, `goal_created`; `source`: `weekly_review_cron`, `onboarding_tool`, `app_open_fallback`, `manual_admin`) are a reasonable starting point; adjustable later via a new migration `ALTER`.
- Whether `athlete_state`/`athlete_decisions` migrations get `backend/api/test/rls/` integration test coverage now vs. deferred to Phase 43 (a real caller). See Validation Architecture section — this research recommends adding coverage now, mirroring `premium-grant-rpc.spec.ts`.

### Deferred Ideas (OUT OF SCOPE)

- **`track` column / multi-domain state axis** — cut from Phase 42 (D-03). If a real need emerges before the SEED-001 RPG/factions milestone, it re-enters as its own migration + discussion then.
- **Exact rolling-summary/recent-window numeric caps as an empirically load-tested value** — Phase 42 picks a reasoned starting number (see below); an actual token-count load test against real production data is not possible yet (zero rows ship in this phase) and is properly Phase 44's job once real decisions exist.
- Any tool registration (`assess_profile`, `create_goal`, `create_reward`, `create_program`) — Phases 43–45.
- The weekly-review compaction logic that writes `rolling_summary` — Phase 44.
- `athlete_state` as 7th context query / system-prompt injection — Phase 47 (OPS-01).
- `PluginManifest.minLevel` / `PluginLoader` gating — Phase 46.
- Populating any real row — first writer is Phase 43's onboarding tool. Phase 42 ships schema/RPC/RLS only, with zero rows.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | `athlete_state` maintains a compact current state per athlete (niveau, palier, focus actuel, readiness) — always current, never a growing blob | Schema section below: single-row-per-athlete `PRIMARY KEY (user_id)` table, all fields mutated in place by the RPC, never appended |
| FOUND-02 | `athlete_decisions` append-only journal — every AI decision traced with rationale + real data it was based on | Schema section: `evidence JSONB NOT NULL` (mandatory, not nullable — stronger than the original draft's `DEFAULT '{}'`), `rationale TEXT`, immutable via lockdown |
| FOUND-03 | All writes to `athlete_state` go through one server path that re-validates against real activity data | `record_athlete_decision()` RPC section — the RPC is the sole writer; re-validation itself is a Phase 43+ tool-executor responsibility (documented boundary below) |
| FOUND-04 | An athlete reads only their own state/journal (RLS); no direct client write | RLS section: SELECT-only policies, zero INSERT/UPDATE/DELETE policies at all |
| FOUND-05 | Journal stays bounded in AI context even after months of tenure — compact summary + small recent window, never full replay | Rolling-Summary Budget section: concrete numeric recommendation + synthetic-load reasoning |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Current-state storage (`athlete_state`) | Database / Storage | — | Single source of truth; must be queryable without replaying history |
| Decision audit trail (`athlete_decisions`) | Database / Storage | — | Append-only compliance/debugging log, never the "what happened" source |
| Write authorization (RPC gate) | Database / Storage | — | `SECURITY DEFINER` RPC + `REVOKE` is a DB-enforced invariant, deliberately not left to application-layer trust (per D-06's explicit rationale) |
| Server-side re-validation against real activity | API / Backend | — | Out of Phase 42's build scope (no caller yet) but the RPC's `p_evidence` parameter is the contract point Phase 43+ tool executors must fill correctly — documented here as a boundary, not implemented |
| RLS read authorization | Database / Storage | — | `auth.uid() = user_id` SELECT-only policy, enforced at the Postgres layer regardless of API bugs |
| Bounded-context read convention | API / Backend (future, Phase 44) | Database / Storage (rolling_summary column) | The column lives in the DB now; the *read discipline* (summary + N-window, never full table) is an API-layer convention documented here for Phase 44 to implement |

No Browser/Client or CDN tier involvement — this phase has zero client-facing surface by design (per CONTEXT.md's explicit phase boundary: "no UI, no athlete-facing behavior, no tool registration, no consuming caller yet").

## Standard Stack

### Core

No new libraries. This phase is pure Postgres DDL/DML via Supabase migrations — no new npm packages, no new backend module code.

| Component | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Postgres | existing project version | Table storage, RLS, RPC | Already the platform's only datastore |
| `plpgsql` `SECURITY DEFINER` functions | existing Postgres feature | Single write-gate RPC | Already the codebase's established pattern for atomic read-lock-write-log (`deduct_ai_credits`, `grant_premium_credits`, `award_xp`) |
| `gen_random_uuid()` (pgcrypto) | already installed (`supabase/migrations` confirms `uuid-ossp`, `pgcrypto`, `unaccent` — no new extension needed) | PK generation for `athlete_decisions.id` | Matches `026_ai_credits.sql`'s `ai_credit_transactions.id` pattern |

### Supporting

None — this phase adds no runtime dependency, no test-framework change. `vitest` + the existing `backend/api/test/rls/fixtures.ts` scaffold covers everything needed for verification.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `TEXT` + `CHECK (... IN (...))` for `readiness`/`decision_type`/`source` enums | Postgres native `ENUM` type | `CHECK` constraints are the exact pattern every existing table in this codebase uses (`user_ai_credits.status`-style columns, `ai_credit_transactions.type`); native `ENUM` requires `ALTER TYPE ... ADD VALUE` for changes (can't run in a transaction with other DDL in older Postgres, awkward for "add a new source value later" per Claude's Discretion) — `CHECK` is strictly easier to extend via a follow-up migration, matching this project's own convention |
| DB-level `REVOKE` lockdown (D-06/D-07) | RLS-only lockdown (`FOR ALL USING (false)` policy, or simply omitting write policies) | Omitting write policies is what the original `research/ARCHITECTURE.md` draft did — sufficient to block the **`authenticated`** role (RLS applies to it), but **does nothing to block `service_role`**, which has `BYPASSRLS` and skips RLS entirely regardless of policies present or absent. D-06 explicitly requires blocking `service_role` too (even backend code holding the service key must go through the RPC) — RLS alone cannot deliver that; only table-level `REVOKE` can. This is precisely why the phase needs the GRANT-revocation approach, not just "the usual RLS pattern." |

**Installation:**
```bash
# Nothing to install. Verify existing Postgres extensions already present
# (no migration needed to confirm — already true per prior research):
# uuid-ossp, pgcrypto, unaccent — no vector extension, none needed here.
```

**Version verification:** Not applicable — no package versions to verify. Supabase project version is queried via `supabase migration list` or the dashboard if ever needed; no action required for this phase.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages (no `npm install` of any kind). Skipping the Package Legitimacy Gate per its own scope condition.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  FUTURE CALLERS (not built in this phase — shown for context only)   │
│  Phase 43 onboarding tool · Phase 44 weekly-review cron ·             │
│  Phase 45 reward tool · Phase 46 gating reader (SELECT only)          │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ calls (future)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SUPABASE POSTGRES — everything Phase 42 actually ships               │
│                                                                        │
│  record_athlete_decision(p_user_id, p_decision_type, p_week_of,      │
│    p_summary, p_rationale, p_evidence, p_outcome, p_source,          │
│    p_state_patch)                                                    │
│  SECURITY DEFINER · owned by migration-runner role (bypasses table    │
│  GRANTs below) · EXECUTE revoked from PUBLIC/anon/authenticated,      │
│  granted only to service_role                                        │
│         │                                                             │
│         │ single transaction: insert log row, then patch state row   │
│         ▼                                  ▼                          │
│  ┌─────────────────────────┐    ┌─────────────────────────────────┐  │
│  │ athlete_decisions        │    │ athlete_state                    │  │
│  │ (append-only journal)    │    │ (PK=user_id, one row/athlete)    │  │
│  │ INSERT revoked from      │    │ UPDATE revoked from              │  │
│  │ authenticated+service_role│   │ authenticated+service_role       │  │
│  │ RLS: SELECT-own only     │    │ RLS: SELECT-own only             │  │
│  └─────────────────────────┘    └─────────────────────────────────┘  │
│         ▲                                  ▲                          │
│         │ SELECT (RLS: auth.uid()=user_id) │                          │
└─────────┼──────────────────────────────────┼──────────────────────────┘
          │                                  │
   Athlete's own client (mobile, direct Supabase read) — the ONLY
   client-facing surface this phase ships. No write path exists for
   any client, direct or via service key, other than the RPC above.
```

A reader can trace the entire primary use case (a decision gets recorded) end-to-end: a future privileged caller (not built here) calls the RPC → RPC inserts the audit row → RPC patches the state row → both in one transaction → athlete can later read both rows via RLS-scoped SELECT, no other write path exists anywhere in the diagram.

### Recommended Project Structure

```
supabase/migrations/
├── 20260831HHMMSS_athlete_state.sql       # table + RLS SELECT policy + updated_at trigger
├── 20260831HHMMSS_athlete_decisions.sql   # table + RLS SELECT policy + idempotency index
└── 20260831HHMMSS_athlete_decisions_rpc.sql  # record_athlete_decision() + all REVOKE/GRANT lockdown

backend/api/test/rls/
└── athlete-state.spec.ts   # RUN_DB-gated: RLS SELECT-own/deny-other, INSERT/UPDATE blocked
                             #   for both authenticated AND admin(service_role) clients,
                             #   RPC happy-path + idempotency, mirrors premium-grant-rpc.spec.ts
```

Three migration files (not one) is the recommended split — matches `research/ARCHITECTURE.md`'s own build-order table (`<ts>_athlete_state.sql`, `<ts>_athlete_decisions.sql`, `<ts>_athlete_decisions_rpc.sql`) and lets a future `ALTER` to just the RPC (e.g., adding a `decision_type` value) land as a fourth file without touching table DDL. Sequential timestamps a few seconds apart (Supabase applies migrations in filename order) keep this deterministic — see Common Pitfalls below for a real gotcha here.

### Pattern 1: Current-state + append-only-log pair, modeled on the credits precedent

**What:** One `PRIMARY KEY (user_id)` table for compact current state, one FK'd append-only table for history, joined by a single `SECURITY DEFINER` RPC that writes both atomically.
**When to use:** Any per-user "current position + full history" requirement where the current position must be cheap to read without replaying history — this codebase already has this pattern twice (`user_gamification`/`xp_transactions`+`coin_transactions`, `user_ai_credits`/`ai_credit_transactions`).
**Example (adapted from `026_ai_credits.sql` + D-01–D-07):**
```sql
-- Source: supabase/migrations/026_ai_credits.sql (existing codebase pattern),
-- adapted per CONTEXT.md D-01 (readiness), D-03 (track removed)
CREATE TABLE public.athlete_state (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'onboarding'
                          CHECK (status IN ('onboarding', 'active', 'paused')),
  readiness             TEXT NOT NULL DEFAULT 'fragile'
                          CHECK (readiness IN ('fragile', 'building', 'ready')),  -- D-01/D-02
  level                 INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  points                INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  tier                  INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1),
  -- NOTE: no `track` column — cut per D-03
  onboarding_profile    JSONB NOT NULL DEFAULT '{}',
  current_focus_summary TEXT,
  current_focus_detail  JSONB NOT NULL DEFAULT '{}',
  rolling_summary       TEXT,                              -- D-04: column only, no writer yet
  last_review_at        TIMESTAMPTZ,
  next_review_due_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.athlete_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_state_select_own" ON public.athlete_state
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER trg_athlete_state_updated
  BEFORE UPDATE ON public.athlete_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Pattern 2: `athlete_decisions` — mandatory evidence, stricter than the original draft

**What:** Append-only journal where `evidence` is `NOT NULL` (not merely `DEFAULT '{}'`) — the schema itself enforces that no decision can be written without the real data it claims to be grounded in.
**When to use:** Any audit-log table backing an "AI decisions must be grounded in real data, not hallucinated" invariant (FOUND-02, and Pitfall 1 from `research/PITFALLS.md`).
**Example:**
```sql
-- Source: adapted from research/ARCHITECTURE.md draft + research/STACK.md's
-- "make grounding jsonb mandatory at the DB layer" recommendation
CREATE TABLE public.athlete_decisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_type  TEXT NOT NULL CHECK (decision_type IN
                    ('onboarding_profile', 'weekly_focus', 'level_change',
                     'reward_grant', 'program_created', 'goal_created')),
  week_of        DATE,
  summary        TEXT NOT NULL,
  rationale      TEXT,
  evidence       JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),  -- mandatory, not default-only
  outcome        JSONB NOT NULL DEFAULT '{}',
  source         TEXT NOT NULL DEFAULT 'weekly_review_cron'
                    CHECK (source IN ('weekly_review_cron', 'onboarding_tool',
                                       'app_open_fallback', 'manual_admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_athlete_decisions_week_idempotency
  ON public.athlete_decisions (user_id, decision_type, week_of)
  WHERE decision_type = 'weekly_focus' AND week_of IS NOT NULL;

CREATE INDEX idx_athlete_decisions_user_created
  ON public.athlete_decisions (user_id, created_at DESC);

ALTER TABLE public.athlete_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_decisions_select_own" ON public.athlete_decisions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
```

**Note on the `evidence NOT NULL` tightening:** the RPC itself (below) will therefore need `p_evidence` to be a required, non-null parameter (no default), which is a deliberate stricter contract than the original draft's optional-looking `JSONB NOT NULL DEFAULT '{}'`. This means a future caller literally cannot insert a decision row without supplying *some* evidence object — an empty `{}` still satisfies `NOT NULL` + `jsonb_typeof = 'object'`, so this is schema-level grounding-required, not schema-level grounding-verified (verifying evidence is *real* activity data, not an empty stub, is a Phase 43+ tool-executor code-review concern, out of this phase's reach — documented as a boundary in the Architectural Responsibility Map above).

### Pattern 3: `record_athlete_decision()` RPC — the single write path, with the corrected GRANT lockdown this project has since learned it needs

**What:** `SECURITY DEFINER` function that atomically inserts the journal row and patches the state row, then has its `EXECUTE` privilege revoked from every role except the one the backend actually authenticates as.
**When to use:** Any single-write-gate requirement (FOUND-03/FOUND-04) where the write must be impossible to reach any other way, including a leaked/legitimate service-role key used outside the RPC.
**Example (this is the corrected shape — see Common Pitfalls for why the older `026_ai_credits.sql` shape is insufficient on its own):**
```sql
-- Source: adapted from research/ARCHITECTURE.md's draft RPC body, corrected
-- per this project's own documented lesson in 20260818190601_premium_credit_grant.sql
CREATE OR REPLACE FUNCTION public.record_athlete_decision(
  p_user_id        UUID,
  p_decision_type  TEXT,
  p_week_of        DATE,
  p_summary        TEXT,
  p_rationale      TEXT,
  p_evidence       JSONB,     -- required, no default — see Pattern 2 note
  p_outcome        JSONB,
  p_source         TEXT,
  p_state_patch    JSONB      -- fields to merge into athlete_state
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) != 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'evidence_required');
  END IF;

  INSERT INTO public.athlete_decisions
    (user_id, decision_type, week_of, summary, rationale, evidence, outcome, source)
  VALUES (p_user_id, p_decision_type, p_week_of, p_summary, p_rationale, p_evidence,
          COALESCE(p_outcome, '{}'::jsonb), COALESCE(p_source, 'weekly_review_cron'))
  ON CONFLICT (user_id, decision_type, week_of)
    WHERE decision_type = 'weekly_focus' AND week_of IS NOT NULL DO NOTHING;

  -- Ensure a state row exists (first-ever decision for this athlete, e.g. onboarding)
  INSERT INTO public.athlete_state (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.athlete_state
  SET level                 = COALESCE((p_state_patch->>'level')::int, level),
      points                = COALESCE((p_state_patch->>'points')::int, points),
      tier                  = COALESCE((p_state_patch->>'tier')::int, tier),
      readiness             = COALESCE(p_state_patch->>'readiness', readiness),
      status                = COALESCE(p_state_patch->>'status', status),
      current_focus_summary = COALESCE(p_state_patch->>'current_focus_summary', current_focus_summary),
      last_review_at        = NOW(),
      next_review_due_at    = NOW() + INTERVAL '7 days',
      updated_at            = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── Lockdown — this project's ALTER DEFAULT PRIVILEGES grants EXECUTE to
-- anon/authenticated/service_role directly at CREATE FUNCTION time, a grant
-- separate from PUBLIC that a PUBLIC-only REVOKE never removes (verified live,
-- see 20260813182644_waitlist_founder_offer.sql and 20260818190601_premium_credit_grant.sql).
-- Every role must be named explicitly.
REVOKE EXECUTE ON FUNCTION public.record_athlete_decision(
  UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_athlete_decision(
  UUID, TEXT, DATE, TEXT, TEXT, JSONB, JSONB, TEXT, JSONB
) TO service_role;

-- ── D-06/D-07: table-level write lockdown, stricter than any existing
-- precedent in this codebase (existing precedent only revokes from
-- `authenticated` — see 20260822120000_gamification_economy_rpc.sql).
-- SECURITY DEFINER functions run as the function owner and are NOT subject
-- to these REVOKEs, so the RPC keeps working after this runs.
REVOKE INSERT ON public.athlete_decisions FROM authenticated, service_role;
REVOKE UPDATE ON public.athlete_state FROM authenticated, service_role;
```

**Why `EXECUTE ... TO service_role` and not `TO authenticated`:** every existing "single privileged writer" RPC in this codebase that has actually had its `EXECUTE` grant locked down (`grant_premium_credits`, `claim_waitlist_signup`, `normalize_waitlist_email`, `anonymize_waitlist_signup`) grants exclusively to `service_role`, matching how backend code calls these RPCs — via `createClient(url, process.env.SUPABASE_SERVICE_KEY ?? PUBLISHABLE_KEY)` (see `backend/api/src/coach/ai/context.ts`, `credits-cron.ts`, `notifications-cron.ts`, all using this exact fallback chain). If `SUPABASE_SERVICE_KEY` is genuinely absent in a given environment, that `createClient` call falls back to the **publishable/anon key**, which authenticates as `anon` (or `authenticated` once a user signs in through it) — meaning the whole write-path silently degrades to "cannot call the RPC at all" rather than "can call it insecurely." This fail-closed behavior is a feature of the current design, not a gap this phase needs to fix, but it is worth flagging (see Common Pitfalls) since Phase 43's onboarding tool will be the first real caller and must confirm `SUPABASE_SERVICE_KEY` is actually configured in its runtime environment.

### Anti-Patterns to Avoid

- **RLS-only lockdown for `service_role`:** Omitting a write policy (or writing `FOR ALL USING (false)`) blocks `authenticated` but does **nothing** against `service_role`, which carries `BYPASSRLS` and skips policy evaluation entirely regardless of what policies exist. D-06 explicitly requires blocking `service_role` too — this can only be done with table-level `REVOKE`, never with RLS alone.
- **`REVOKE ... FROM PUBLIC` alone on the new RPC:** This project's `ALTER DEFAULT PRIVILEGES` grants `EXECUTE` to `anon`/`authenticated`/`service_role` **directly and separately from `PUBLIC`** at `CREATE FUNCTION` time — a `PUBLIC`-only revoke leaves `anon`/`authenticated` still able to call the RPC. This is a documented, previously-hit gotcha in this exact codebase (`is_coach_of()`/`redeem_invitation_code()`/`peek_invitation()` needed a follow-up fix per `STATE.md`'s open-blocker note referenced in `20260818190601_premium_credit_grant.sql`). Every role must be named explicitly in the `REVOKE`.
- **Letting the RPC accept `p_evidence` as optional/defaultable:** Weakens the FOUND-02 grounding guarantee to a convention instead of a schema contract. Keep it a required parameter with an explicit null/shape check inside the function body (shown above) — Postgres function parameters cannot themselves be `NOT NULL`-constrained the way columns can, so the guard must be the first statement in the function body, not a parameter modifier.
- **Cutting the `readiness` `DEFAULT` to anything other than `'fragile'`:** D-02 is explicit that `'fragile'` (most cautious) is the fail-safe default — this is a product/regulatory-adjacent safety posture (GATE-03's "never trap at zero access, but also never over-grant at signup" framing), not an arbitrary enum-ordering choice.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic "insert log row + patch state row" | A backend-code transaction wrapper calling two separate Supabase queries | The single `SECURITY DEFINER` RPC | Two separate client-side calls cannot be wrapped in one Postgres transaction from the `@supabase/supabase-js` client library — a partial failure between the two calls would leave state and journal inconsistent. The RPC's single `plpgsql` function body is one implicit transaction. |
| "Only this table's owner can bypass the write lock" | A custom Postgres role hierarchy or a new `ALTER ROLE ... BYPASSRLS` grant | `SECURITY DEFINER` (function runs as its owner, typically the migration-runner role which already has full table privileges) | This is exactly the mechanism the codebase's own `20260822120000_gamification_economy_rpc.sql` comment names explicitly: "SECURITY DEFINER functions above bypass this (they run as the function owner)." No new role concept needed. |
| Idempotent weekly-decision dedup | A backend-side "have I already processed this athlete this week?" cache/lookup before calling the RPC | The partial `UNIQUE INDEX ... WHERE decision_type = 'weekly_focus' AND week_of IS NOT NULL` + `ON CONFLICT DO NOTHING` inside the RPC | Matches `026_ai_credits.sql`'s `idx_credit_tx_idempotency` pattern exactly — DB-level idempotency survives concurrent/retried calls (Vercel at-least-once cron delivery) in a way an application-level cache cannot guarantee under Fluid Compute's concurrent-instance model. This phase ships the index; Phase 44's cron is the actual consumer. |

**Key insight:** every mechanism this phase needs (atomic multi-table write, privileged-bypass write gate, retry-safe idempotency) already has a working, shipped implementation elsewhere in this exact codebase. The work here is disciplined adaptation, not invention — and the two places this phase's design is *stricter* than any existing precedent (revoking from `service_role` too, making `evidence` schema-mandatory) are the two places D-06/D-07/FOUND-02 explicitly call for going further than what's already shipped.

## Common Pitfalls

### Pitfall 1: `REVOKE ... FROM PUBLIC` looking sufficient but silently leaving `authenticated`/`service_role` with access

**What goes wrong:** A migration author revokes `EXECUTE` from `PUBLIC` (the Postgres-standard "default" role) and assumes this closes off client/service access, because that's what "revoke from everyone" sounds like it should mean.
**Why it happens:** This project's initial Supabase setup configured `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ... TO anon, authenticated, service_role` (and the table-level CRUD equivalent) as a *separate* grant from whatever `PUBLIC` has — this is non-default Postgres behavior that this specific project's setup script introduced, and it is easy to forget because most Postgres/Supabase tutorials only discuss the `PUBLIC` role.
**How to avoid:** Every `REVOKE` in this phase's migrations must name `authenticated` and `service_role` explicitly (and `anon` for the RPC's `EXECUTE`), never rely on a `PUBLIC`-only revoke. This is a **verified live** fact about this project, documented in two independent recent migrations (`20260813182644_waitlist_founder_offer.sql`, `20260818190601_premium_credit_grant.sql`) — not a generic Postgres warning.
**Warning signs:** A test that signs in as an ordinary athlete and calls `client.rpc('record_athlete_decision', {...})` or `client.from('athlete_state').update({...})` directly succeeds when it should fail with a permission-denied error.

### Pitfall 2: Assuming `service_role`'s `BYPASSRLS` also bypasses table GRANTs

**What goes wrong:** A less-careful implementation skips the table-level `REVOKE` on `service_role`, reasoning "service_role already bypasses everything, so RLS is the whole security model for it and there's nothing left to lock down."
**Why it happens:** `BYPASSRLS` is a genuinely strong bypass for RLS policies specifically, and it's easy to conflate "bypasses RLS" with "bypasses all access control." They are independent Postgres subsystems — checked confirmed via Postgres RLS/privilege documentation: grants gate whether an operation is attempted at all; RLS policies (skippable via `BYPASSRLS`) gate which *rows* that operation reaches. `service_role` having `BYPASSRLS` says nothing about whether it holds `INSERT`/`UPDATE` privilege on a specific table — that's governed purely by `GRANT`/`REVOKE`, same as any other role.
**How to avoid:** Explicit `REVOKE INSERT/UPDATE ... FROM ... service_role` as D-06 specifies, verified by a test that calls `getAdminClient()` (the `service_role`-keyed client already used in `backend/api/test/rls/fixtures.ts`) and attempts a direct write — it must fail with a Postgres permission error, not an RLS-silently-drops-the-row behavior (permission-denied is a hard error at the GRANT layer, distinct from RLS's silent row-filtering behavior seen in `coach-rls.spec.ts`'s UPDATE test).
**Warning signs:** `admin.from('athlete_state').update({ level: 99 }).eq('user_id', x)` (using the service-role client) returns no error.

### Pitfall 3: `SECURITY DEFINER` function owner isn't actually privileged enough after the table REVOKE

**What goes wrong:** If the migration is somehow applied by a role other than the one that owns/created the tables (unlikely in this project's single-migration-runner setup, but worth stating explicitly), the RPC's `SECURITY DEFINER` context might not have the table privileges it needs post-REVOKE, causing the RPC itself to start failing with permission-denied.
**Why it happens:** `SECURITY DEFINER` functions execute with the privileges of the function's *owner*, not the caller — if the owner is a role that was also swept up in a broad `REVOKE`, the function breaks.
**How to avoid:** Supabase migrations run as the `postgres` role (or an equivalently privileged migration role) by default, and `020260822120000_gamification_economy_rpc.sql`'s working-in-production RPCs prove this exact pattern (`REVOKE INSERT, UPDATE ON public.user_gamification FROM authenticated` while `award_xp`/`award_coins` — owned by the same migration role — keep working). This phase's `REVOKE` list explicitly names `authenticated` and `service_role`, never the migration-runner/table-owner role, so this should not occur — but it is worth a smoke-test in the RLS integration spec (call the RPC via the admin/service client and confirm it still succeeds end-to-end after the REVOKEs run in the same migration file).
**Warning signs:** `record_athlete_decision()` starts returning a Postgres `permission denied for table athlete_state` error from *inside* the function body, not from a client-side call.

### Pitfall 4: Migration ordering — table REVOKEs must run in the same or a later migration than table creation, and the RPC's REVOKE must run after `CREATE FUNCTION`

**What goes wrong:** If the three migration files (`athlete_state`, `athlete_decisions`, `athlete_decisions_rpc`) are misordered by timestamp, or if a `REVOKE` statement is accidentally placed before the corresponding `CREATE TABLE`/`CREATE FUNCTION` in the same file, the migration fails outright (`REVOKE` on a nonexistent object).
**Why it happens:** Supabase applies migrations in lexical filename order; `YYYYMMDDHHMMSS` timestamps generated a few seconds apart in the same planning/authoring session can accidentally collide or invert if copy-pasted carelessly.
**How to avoid:** Generate three distinct, monotonically increasing timestamps (e.g., `_state`, `_decisions`, `_decisions_rpc` a minute apart) and keep each file's own internal ordering CREATE-then-REVOKE, matching every existing precedent inspected in this research (`20260822120000_gamification_economy_rpc.sql` puts all `CREATE FUNCTION` statements first, then a "Lock down direct client writes" section at the bottom).
**Warning signs:** `supabase db push` (or the CI migration-apply step) fails with `ERROR: relation "athlete_state" does not exist` or `ERROR: function record_athlete_decision(...) does not exist`.

### Pitfall 5: `p_state_patch` merge logic accidentally allows a caller to decrease a monotonic field

**What goes wrong:** The RPC's `UPDATE ... SET level = COALESCE((p_state_patch->>'level')::int, level)` pattern (from the original draft) has no floor check — a caller passing `{"level": 0}` (bug, not malice) would silently decrease the athlete's level, which is exactly the "implicit punishment via calculation edge case" pattern flagged as Pitfall 4 in `research/PITFALLS.md`, one milestone level up from this phase but rooted in this phase's RPC contract.
**Why it happens:** `COALESCE` only guards against `NULL`, not against a value that's present but wrong/lower than current.
**How to avoid:** Phase 42 ships the RPC without a caller yet, so this can't be observed in practice this phase — but the RPC body is the correct place to document the invariant now (a code comment stating the ratchet expectation) so Phase 44/45 don't have to rediscover it, and optionally add a `GREATEST(current, new)` guard on `level`/`points`/`tier` directly in this phase's RPC if Claude's Discretion during planning favors defense-in-depth over waiting for Phase 44/45 to add it. Recommend adding the `GREATEST()` guard now, since it costs nothing (zero real callers yet to break) and closes the gap the milestone's own research (Pitfall 4) explicitly flags as a recurring implementation risk across three future phases.
**Warning signs:** N/A in this phase (no caller exists yet) — this is a forward-looking contract note for Phase 44/45's plan-checker to verify against.

## Rolling-Summary Budget (D-05 — Claude's Discretion, Researched Recommendation)

**Recommendation: `rolling_summary` capped at ~500 tokens (≈2,000 characters, since ~4 chars/token is a reasonable English/French prose ratio for Claude models) + last **4** raw `athlete_decisions` rows read verbatim.**

**Reasoning, validated conceptually against a synthetic 12-month-tenure athlete (no real data exists yet — this phase ships zero rows, so this is a design-time estimate, not a measured load test):**
- A weekly-cadence athlete active 12 months accumulates ~52 `athlete_decisions` rows (assuming ~1 `weekly_focus` decision/week; onboarding/reward/level-change rows add more, so 60-80 rows/year is a safer planning number).
- At the last-4-rows convention, only the most recent ~1 month of decisions is ever read at full fidelity (exact `evidence`/`rationale` JSON, likely 200-400 tokens per row once formatted into a prompt) — bounding the "recent window" contribution to roughly 800-1,600 tokens regardless of tenure.
- The `rolling_summary` (prose, ~500 tokens capped) is the only place months 2-12 of history are represented at all — this matches `research/STACK.md`'s own starting point (~300-500 tokens, last 3-4 weekly reviews) almost exactly; this research nudges the raw-window count to 4 (not 3) since `athlete_decisions` will also carry non-weekly entry types (`onboarding_profile`, `reward_grant`, `level_change`) interleaved with `weekly_focus` rows, so "last 4 rows" more reliably captures "last ~3-4 *weekly* reviews" than a literal "last 3."
- **Total bounded context contribution regardless of tenure:** rolling_summary (≤500 tokens) + 4 raw rows (~800-1,600 tokens) + reasonable JSON formatting overhead ≈ 1,500-2,500 tokens — a small, flat addition to any prompt, independent of whether the athlete has been active for 1 month or 5 years. This directly satisfies FOUND-05's "stays within a bounded token budget... never a full replay" requirement, conceptually.
- **This is a starting number for Phase 42's documentation, not a locked contract** — Phase 44, which actually builds the compaction writer and has real (or realistic synthetic) data to test against, should re-verify with an actual token count before shipping, per `research/SUMMARY.md`'s own flagged to-do ("Pitfall 5" cross-reference, this document's Pitfall 5 above is unrelated — see `research/PITFALLS.md`'s Pitfall 6 for the original unbounded-journal concern this budget addresses).

**Where to document this convention in Phase 42's deliverable:** a code comment on the `rolling_summary` column definition (`COMMENT ON COLUMN public.athlete_state.rolling_summary IS '...'`) plus a short markdown note in this phase's own follow-up doc (e.g., a `README.md`-style comment block at the top of the RPC migration file) stating: "Read convention: always fetch `athlete_state.rolling_summary` + `SELECT * FROM athlete_decisions WHERE user_id = ? ORDER BY created_at DESC LIMIT 4` — never a full-table read. Recompaction of `rolling_summary` is Phase 44's `coaching-engine/context.ts` responsibility, run as the last step of the weekly review." This is documentation only — Phase 42 ships no code that reads these fields yet (no caller exists).

## Code Examples

### Verifying the GRANT lockdown holds (RLS integration test pattern)

```typescript
// Source: pattern verbatim from backend/api/test/rls/premium-grant-rpc.spec.ts
// and backend/api/test/rls/waitlist-config-rpc.spec.ts (RUN_DB guard),
// adapted for athlete_state/athlete_decisions
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient, createTestUser, cleanupTestUsers } from './fixtures';

const RUN_DB = Boolean(process.env.SUPABASE_TEST_URL) && process.env.SUPABASE_TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!RUN_DB)('athlete_state/athlete_decisions — RLS + DB-level write lockdown (FOUND-03, FOUND-04)', () => {
  it('athlete reads own athlete_state row, not another athlete\'s', async () => {
    const a = await createTestUser('athlete-a');
    const b = await createTestUser('athlete-b');
    const admin = getAdminClient();
    await admin.from('athlete_state').insert([{ user_id: a.id }, { user_id: b.id }]);

    const ownRead = await a.client.from('athlete_state').select('user_id').eq('user_id', a.id);
    expect(ownRead.data?.length).toBe(1);

    const crossRead = await a.client.from('athlete_state').select('user_id').eq('user_id', b.id);
    expect(crossRead.data?.length ?? 0).toBe(0); // RLS silently filters, no error

    await cleanupTestUsers([a.id, b.id]);
  });

  it('authenticated client cannot UPDATE athlete_state directly (D-06)', async () => {
    const user = await createTestUser('athlete-write-block');
    const admin = getAdminClient();
    await admin.from('athlete_state').insert({ user_id: user.id });

    const result = await user.client.from('athlete_state').update({ level: 99 }).eq('user_id', user.id);
    expect(result.error).not.toBeNull(); // permission denied, not silent no-op

    await cleanupTestUsers([user.id]);
  });

  it('service-role (admin) client ALSO cannot UPDATE athlete_state directly (D-06 — the load-bearing case)', async () => {
    const user = await createTestUser('athlete-service-write-block');
    const admin = getAdminClient(); // uses SUPABASE_SERVICE_ROLE_KEY — BYPASSRLS, but NOT bypass-GRANT
    await admin.from('athlete_state').insert({ user_id: user.id });

    const result = await admin.from('athlete_state').update({ level: 99 }).eq('user_id', user.id);
    expect(result.error).not.toBeNull(); // proves table REVOKE, not just RLS, is in effect

    await cleanupTestUsers([user.id]);
  });

  it('anon/authenticated cannot EXECUTE record_athlete_decision; only service_role can', async () => {
    const anon = getAnonClient();
    const anonResult = await anon.rpc('record_athlete_decision', { p_user_id: '00000000-0000-0000-0000-000000000000', p_decision_type: 'onboarding_profile', p_week_of: null, p_summary: 'x', p_rationale: null, p_evidence: {}, p_outcome: {}, p_source: 'onboarding_tool', p_state_patch: {} });
    expect(anonResult.error).not.toBeNull();

    const admin = getAdminClient();
    const user = await createTestUser('rpc-caller-test');
    const adminResult = await admin.rpc('record_athlete_decision', { p_user_id: user.id, p_decision_type: 'onboarding_profile', p_week_of: null, p_summary: 'first decision', p_rationale: 'test', p_evidence: {}, p_outcome: {}, p_source: 'onboarding_tool', p_state_patch: { level: 1 } });
    expect(adminResult.error).toBeNull();
    expect(adminResult.data.success).toBe(true);

    await cleanupTestUsers([user.id]);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| RLS-only lockdown (`user_gamification_own` single `USING/WITH CHECK` policy, no command restriction) | RLS SELECT-only + table-level `REVOKE INSERT/UPDATE` + `SECURITY DEFINER` RPC | `20260822120000_gamification_economy_rpc.sql` (2026-08-22, this project) | The gamification pair's original 007-era RLS pattern is now explicitly documented in this codebase as the thing *not* to copy for security-relevant fields — this phase's `athlete_state`/`athlete_decisions` should follow the corrected, newer pattern from day one, never the original |
| `REVOKE EXECUTE ... FROM PUBLIC` assumed sufficient | `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` (naming every role) | `20260813182644_waitlist_founder_offer.sql` / `20260818190601_premium_credit_grant.sql` (2026-08-13/18, this project) | A `PUBLIC`-only revoke was proven insufficient on this exact project due to its `ALTER DEFAULT PRIVILEGES` setup — every future RPC (including `record_athlete_decision()`) must follow the corrected pattern |
| Table-level `REVOKE` applied only to `authenticated` | This phase (D-06) extends the same technique to `service_role` too | New for this phase — no prior codebase precedent revokes from `service_role` | First instance in this codebase of DB-enforced "not even our own backend's privileged key can bypass this" — a deliberately stricter bar than anything shipped before, justified by `level`/`readiness` being gating-relevant (security-relevant) state |

**Deprecated/outdated:** N/A — no library APIs involved in this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ~500 tokens / ≈2,000 characters is a reasonable cap for `rolling_summary`, and 4 raw decision rows is the right recent-window size | Rolling-Summary Budget | If real Phase 44 token counts run meaningfully higher (e.g., verbose `evidence` JSON per row), the "bounded" claim needs re-verification with actual data before Phase 44 ships — this research explicitly flags this as a design-time estimate, not a measured result, and recommends Phase 44 re-validate |
| A2 | Backend production environments actually have `SUPABASE_SERVICE_KEY` configured (not silently falling back to `SUPABASE_PUBLISHABLE_KEY`) for whichever route ends up calling `record_athlete_decision()` in Phase 43+ | Pattern 3 code example note | If a future caller's environment lacks `SUPABASE_SERVICE_KEY`, the RPC call will fail outright (permission denied, since the fallback publishable-key client only authenticates as anon/authenticated) — this is fail-closed (safe) but would surface as an unexpected 4xx/5xx in Phase 43, not a silent security gap; worth a specific check in Phase 43's own research/planning, not a Phase 42 blocker |
| A3 | Supabase's `service_role` Postgres role attribute configuration (`BYPASSRLS`, no table-privilege bypass) is unchanged from the general Supabase platform behavior confirmed via WebSearch for this project specifically | Summary, Pitfall 2 | Extremely low — this is core, stable Supabase/Postgres platform behavior, further corroborated by this exact project's own working `REVOKE ... FROM authenticated` precedent (which would be pointless if grants didn't matter for non-superuser, non-BYPASSRLS-relevant checks) — but flagging per protocol since it wasn't verified against this project's specific `pg_roles` catalog (no direct DB access in this research session) |

## Open Questions (RESOLVED — see 42-02-PLAN.md)

1. **(RESOLVED by 42-02) Should the `GREATEST()` monotonicity guard (Pitfall 5) be added to this phase's RPC now, or left for Phase 44/45?** Resolved: added now, but scoped to `points`/`tier` only (not `level`, which must remain freely settable for Phase 44's ENGINE-03 de-escalation) — a narrower application of this question's recommendation, decided during planning. See 42-02-PLAN.md.
   - What we know: The milestone-wide monotonicity invariant (REWARD-04, and `research/PITFALLS.md` Pitfall 4) isn't a Phase 42 requirement per se — FOUND-01–05 don't mention it — but the RPC being built now is the one and only place this guard can ever be enforced at the DB layer, and there is zero cost to adding it while there are zero real callers to break.
   - What's unclear: Whether the planner/discuss-phase for Phase 42 wants to scope this in now (small, zero-risk addition) or explicitly defer it as a Phase 44/45 concern to keep Phase 42's diff minimal and focused strictly on FOUND-01–05.
   - Recommendation: Add the `GREATEST(current, incoming)` clause for `level`/`points`/`tier` in this phase's RPC — it's a one-line addition per field, directly supports the milestone's cross-cutting non-punitive principle, and costs nothing to add now vs. a future migration `CREATE OR REPLACE FUNCTION` later. Flag as a planning decision point, not a blocker.

2. **(RESOLVED by 42-02) Exact backfill behavior when `record_athlete_decision()` is called for a user with no `athlete_state` row yet (first-ever decision, e.g. onboarding)?** Resolved: self-heal `INSERT ... ON CONFLICT (user_id) DO NOTHING` before the `UPDATE`, per this question's own recommendation. `p_state_patch` shape left loose for Phase 43 to populate on first call. See 42-02-PLAN.md.
   - What we know: The RPC example above includes `INSERT INTO athlete_state (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;` before the `UPDATE`, so the first call self-creates the row with all column defaults (`readiness='fragile'`, `level=1`, etc.) then immediately patches it via the `UPDATE`.
   - What's unclear: Whether Phase 43's onboarding tool expects to pass a full initial state via `p_state_patch` on that very first call (likely yes, since ONBOARD-05 says onboarding "writes the athlete's starting level/palier/focus") — this phase's RPC signature supports that, but the exact shape of `p_state_patch` keys used by Phase 43 isn't locked here.
   - Recommendation: Not a blocker for Phase 42 — the RPC's `p_state_patch` JSONB shape is intentionally loose (any subset of columns) precisely so Phase 43 doesn't need this phase's migration touched again. Document this in the RPC's `COMMENT ON FUNCTION` for Phase 43's benefit.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependency beyond the already-configured Supabase project (verified reachable via every existing migration in `supabase/migrations/`, no new extension required). Skipping this section per its own scope condition (code/config-only phase, and the one "external" system — Postgres — is already fully available and in continuous use).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.2.4 (`backend/api`) |
| Config file | `backend/api/vitest.config.ts` |
| Quick run command | `npm run test:rls` (from `backend/api/`) — runs `vitest run test/rls --passWithNoTests` |
| Full suite command | `npm test` (from `backend/api/`) — `vitest run --passWithNoTests` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | `athlete_state` returns single current-state row per athlete, never grows | integration (RLS) | `npx vitest run test/rls/athlete-state.spec.ts -t "reads own"` | ❌ Wave 0 |
| FOUND-02 | `athlete_decisions` rows are immutable, evidence-mandatory | integration (RLS) | `npx vitest run test/rls/athlete-decisions.spec.ts -t "evidence"` | ❌ Wave 0 |
| FOUND-03 | Only `record_athlete_decision()` can write `athlete_state` | integration (RPC) | `npx vitest run test/rls/athlete-state.spec.ts -t "cannot UPDATE"` | ❌ Wave 0 |
| FOUND-04 | RLS: own-read succeeds, cross-read denied, no client write path exists | integration (RLS) | `npx vitest run test/rls/athlete-state.spec.ts` (full file) | ❌ Wave 0 |
| FOUND-05 | `rolling_summary` column + documented read convention exists (no runtime behavior to test yet — no caller) | manual-only (schema review) | N/A — verify via `\d athlete_state` / migration diff review; no automated assertion possible until Phase 44 has a reader to test | ❌ Wave 0 (schema-existence check only) |

### Sampling Rate
- **Per task commit:** `npm run test:rls` (fast — only the 2-4 new spec files, `--passWithNoTests` means it's safe even before the first spec file lands)
- **Per wave merge:** `npm test` (full backend suite — ensures no regression to existing RLS specs, e.g., `coach-rls.spec.ts`, `redeem-rpc.spec.ts`)
- **Phase gate:** Full suite green before `/gsd:verify-work`. Additionally: the RLS suite is `RUN_DB`-gated (per `waitlist-config-rpc.spec.ts`/`premium-grant-rpc.spec.ts` convention) — it only actually executes against a real Supabase test project when `SUPABASE_TEST_URL`/`SUPABASE_TEST_PUBLISHABLE_KEY`/`SUPABASE_TEST_SERVICE_ROLE_KEY` are configured as repo secrets. Per `.github/workflows/test-rls.yml`'s own header comment, these secrets are **not yet configured** in this repo as of the last verified check — meaning the new specs will be present and correct but will silently skip in CI until that secret configuration lands. This is a pre-existing repo condition, not something Phase 42 can or should fix, but the planner should be aware the "full suite green" gate for the RLS-specific assertions may currently mean "skipped," not "passed," depending on CI secret state at execution time.

### Wave 0 Gaps
- [ ] `backend/api/test/rls/athlete-state.spec.ts` — covers FOUND-01, FOUND-03, FOUND-04 (own-read, cross-read-denied, authenticated-write-blocked, service-role-write-blocked)
- [ ] `backend/api/test/rls/athlete-decisions.spec.ts` — covers FOUND-02 (evidence-mandatory CHECK constraint rejects insert without evidence via admin client bypass attempt — actually this will fail before reaching RLS since INSERT is revoked from admin too; test should instead verify the CHECK constraint via a direct RPC call with `p_evidence: null` returns the `evidence_required` error path) and immutability (no UPDATE/DELETE policy exists at all — verify via admin-client attempt, expecting a permission error identical to the state-table pattern)
- [ ] Extend `backend/api/test/rls/fixtures.ts`: no changes needed — `getAdminClient()`, `getAnonClient()`, `createTestUser()`, `cleanupTestUsers()` already cover every fixture this phase's specs require, confirmed by direct inspection

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surface — reuses existing Supabase Auth session/JWT for RLS `auth.uid()` |
| V3 Session Management | No | Not touched by this phase |
| V4 Access Control | Yes | RLS SELECT-only policies (`auth.uid() = user_id`) + table-level `GRANT`/`REVOKE` lockdown (D-06/D-07) + RPC `EXECUTE` restricted to `service_role` only — this phase's entire purpose is a V4 access-control design |
| V5 Input Validation | Yes | `CHECK` constraints on every enum-like column (`readiness`, `decision_type`, `source`, `status`), `NOT NULL`/`jsonb_typeof` guard on `evidence`, numeric floor `CHECK`s (`level >= 1`, `points >= 0`, `tier >= 1`) |
| V6 Cryptography | No | No crypto surface in this phase — `gen_random_uuid()` is an ID generator, not a security primitive here |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct client write to security-relevant state (an authenticated user sets their own `athlete_state.level`/`readiness` via a raw Supabase REST/SDK call, bypassing any server-side re-validation) | Elevation of Privilege | RLS SELECT-only (no write policy at all) + table-level `REVOKE UPDATE FROM authenticated` — two independent layers, either one alone would be insufficient (RLS omission alone still permits `service_role`; a `REVOKE` alone without RLS would still expose row-level read leakage if RLS were ever accidentally disabled) |
| Leaked/legitimate service-role key used outside the intended backend code path to write `athlete_state`/`athlete_decisions` directly (e.g., a compromised environment variable, or a future engineer writing a "quick fix" script against the DB with the service key) | Tampering | Table-level `REVOKE ... FROM service_role` (D-06) — this is the phase's specific answer to a threat model that goes beyond "malicious end user," extending to "trusted-but-fallible backend code/operator" |
| Cross-role default-privilege surprise (a future migration creates a new table/function assuming Postgres defaults, inadvertently exposing it to `anon` because this project's `ALTER DEFAULT PRIVILEGES` auto-grants beyond what a generic Postgres tutorial would lead an author to expect) | Information Disclosure / Elevation of Privilege | Every new table/function in this phase's migrations must include an explicit, role-named `REVOKE` review as part of the migration itself — do not rely on "I didn't GRANT anything so it must be locked down" reasoning, which is false on this specific project |
| Bypassing the `record_athlete_decision()` grounding requirement by calling it with a fabricated/empty `p_evidence` from a future compromised or buggy tool executor | Repudiation (an ungrounded decision could later be claimed as "verified" since it passed the schema's `NOT NULL` check trivially with `{}`) | Out of Phase 42's reach to fully close (schema can enforce *presence* of evidence, not its *truthfulness*) — documented as an explicit architectural boundary in the Responsibility Map; Phase 43+ tool-executor code review must independently verify `evidence` actually reflects a real DB query result, not model-asserted or empty data, per `research/PITFALLS.md` Pitfall 1 |

## Sources

### Primary (HIGH confidence)
- Direct repository inspection: `supabase/migrations/026_ai_credits.sql`, `supabase/migrations/007_gamification_schema.sql`, `supabase/migrations/20260822120000_gamification_economy_rpc.sql`, `supabase/migrations/20260818190601_premium_credit_grant.sql`, `supabase/migrations/20260813182644_waitlist_founder_offer.sql`, `supabase/migrations/035_coach_invitations_links_rls.sql`, `supabase/migrations/040_peek_invitation_function.sql` — all GRANT/REVOKE/SECURITY DEFINER precedent verified by reading actual applied SQL, not summary
- Direct repository inspection: `backend/api/test/rls/{fixtures,coach-rls,redeem-rpc,premium-grant-rpc,waitlist-config-rpc}.spec.ts`, `backend/api/test/rls/fixtures.ts`, `backend/api/package.json`, `.github/workflows/test-rls.yml`, `.planning/codebase/TESTING.md`
- Direct repository inspection: `backend/api/src/coach/ai/{context,service}.ts`, `backend/api/src/routes/{notifications-cron,credits-cron}.ts`, grep across `backend/api/src/**` for `SUPABASE_SERVICE_KEY`/`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` usage — confirms the actual key/role each backend module authenticates as
- [PostgreSQL 18 docs — Role Attributes (BYPASSRLS)](https://www.postgresql.org/docs/current/role-attributes.html) — official docs, confirms BYPASSRLS is a role attribute requiring superuser (or delegated) grant, independent of ordinary privilege system
- Bytebase — Postgres Row-Level Security Footguns (`bytebase.com/blog/postgres-row-level-security-footguns/`) — corroborates "grants decide whether an operation is attempted at all; policies decide which rows" as the correct mental model, cross-referenced against official Postgres RLS docs in the same search pass

### Secondary (MEDIUM confidence)
- Supabase official docs (`supabase.com/docs/guides/database/postgres/row-level-security`, `supabase.com/docs/guides/api/securing-your-api`, `supabase.com/docs/guides/database/postgres/roles`) — WebSearch-surfaced, confirms "tables in public receive SELECT/INSERT/UPDATE/DELETE for anon/authenticated/service_role by default" and the `ALTER DEFAULT PRIVILEGES` mechanism generally (cross-verified against this project's own migration-file comments, which independently confirm the same behavior "verified live" on this specific project)
- `.planning/research/{SUMMARY,ARCHITECTURE,STACK,PITFALLS}.md` (2026-08-30, this project's own prior milestone-wide research pass) — the drafted schema/RPC this phase's research corrects and extends per CONTEXT.md's D-01–D-07

### Tertiary (LOW confidence)
- None — every claim in this document is either direct repository inspection or corroborated by at least one official/authoritative external source. No claim rests solely on unverified WebSearch or training-data recall.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, entirely composition of already-shipped, already-inspected local patterns
- Architecture: HIGH — every table/RPC/RLS/GRANT recommendation is directly modeled on a specific, already-applied migration in this exact repository, not external genericism
- Pitfalls: HIGH — the central technical risk (GRANT vs. BYPASSRLS) is verified against official PostgreSQL documentation AND this project's own two most recent migrations that independently discovered and fixed the identical "PUBLIC-only revoke is insufficient" gotcha

**Research date:** 2026-08-31
**Valid until:** No expiry driver — this is pure Postgres/Supabase platform behavior (stable, not fast-moving) and direct repository precedent (valid until those migration files themselves change). Re-verify only if Supabase changes its default-privileges platform behavior in a future project setting, or if this project's own `ALTER DEFAULT PRIVILEGES` configuration is ever altered.
