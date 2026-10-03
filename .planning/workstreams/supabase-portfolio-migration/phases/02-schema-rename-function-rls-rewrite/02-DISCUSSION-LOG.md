# Phase 2: Schema Rename & Function/RLS Rewrite - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-22
**Phase:** 2-Schema Rename & Function/RLS Rewrite
**Areas discussed:** Function/RPC naming scope, Auth-users trigger sequencing, Dry-run environment, Extension install authorization

---

## Function/RPC Naming Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix all functions | Defensive `ziko_` prefix on all 37 functions; matches ARCHITECTURE.md's anti-pattern warning; extends the 758-call-site rename to `.rpc()` sites | ✓ |
| Leave function names bare | Only rewrite table references inside function bodies; matches REQUIREMENTS.md literal wording; smaller diff but re-opens future collision risk | |
| You decide | Defer to researcher/planner | |

**User's choice:** Prefix all functions
**Notes:** Zero function-name collisions exist today between ziko's 37 functions and portfolio's 5, but the decision protects against a future 4th tenant with a generic colliding name (e.g. `award_xp`, `is_coach_of`).

---

## Auth-Users Trigger Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Create functions only, defer trigger attachment | Matches PITFALLS.md Pitfall 3 — avoids firing spurious side effects for rh_*/gecko_* signups before Phase 3 scoping exists | ✓ |
| Create and attach both now, disabled | Trigger exists but is disabled via `ALTER TABLE ... DISABLE TRIGGER`, re-enabled in Phase 3 | |
| You decide | Defer to planner | |

**User's choice:** Create functions only, defer trigger attachment
**Notes:** The renamed `ziko_handle_new_user`/`ziko_handle_new_user_credits` functions are created in Phase 2, but never attached to `portfolio`'s shared `auth.users` table until Phase 3 adds Ziko-only signup scoping.

---

## Dry-Run Environment (SCHEMA-05)

| Option | Description | Selected |
|--------|-------------|----------|
| New throwaway Supabase project | Higher fidelity — same managed Postgres 17.6 build, same RLS/auth stack, same CLI dump/push path; adds setup time + small cost/quota footprint | ✓ |
| Local Supabase CLI (supabase start / Docker) | Free, fast, disposable; lower fidelity — local stack may drift from portfolio's managed build and Vercel-marketplace quirks won't reproduce | |
| You decide | Defer to planner | |

**User's choice:** New throwaway Supabase project
**Notes:** None beyond the fidelity rationale.

---

## Extension Install Authorization (pg_net / unaccent)

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-authorize install if grep confirms need | `CREATE EXTENSION IF NOT EXISTS` is additive/non-destructive to rh_*/gecko_*'s existing extensions — low risk, avoids a mid-execution checkpoint stall | ✓ |
| Pause and ask again at that moment | Matches Phase 1's D-02 caution more literally, at the cost of an execution-time interruption | |

**User's choice:** Pre-authorize install if grep confirms need
**Notes:** Pre-authorization is conditional — only applies if Phase 2's function-body grep actually confirms `pg_net`/`unaccent` usage; no speculative install either way.

---

## Claude's Discretion

- Migration file naming/timestamp scheme for the new series (follow existing `YYYYMMDDHHMMSS_description.sql` convention, appended after `portfolio`'s history).
- Whether custom types/enums get the same defensive `ziko_` prefix as functions (apply D-01's rationale consistently if any exist).
- Structure/format of the post-apply grep verification script and per-table authenticated-query test suite.

## Deferred Ideas

None — discussion stayed within phase scope. Storage bucket prefixing was mentioned only as research context (correctly belongs to Phase 5, not raised as an in-scope question here).
