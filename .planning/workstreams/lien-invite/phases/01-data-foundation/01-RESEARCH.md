# Phase 1: Data Foundation - Research

**Researched:** 2026-08-12
**Domain:** Postgres/Supabase atomic-counter data layer + Next.js Server Action chokepoint (waitlist capture)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Call path and execution surface**
- **D-01:** The signup reaches the RPC through a **Next.js Server Action** that uses the
  service-role client (`apps/web/src/lib/supabase/admin.ts`). No `GRANT` is issued to `anon`.
  This preserves the posture of all 73 existing migrations, where every `GRANT EXECUTE` targets
  `authenticated` or `service_role` and never `anon`. It also gives a server-side chokepoint for
  the rate limiting and disposable-domain rejection that phase 5 will need.
  Reversibility: costly.
- **D-02:** The RPCs follow the codebase's existing grant idiom exactly: `REVOKE EXECUTE ON
  FUNCTION ... FROM PUBLIC;` immediately followed by `GRANT EXECUTE ... TO <role>;`. Established
  precedent (`is_coach_of` at `035_coach_invitations_links_rls.sql:100-101`, `redeem_invitation_code`
  at `:176-177`, `peek_invitation` at `040_peek_invitation_function.sql:73`). Mandatory, not
  stylistic: PostgreSQL grants `EXECUTE` to `PUBLIC` by default.
- **D-03:** The Server Action returns the **real founder status only for a genuinely new signup**.
  A duplicate submission receives a neutral success confirmation carrying no rank and no status.
  Reversibility: costly.
- **D-04:** **DATA-07 has been rewritten** as a direct consequence of D-03. Waitlist *membership*
  is explicitly accepted as disclosable; the founder *rank/status* is not. Residual risk recorded
  deliberately: an attacker who submits a third party's address still learns whether it was already
  registered (new signup shows a rank, duplicate does not). Rate limiting raises the cost of mass
  scanning but does not remove the oracle. Surfaced explicitly and accepted.
- **D-05:** Phase 1 delivers the Server Action, not only the SQL — the 200-cap is only testable
  end-to-end through the path production will actually take.

**Counter and configuration**
- **D-06:** The read RPC returns an object **already arbitrated by the threshold** —
  `{ should_display, remaining, is_full }`. The exact remaining count never leaves the database
  while the page is not supposed to show it. Reversibility: costly.
- **D-07:** An erasure request **anonymizes** the row (blanking email and identifying fields,
  keeping the row and its rank) rather than deleting it — resolves the FOND-04/LEGAL-09 collision.
  Reversibility: one-way.
- **D-08:** A shared **`app_config`** key/value table is created in phase 1 (deny-all RLS, read
  through an RPC). Phase 1 stores the reveal threshold in it; **phase 4 reuses it** for CRED-05's
  feature flag. Reversibility: costly.
- **D-09:** The counter is served from a **short cache with a monotonic floor** (never exceeds the
  last value served) using Upstash Redis, already configured (`apps/web/src/lib/ratelimit.ts`).

**Email identity**
- **D-10:** Normalization **neutralizes sub-addressing** — `+suffix` stripped for all domains, dots
  stripped for Gmail/Googlemail only. Reversibility: one-way (data migration risk if changed later).
- **D-11:** Two columns, not one: the address **as typed** (delivery) and its **normalized form**
  (unique index). **This changes the sketch in `research/ARCHITECTURE.md` §1**, where the unique
  index sits on `lower(email)` — both now key off the normalized column.
- **D-12:** Normalization runs **inside the RPC, in plpgsql**, not in the Server Action.
- **D-13:** A **minimal format `CHECK`** on the table as a last net (an `@` and a plausible domain).

**Stored fields and GDPR footprint**
- **D-14:** Beyond DATA-01, the table stores **`locale`, `utm_source` and `utm_campaign`**.
- **D-15:** **Consent-proof columns ship in phase 1** — consent timestamp + accepted-text version.
  Phase 3 only fills them.
- **D-16:** Phase 1 also delivers the **anonymization RPC** and the `anonymized_at` column; phase 3
  writes the retention *duration* into `app_config`.

### Claude's Discretion
- Exact migration filename and numbering (repo mixes `NNN_description.sql` and
  `YYYYMMDD_description.sql`; the newer dated form fits a 2026 migration).
- Column naming, index naming, internal structure of the plpgsql normalization helper.
- The concrete concurrency-test technique proving the 200-cap (parallel sessions, `pgbench`, or a
  Vitest harness driving concurrent RPC calls).
- Cache TTL for the counter, provided the monotonic floor of D-09 holds.

### Deferred Ideas (OUT OF SCOPE)
- Rate limiting parameters on the Server Action — phase 5, with the form.
- Disposable-domain rejection (WAIT-04) — phase 5.
- Retention duration value (LEGAL-08) — phase 3, written into `app_config`.
- Consent checkbox and collection-point privacy notice (LEGAL-06, LEGAL-07) — phases 3 and 5.
- The `tier='premium'` production count (CRED-01) — phase 4's blocking gate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Signup stored with email, audience, timestamp, founder rank | §DDL below — `waitlist_signups` columns `email`, `audience`, `created_at`, `founder_rank` |
| DATA-02 | Founder rank from a Postgres `SEQUENCE` — simultaneous signups never share a rank | §Concurrency design — `waitlist_founder_seq` + `nextval()`, verified atomic, non-MVCC |
| DATA-03 | 200-cap exact under any concurrency — 201st accepted, no founder status | §Concurrency design — `is_founder := v_rank <= 200` computed after `nextval()`, hardcoded cap |
| DATA-04 | Duplicate email (case-insensitive) — no duplicate row, no second founder rank | §DDL — unique index on `email_normalized`, `ON CONFLICT DO NOTHING` inside `claim_waitlist_signup` |
| DATA-05 | RLS enabled, zero policies — no role can read/write directly | §RLS design — `ENABLE ROW LEVEL SECURITY` with no `CREATE POLICY`, matches deny-all house idiom |
| DATA-06 | All writes/reads through `SECURITY DEFINER` RPCs, `deduct_ai_credits`/`is_coach_of()` idiom | §RPC idiom — verified against `026_ai_credits.sql:89-134`, `035_coach_invitations_links_rls.sql:84-101` |
| DATA-07 (revised) | Visitor cannot determine a third party's **founder status** (membership is disclosable) | §Server Action design — `claimWaitlistSpot` discards `is_founder`/`founder_rank` when `is_new=false`, tested in §Validation Architecture |
</phase_requirements>

## Summary

Phase 1 is consolidation, not discovery: the `SECURITY DEFINER` RPC + deny-all RLS idiom is already
proven three times in this codebase (`is_coach_of`, `redeem_invitation_code`, `peek_invitation`,
all in `035_coach_invitations_links_rls.sql` and `040_peek_invitation_function.sql`), and the
`SEQUENCE`-based founder-rank design in `research/ARCHITECTURE.md` §1 is sound and needs only two
corrections to match `01-CONTEXT.md`'s decisions: the unique index moves from `lower(email)` to a
dedicated `email_normalized` column (D-11), and the RPC's duplicate-branch return value must be
filtered by the **Server Action**, not trusted verbatim by the caller, to satisfy the revised
DATA-07 (D-03/D-04). Everything else — the `SEQUENCE` mechanism, the `REVOKE...FROM PUBLIC` +
`GRANT` idiom, the `TEXT + CHECK` enum convention, the migration-application path through CI — is
directly verified against real files in this worktree.

Two points deserve explicit flagging because they are not stated anywhere in the phase's own
planning documents: (1) `deduct_ai_credits` itself — the function CONTEXT.md cites for its
`SECURITY DEFINER` + `SET search_path` shape — has **no** `REVOKE`/`GRANT` statement anywhere in
`026_ai_credits.sql`, meaning it is (by Postgres default) currently reachable by `anon` if ever
called with the anon key; this phase must not reproduce that gap. (2) `ROADMAP.md`'s Phase 4
"Depends on" line claims phase 1 delivers `grant_premium_credits()` and
`user_profiles.is_lifetime_premium` — `01-CONTEXT.md`'s domain boundary does **not** include either;
only the shared `app_config` table is actually phase 1 scope. This is a documentation drift between
`ROADMAP.md` (written before phase 1 was discussed) and `01-CONTEXT.md` (authoritative); the planner
should not add those two items to phase 1's plan.

**Primary recommendation:** One migration, `supabase/migrations/20260812_waitlist_founder_offer.sql`,
delivering `app_config`, `waitlist_signups`, `waitlist_founder_seq`, a pure plpgsql normalization
helper, and three `SECURITY DEFINER` RPCs (`claim_waitlist_signup`, `get_waitlist_founder_status`,
`anonymize_waitlist_signup`) — all granted to `service_role` only, all reachable from a single
`apps/web/src/actions/waitlist.ts` Server Action that holds the D-03/D-04 non-disclosure filter and
is deliberately kept free of `next/headers()` so it stays directly importable and testable under
Vitest with no Next.js request-context dependency.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Founder-rank allocation / 200-cap enforcement | Database / Storage | — | `nextval()` atomicity is an engine-level guarantee; no other tier can provide it |
| Duplicate detection (case-insensitive dedupe) | Database / Storage | — | Unique index + `ON CONFLICT` inside the RPC is the only place the constraint can be enforced without a TOCTOU gap (D-12) |
| Non-disclosure response shaping (D-03/D-04) | Frontend Server (SSR / Server Action) | Database / Storage | The RPC may return full truth (server-to-server, never seen by an untrusted client); the Server Action is the last hop before the response leaves the trust boundary and must filter it |
| RLS / access control | Database / Storage | — | Deny-all RLS + `SECURITY DEFINER` is the house idiom; no other tier is in the access path |
| Counter threshold arbitration (D-06) | Database / Storage | — | The reveal decision must be made where the raw count lives, so the exact number never transits a network response pre-reveal |
| Consent/GDPR provenance capture (columns only) | Database / Storage | Frontend Server (phase 3/5 write the values) | Phase 1 only shapes the columns; population is out of scope here |
| Rate limiting / abuse mitigation | Frontend Server (SSR) | — | Deferred to phase 5 entirely — phase 1's Server Action must not half-implement this (see Common Pitfalls) |

## Standard Stack

No new external packages are introduced by this phase. Everything needed is already a workspace
dependency, verified by direct inspection rather than assumed:

| Library | Version (verified in-repo) | Purpose | Why Standard |
|---------|------|---------|--------------|
| `@supabase/supabase-js` | already a dependency of `apps/web` (used by `createAdminClient()` at `apps/web/src/lib/supabase/admin.ts:2`) [VERIFIED: apps/web/src/lib/supabase/admin.ts:1-16] | Service-role client for the Server Action → RPC call | Same client the two existing precedent actions (`account.ts`, `coach-identity.ts`) already use |
| PostgreSQL native `SEQUENCE` | built into Postgres, no extension | Atomic, lock-free founder-rank counter | `nextval()` cannot double-issue a value under any isolation level — see Concurrency design below |
| `gen_random_uuid()` | already used, e.g. `035_coach_invitations_links_rls.sql:14` | `waitlist_signups.id` default | pgcrypto/native extension already enabled in this project — no new `CREATE EXTENSION` needed |

**Installation:** none — no `npm install` step for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new npm/PyPI/crates packages — every component
(`@supabase/supabase-js`, native Postgres `SEQUENCE`) is already present in the codebase and was
verified by reading the actual source files listed above, not from training-data assumption. The
Package Legitimacy Gate protocol is skipped because there is nothing to run it against.

## Architecture Patterns

### System Architecture Diagram

```
Visitor (browser, unauthenticated)
        │  submits { email, audience, locale? }
        ▼
apps/web Server Action  claimWaitlistSpot()      ← apps/web/src/actions/waitlist.ts (new)
        │  createAdminClient()  (service-role key, server-only)
        ▼
Supabase Postgres
   ┌───────────────────────────────────────────────────────────┐
   │ claim_waitlist_signup(p_email, p_audience, ...)            │
   │   SECURITY DEFINER, GRANT ... TO service_role only          │
   │                                                              │
   │   1. normalize_waitlist_email(p_email)  (pure plpgsql)      │
   │   2. INSERT ... ON CONFLICT (email_normalized) DO NOTHING   │
   │        → v_id NULL  =  duplicate                            │
   │        → v_id set   =  genuinely new row                    │
   │   3. if new: v_rank := nextval(waitlist_founder_seq)        │
   │              is_founder := v_rank <= 200                     │
   │   4. RETURN (is_new, is_founder, founder_rank)               │
   └───────────────────────────────────────────────────────────┘
        │  full truth returned (server-to-server only)
        ▼
Server Action — D-03/D-04 filter
   if is_new == false:  discard is_founder / founder_rank → neutral response
   if is_new == true:   forward real is_founder / founder_rank
        │
        ▼
Visitor sees: { status: 'success', isFounder, founderRank }
   (duplicate and non-founder-new-signup responses are shape-identical:
    isFounder=false, founderRank=null — the only distinguishing response
    is a genuinely new founder, which is the gratification moment WAIT-05 wants)

waitlist_signups table
   RLS ENABLED, ZERO POLICIES  →  anon/authenticated SELECT returns [] (DATA-05)
                                →  anon/authenticated INSERT/UPDATE errors (no policy permits it)
   Only door in: the three SECURITY DEFINER RPCs above, all service_role-only

app_config table (shared, same deny-all pattern)
   'waitlist_reveal_threshold' → read by get_waitlist_founder_status()
   (phase 4 will add 'credit_gate_cap_enabled' here later — no schema change needed then)
```

### Recommended Project Structure
```
supabase/migrations/
└── 20260812_waitlist_founder_offer.sql   # single migration: app_config, waitlist_signups,
                                            # waitlist_founder_seq, normalize_waitlist_email(),
                                            # claim_waitlist_signup(), get_waitlist_founder_status(),
                                            # anonymize_waitlist_signup(), all REVOKE/GRANT pairs
apps/web/src/actions/
└── waitlist.ts                            # 'use server' — claimWaitlistSpot(), no next/headers()
backend/api/test/rls/
└── waitlist-rls.spec.ts                   # DATA-05 deny-all proof + DATA-04 dedupe proof (admin/anon clients)
apps/web/test/actions/
└── waitlist.concurrency.test.ts           # DATA-02/03 concurrency proof + DATA-07/D-04 non-disclosure proof
                                            # (must import claimWaitlistSpot directly — the actual
                                            #  production path, per D-05's rationale)
```

### Pattern 1: `SECURITY DEFINER` + deny-all RLS as the sole access door
**What:** Table has RLS enabled with zero `CREATE POLICY` statements. All access — read or write —
goes through a function marked `SECURITY DEFINER SET search_path = public`, explicitly
`REVOKE`d from `PUBLIC` and `GRANT`ed only to the specific role that should call it.
**When to use:** Any table needing elevated/atomic logic beyond simple row ownership — this is
already the house pattern for `user_ai_credits`/`ai_credit_transactions` (`026_ai_credits.sql`) and
`coach_invitations`/`coach_client_links` (`035_coach_invitations_links_rls.sql`).
**Example (verified idiom, `is_coach_of`):**
```sql
-- Source: supabase/migrations/035_coach_invitations_links_rls.sql:84-101
CREATE OR REPLACE FUNCTION public.is_coach_of(coach UUID, client UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_client_links
    WHERE coach_id = coach
      AND client_id = client
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) TO authenticated;
```
[VERIFIED: supabase/migrations/035_coach_invitations_links_rls.sql:84-101] — quoted verbatim above.

### Pattern 2: Row-lock vs. `SEQUENCE` for atomic counters
**What:** Two valid house patterns for "assign an atomically-unique, capped value under concurrency."
**When to use `SELECT ... FOR UPDATE`:** When the value being protected is a *mutable balance* that
can go up and down (credits). Verified idiom:
```sql
-- Source: supabase/migrations/026_ai_credits.sql:89-134 (deduct_ai_credits, abridged)
CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_user_id UUID, p_cost INTEGER, p_action_type TEXT, p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Row lock prevents concurrent deductions racing
  SELECT balance INTO v_balance
  FROM public.user_ai_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  ...
$$;
```
[VERIFIED: supabase/migrations/026_ai_credits.sql:89-107] — quoted verbatim above.
**When to use `SEQUENCE` + `nextval()` (this phase's choice, per `research/ARCHITECTURE.md` §1):**
When the value is a *monotonically-assigned rank* that is never decremented. `nextval()` needs no
explicit lock (sequences use their own internal, non-blocking synchronization) and cannot issue the
same value twice under any isolation level — stronger and cheaper than the row-lock pattern for this
specific shape of problem. This is `research/ARCHITECTURE.md` §1's own conclusion; nothing to add.

### Pattern 3: `TEXT + CHECK` instead of native Postgres enums
**What:** Every enumerated column in this schema is `TEXT NOT NULL CHECK (col IN (...))`.
**Verified instances:**
```sql
-- Source: supabase/migrations/034_coach_role_profiles.sql:16-19
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL
    DEFAULT 'client'
    CHECK (role IN ('client', 'coach', 'both'));
```
[VERIFIED: supabase/migrations/034_coach_role_profiles.sql:16-19] — quoted verbatim above.
```sql
-- Source: supabase/migrations/026_ai_credits.sql:186-188
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'premium'));
```
[VERIFIED: supabase/migrations/026_ai_credits.sql:186-188] — quoted verbatim above.
`waitlist_signups.audience` (`'athlete' | 'coach'`) must follow this identical shape, never a native
`CREATE TYPE ... AS ENUM`.

### Anti-Patterns to Avoid
- **`COUNT(*) WHERE is_founder THEN INSERT IF < 200`:** classic TOCTOU under Read Committed — two
  concurrent transactions can both read 199 before either commits. Already rejected in
  `research/ARCHITECTURE.md` §1's concurrency analysis; do not resurrect it.
- **Granting `anon` a table-level `INSERT`/`SELECT` policy "for convenience":** would be the first
  anon-writable surface in the entire schema. D-01 forbids it explicitly.
- **Trusting the RPC's duplicate-branch return value as the client-facing response:**
  `research/ARCHITECTURE.md` §1's original RPC sketch returns the *true* `is_founder`/`founder_rank`
  for a duplicate email (`COALESCE(v_founder, false)`), which was correct advice **before** D-03/D-04
  were decided. That RPC shape is still fine to keep internally (it is server-to-server only), but
  **the Server Action must never forward it uncomputed** — see Pattern in Code Examples below.
- **Duplicating the normalization logic in TypeScript "for a faster client-side check":** D-12 is
  explicit that the guarantee must live only in plpgsql, precisely so no future caller (admin script,
  second action, manual import) can bypass it.
- **Calling `next/headers()` inside this phase's Server Action:** rate limiting (which needs the
  caller's IP) is explicitly deferred to phase 5 (Deferred Ideas). Adding `headers()` now, before
  the rate limiter itself exists, only buys a Next.js request-context dependency this phase's own
  concurrency test cannot satisfy under plain Vitest — see Common Pitfalls and Validation Architecture.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic, gap-tolerant unique-rank assignment under concurrency | A custom "peek-then-increment" counter table with app-level locking | Postgres `SEQUENCE` + `nextval()` | Engine-level guarantee, no lock contention, already the conclusion of `research/ARCHITECTURE.md` §1's own comparison of three alternatives |
| Case-insensitive + sub-address-aware email dedupe | A second normalization implementation in TypeScript, run before calling the RPC "for a fast client-side duplicate warning" | The single plpgsql `normalize_waitlist_email()` helper, called only inside the RPC | D-12 — a second implementation is a drift risk the instant the two disagree on an edge case (e.g. a domain casing bug) |
| Constant-time / non-enumerable API responses | A bespoke timing-normalization wrapper for this one endpoint | The identical shape already proven in `redeem_invitation_code()`/`peek_invitation()` — single `SELECT` gathering all state, single `CASE` classification, one `RETURN` shape for every outcome | Already built and load-bearing-tested in this codebase (`redeem-rpc.spec.ts`'s constant-time p95-variance test) |

**Key insight:** every mechanism this phase needs — atomic counters, deny-all RLS, `SECURITY
DEFINER` grants, constant-shape responses — already has a proven, tested implementation somewhere in
this repo. The work is precise imitation with two intentional deltas (D-11's two-column email design,
D-03/D-04's response filtering), not invention.

## Common Pitfalls

### Pitfall 1: Copying `deduct_ai_credits`'s grant posture literally
**What goes wrong:** A planner reads CONTEXT.md's citation of `deduct_ai_credits` for its
`SECURITY DEFINER SET search_path = public` shape and assumes it also demonstrates the
`REVOKE`/`GRANT` idiom, then skips writing an explicit `REVOKE ... FROM PUBLIC` for the waitlist RPCs.
**Why it happens:** `deduct_ai_credits` genuinely has **no** `REVOKE`/`GRANT` statement anywhere in
`026_ai_credits.sql` [VERIFIED: supabase/migrations/026_ai_credits.sql:89-134, full function body
read, no REVOKE/GRANT present]. By Postgres default, `EXECUTE` on a new function is granted to
`PUBLIC`, so as written this function is reachable via RPC by `anon` today if anything ever calls
it with the anon key.
**How to avoid:** Take the `REVOKE`/`GRANT` idiom only from `is_coach_of`, `redeem_invitation_code`,
`peek_invitation` (all three verified above) — CONTEXT.md's own D-02 already cites exactly these
three, not `deduct_ai_credits`, and that citation is correct. Every waitlist RPC needs its own
explicit `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO service_role;` pair.
**Warning signs:** A new RPC with no `REVOKE`/`GRANT` block at all.

### Pitfall 2: Forwarding the RPC's duplicate-branch truth straight to the client
**What goes wrong:** The Server Action does `return { isFounder: data.is_founder, founderRank:
data.founder_rank }` unconditionally, without checking `data.is_new` first — silently reintroducing
the exact founder-status oracle D-03/D-04 exist to close.
**Why it happens:** `research/ARCHITECTURE.md` §1's RPC sketch computes and returns the true
`is_founder`/`founder_rank` for duplicates (`COALESCE(v_founder, false)`) — correct advice before
this phase's discussion, but the Server Action layer added afterward is easy to skip when
implementing "the happy path" first.
**How to avoid:** The `is_new` check must be the very first thing the Server Action does with the
RPC result, before any other field is read into the response object. See Code Examples below.
**Warning signs:** No test asserts that resubmitting a *known founder's* email returns
`isFounder: false` from the Server Action (not just from the RPC in isolation).

### Pitfall 3: `next/headers()` breaks direct-import testability
**What goes wrong:** The Server Action calls `headers()` from `next/headers` (as `account.ts` and
`coach-identity.ts` both do, for IP-based rate limiting) [VERIFIED: apps/web/src/actions/account.ts:3,
apps/web/src/actions/coach-identity.ts:3]. Outside an actual Next.js request (e.g. a plain Vitest
`import()` in a concurrency test), `headers()` throws because there is no active request context —
this repo's own precedent for testing a `'use server'` file works around exactly this by extracting
the pure logic into a separate module: `safe-next.ts`, tested directly without touching the
`'use server'` file that calls it [VERIFIED: apps/web/test/safe-next.spec.ts:1-6, comment reads
"Mocks Next.js server modules so the 'use server' file can be imported in a node test environment"].
**Why it happens:** Rate limiting is the deferred concern (phase 5), but IP-fetching code is easy to
scaffold "just in case" alongside it.
**How to avoid:** Do not call `next/headers()` anywhere in phase 1's Server Action. Since rate
limiting parameters are explicitly out of scope this phase (Deferred Ideas), there is nothing for
`headers()` to be used for yet — adding it now only creates an untestable dependency this phase's
own concurrency proof (D-05's stated reason for existing) cannot satisfy.
**Warning signs:** `import { headers } from 'next/headers'` anywhere in `apps/web/src/actions/waitlist.ts`.

### Pitfall 4: `test-rls.yml` does not apply new migrations to the TEST project
**What goes wrong:** A migration merges, and the phase's RLS/dedupe tests
(`backend/api/test/rls/waitlist-rls.spec.ts`) are expected to pass in CI automatically — but
`.github/workflows/test-rls.yml` has no `supabase db push` (or equivalent) step; it only sets
`SUPABASE_TEST_URL`/`SUPABASE_TEST_PUBLISHABLE_KEY`/`SUPABASE_TEST_SERVICE_ROLE_KEY` as env vars and
runs `npm run test:rls` directly [VERIFIED: .github/workflows/test-rls.yml:1-52, full file read, no
migration-apply step present].
**Why it happens:** The dedicated `SUPABASE_TEST_*` project's schema state is managed out-of-band
from this workflow — it is not proven anywhere in this repo how/when that project receives new
migrations.
**How to avoid:** Treat "apply this phase's migration to the `SUPABASE_TEST_*` project" as an
explicit manual/checkpoint task before the RLS suite can be trusted to pass in CI — do not assume it
happens automatically. This is a pre-existing repo gap, not something to silently work around.
**Warning signs:** `test:rls` passes locally (against a manually-migrated project) but fails in CI
with "function does not exist" or "relation does not exist" errors.

### Pitfall 5: Sub-addressing normalization asymmetry — over-scoping the dot rule
**What goes wrong:** Implementing the dot-stripping rule for *all* domains instead of only
`gmail.com`/`googlemail.com`, silently merging distinct real addresses at providers where the dot is
significant (e.g. `first.last@outlook.com` vs `firstlast@outlook.com` are genuinely different
mailboxes at Outlook).
**Why it happens:** It is tempting to write one normalization rule instead of two, especially since
the `+`-suffix rule *is* universal.
**How to avoid:** The plpgsql helper must branch: strip `+suffix` unconditionally, then strip `.`
**only if** `v_domain IN ('gmail.com', 'googlemail.com')`. D-10 is explicit about this asymmetry and
explicitly rejected the "blanket dot-stripping" alternative for this exact reason.
**Warning signs:** A single `replace(v_local, '.', '')` call with no domain guard.

## Code Examples

Verified/derived patterns for this phase's own new code:

### `waitlist_signups` DDL (D-01, D-11, D-13, D-14, D-15, D-16)
```sql
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,             -- as typed, used for delivery (D-11)
  email_normalized  TEXT NOT NULL,             -- sub-address-neutralized key (D-10, D-11)
  audience          TEXT NOT NULL CHECK (audience IN ('athlete', 'coach')),
  locale            TEXT CHECK (locale IN ('fr', 'en')),
  utm_source        TEXT,
  utm_campaign      TEXT,
  is_founder        BOOLEAN NOT NULL DEFAULT false,
  founder_rank      INTEGER,
  consent_given_at  TIMESTAMPTZ,               -- D-15, filled by phase 3/5
  consent_version   TEXT,                      -- D-15, filled by phase 3/5
  anonymized_at     TIMESTAMPTZ,               -- D-16, set by anonymize_waitlist_signup()
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')  -- D-13 minimal format net
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email_normalized
  ON public.waitlist_signups (email_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_founder_rank
  ON public.waitlist_signups (founder_rank) WHERE founder_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_audience_created
  ON public.waitlist_signups (audience, created_at DESC);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO CREATE POLICY statements — DATA-05. Matches the deny-all + RPC-door
-- idiom already proven for user_ai_credits/coach_client_links.

CREATE SEQUENCE IF NOT EXISTS public.waitlist_founder_seq;
```

### Normalization helper (D-10, D-12)
```sql
CREATE OR REPLACE FUNCTION public.normalize_waitlist_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_email  TEXT := lower(trim(p_email));
  v_at     INTEGER := position('@' in lower(trim(p_email)));
  v_local  TEXT;
  v_domain TEXT;
BEGIN
  IF v_at = 0 THEN
    RETURN v_email;
  END IF;

  v_local  := substring(v_email from 1 for v_at - 1);
  v_domain := substring(v_email from v_at + 1);

  -- +suffix stripped for ALL domains (D-10)
  v_local := split_part(v_local, '+', 1);

  -- Dots stripped ONLY for Gmail/Googlemail — not universal (D-10, Pitfall 5)
  IF v_domain IN ('gmail.com', 'googlemail.com') THEN
    v_local := replace(v_local, '.', '');
  END IF;

  RETURN v_local || '@' || v_domain;
END;
$$;
```

### `claim_waitlist_signup` RPC (D-01, D-02, D-04, D-12)
```sql
CREATE OR REPLACE FUNCTION public.claim_waitlist_signup(
  p_email        TEXT,
  p_audience     TEXT,
  p_locale       TEXT DEFAULT NULL,
  p_utm_source   TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL
)
RETURNS TABLE(is_new BOOLEAN, is_founder BOOLEAN, founder_rank INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT := public.normalize_waitlist_email(p_email);
  v_id         UUID;
  v_rank       INTEGER;
  v_founder    BOOLEAN;
BEGIN
  INSERT INTO public.waitlist_signups
    (email, email_normalized, audience, locale, utm_source, utm_campaign)
  VALUES
    (lower(trim(p_email)), v_normalized, p_audience, p_locale, p_utm_source, p_utm_campaign)
  ON CONFLICT (email_normalized) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Duplicate. This branch returns the row's TRUE stored status — safe, because this
    -- function is only ever called server-to-server (service_role). The Server Action,
    -- not this RPC, is responsible for D-03/D-04's non-disclosure filtering (Pitfall 2).
    SELECT wl.is_founder, wl.founder_rank INTO v_founder, v_rank
    FROM public.waitlist_signups wl WHERE wl.email_normalized = v_normalized;
    RETURN QUERY SELECT false, COALESCE(v_founder, false), v_rank;
    RETURN;
  END IF;

  -- 200 is a locked business constant (REQUIREMENTS.md "Plafond fondateurs: 200 au total"),
  -- not an app_config value — app_config holds the *reveal threshold* (D-06/D-08), a
  -- different, genuinely-adjustable number.
  v_rank    := nextval('public.waitlist_founder_seq');
  v_founder := v_rank <= 200;

  UPDATE public.waitlist_signups
  SET founder_rank = v_rank, is_founder = v_founder
  WHERE id = v_id;

  RETURN QUERY SELECT true, v_founder, v_rank;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_waitlist_signup(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_signup(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
```

### `get_waitlist_founder_status` RPC (D-06, D-08)
```sql
CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO CREATE POLICY statements — same deny-all idiom as waitlist_signups.

INSERT INTO public.app_config (key, value)
VALUES ('waitlist_reveal_threshold', '30')  -- [ASSUMED — see Assumptions Log A1]
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_waitlist_founder_status()
RETURNS TABLE(should_display BOOLEAN, remaining INTEGER, is_full BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed   INTEGER;
  v_threshold INTEGER;
BEGIN
  SELECT count(*) INTO v_claimed FROM public.waitlist_signups WHERE is_founder;

  SELECT (value::text)::INTEGER INTO v_threshold
  FROM public.app_config WHERE key = 'waitlist_reveal_threshold';
  v_threshold := COALESCE(v_threshold, 30);

  RETURN QUERY SELECT
    (200 - v_claimed) <= v_threshold AS should_display,
    GREATEST(200 - v_claimed, 0)     AS remaining,
    v_claimed >= 200                 AS is_full;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_waitlist_founder_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_waitlist_founder_status() TO service_role;
```
**Reconciliation flag:** `research/ARCHITECTURE.md` §3 assumed the counter would be readable via the
`anon` key + RPC elevation, with a client-side Route Handler calling it directly. D-01's "no anon
grant anywhere in this phase" posture supersedes that — the counter RPC is `service_role`-only here
too, which means phase 5's Route Handler (out of this phase's scope) must call it through the admin
client, not the anon client. This is a smaller change to §3's plan than it looks: swap which key the
already-recommended Route Handler holds.

### `anonymize_waitlist_signup` RPC (D-07, D-16)
```sql
CREATE OR REPLACE FUNCTION public.anonymize_waitlist_signup(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT := public.normalize_waitlist_email(p_email);
  v_updated    INTEGER;
BEGIN
  UPDATE public.waitlist_signups
  SET email            = 'anonymized+' || id::text || '@erased.invalid',
      email_normalized = 'anonymized-' || id::text,
      utm_source       = NULL,
      utm_campaign     = NULL,
      anonymized_at    = NOW()
  WHERE email_normalized = v_normalized AND anonymized_at IS NULL;
  -- founder_rank / is_founder are NEVER touched — this is what keeps FOND-04's
  -- monotonicity guarantee true across an erasure (D-07).

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.anonymize_waitlist_signup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_waitlist_signup(TEXT) TO service_role;
```
Phase 1 delivers the mechanism only — the caller (a support workflow / admin action) is out of scope
per the domain boundary ("the retention *duration* value... phase 3 writes it").

### `apps/web/src/actions/waitlist.ts` — the D-03/D-04 filter (Pitfall 2)
```typescript
'use server';
// Deliberately NO `import { headers } from 'next/headers'` — see Pitfall 3.
import { createAdminClient } from '@/lib/supabase/admin';

export type WaitlistState = {
  status: 'idle' | 'success' | 'error';
  isFounder: boolean;
  founderRank: number | null;
  message: string;
};

export async function claimWaitlistSpot(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const audience = formData.get('audience') as string | null;
  const locale = (formData.get('locale') as string | null) ?? null;

  if (!email || !audience) {
    return { status: 'error', isFounder: false, founderRank: null, message: 'Formulaire invalide.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_waitlist_signup', {
    p_email: email,
    p_audience: audience,
    p_locale: locale,
  });

  if (error || !data?.[0]) {
    return { status: 'error', isFounder: false, founderRank: null, message: 'Une erreur est survenue.' };
  }

  const row = data[0] as { is_new: boolean; is_founder: boolean; founder_rank: number | null };

  // D-03/D-04 — the ONLY place this filtering may happen. A duplicate (is_new === false)
  // NEVER discloses founder status, regardless of what the RPC actually knows.
  if (!row.is_new) {
    return { status: 'success', isFounder: false, founderRank: null, message: 'Inscription confirmée.' };
  }

  return {
    status: 'success',
    isFounder: row.is_founder,
    founderRank: row.is_founder ? row.founder_rank : null,
    message: 'Inscription confirmée.',
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `COUNT(*)`/`ROW_NUMBER()` read-then-decide counters | Postgres `SEQUENCE` + `nextval()` | Decided in this milestone's own research (`research/ARCHITECTURE.md` §1), not an ecosystem-wide shift | Eliminates the exact TOCTOU race class the credit system already had to fix once with row-locking |

No library-version drift is relevant to this phase (no new packages).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `waitlist_reveal_threshold` seeded at `30` (≈15% of 200) | Code Examples — `get_waitlist_founder_status` RPC | Low — `research/SUMMARY.md`'s own Gaps section already flags this exact number as "a reasoned inference, not a sourced number," and D-08/FOND-06 make it changeable via a plain `UPDATE app_config` with no redeploy. Product should confirm the real value before go-live, not before merging this migration. |
| A2 | `service_role` needs an explicit `GRANT EXECUTE` even though Supabase-provisioned projects typically already grant broad default privileges to `service_role` on the `public` schema | Code Examples — all three RPCs | Low — explicit grant is defense-in-depth and matches the house idiom of never relying on implicit privilege; being explicit here cannot break anything, it can only be redundant |

## Open Questions

1. **Does the `SUPABASE_TEST_*` project already have migrations 001–064 + the 2026 dated series
   applied, or does it lag behind `main`?**
   - What we know: `test-rls.yml` runs directly against `SUPABASE_TEST_URL` with no migration-apply
     step in the workflow itself (Pitfall 4).
   - What's unclear: whether some out-of-band process (not visible in this repo) keeps it in sync.
   - Recommendation: the planner should add an explicit checkpoint task — confirm or apply this
     phase's migration to the test project — rather than assuming CI will just work.

2. **Should `waitlist_signups` also carry an `ip_hash` or similar abuse-signal column now, even
   though rate limiting itself is phase 5's job?**
   - What we know: D-01's rationale for the Server Action chokepoint explicitly mentions "gives a
     server-side chokepoint for the rate limiting... that phase 5 will need," implying phase 5 will
     add logic, not necessarily new columns.
   - What's unclear: whether phase 5 will want a column that must exist from row zero (an IP-based
     retroactive analysis) or can be satisfied entirely by Upstash-side rate limiting with no DB
     column at all.
   - Recommendation: do not add such a column in phase 1 — nothing in `01-CONTEXT.md`'s Decisions or
     Discretion sections calls for it, and adding unrequested columns risks a mismatch with whatever
     phase 5 actually decides.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Supabase CLI (`supabase db push`) | Applying the new migration in CI on push to `main` | ✓ (used in `ci.yml`'s `migrate-supabase` job) | `latest` via `supabase/setup-cli@v1` [VERIFIED: .github/workflows/ci.yml:57-59] | — |
| `SUPABASE_TEST_URL`/`SUPABASE_TEST_PUBLISHABLE_KEY`/`SUPABASE_TEST_SERVICE_ROLE_KEY` secrets | `test-rls.yml`'s RLS suite | Unconfirmed from this session — workflow references them but this session cannot verify GitHub Actions secrets exist | — | If absent, `test-rls.yml`'s own comment says it will "fail-skip," per its header comment [VERIFIED: .github/workflows/test-rls.yml:1-8] |
| Vitest v3 | Both new test suites | ✓ — already the house test runner in `backend/api` and `apps/web` | per `backend/api/vitest.config.ts`, `apps/web/vitest.config.ts` | — |

**Missing dependencies with no fallback:** none identified — this phase adds no new external runtime
dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v3 (already configured in both `backend/api` and `apps/web`) |
| Config files | `backend/api/vitest.config.ts` [VERIFIED: read this session — `environment: 'node'`, `fileParallelism: false`, `sequence: { concurrent: false }`], `apps/web/vitest.config.ts` [VERIFIED: read this session — `environment: 'node'`, `globals: true`, no `fileParallelism` override] |
| Quick run command (RLS/dedupe) | `cd backend/api && npm run test:rls -- waitlist-rls.spec.ts` |
| Quick run command (concurrency/non-disclosure) | `cd apps/web && npx vitest run test/actions/waitlist.concurrency.test.ts` |
| Full suite command | `npx turbo run test` (root — runs both packages, matches `ci.yml`'s `verify` job) |

**New pattern this phase introduces:** `apps/web` currently has zero DB-touching tests — its
existing suite is pure unit/component tests plus one mocked-SDK factory test
[VERIFIED: .planning/codebase/TESTING.md web test tree, cross-checked against
`apps/web/test/safe-next.spec.ts` and `apps/web/src/lib/supabase/__tests__/factories.spec.ts`
contents implied by that inventory]. This phase's concurrency test is the first `apps/web` test to
hit a real Supabase instance. `turbo.json`'s `test` task already `passThroughEnv`s `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to every package [VERIFIED: turbo.json:32-40,
quoted: `"passThroughEnv": ["SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY","SUPABASE_SERVICE_ROLE_KEY"]`],
so no `turbo.json` change is needed — but `apps/web/vitest.config.ts` should gain
`fileParallelism: false` (mirroring `backend/api`'s config) if more than one DB-mutating spec file is
added under `apps/web/test/actions/`, to avoid the same sequence-collision risk `backend/api`'s
comment already documents for its own RLS suite.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| DATA-02, DATA-03 | Two simultaneous signups near spot 200 never both get founder status; cap holds under concurrency | integration (real DB, real Server Action) | `npx vitest run test/actions/waitlist.concurrency.test.ts` (apps/web) | ❌ Wave 0 |
| DATA-04 | Case-insensitive + sub-address-normalized dedupe — no duplicate row, no second rank | integration | `npm run test:rls -- waitlist-rls.spec.ts` (backend/api) | ❌ Wave 0 |
| DATA-05 | RLS deny-all — anon/authenticated get zero rows / write errors | integration | `npm run test:rls -- waitlist-rls.spec.ts` (backend/api) | ❌ Wave 0 |
| DATA-01, DATA-06 | Signup fields captured only through the `SECURITY DEFINER` RPC | integration (implicit in the above two suites — asserted via admin-client row inspection) | same two commands above | ❌ Wave 0 |
| DATA-07 (revised) | Duplicate submission never discloses founder status via the **Server Action** response | integration (must go through `claimWaitlistSpot`, not the raw RPC — this is D-05's whole point) | `npx vitest run test/actions/waitlist.concurrency.test.ts` (apps/web) | ❌ Wave 0 |

### Concurrency harness — concretely, how the race is provoked (DATA-02/DATA-03)

Do not attempt to fire 200+ real signups to reach the boundary — instead fast-forward the sequence
deterministically, then race a small batch across it:

```typescript
// apps/web/test/actions/waitlist.concurrency.test.ts
import { afterAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { claimWaitlistSpot } from '../../src/actions/waitlist';

function getAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe('claim_waitlist_signup — 200-cap under concurrency (DATA-02, DATA-03)', () => {
  it('exactly N founders assigned when N calls straddle the boundary', async () => {
    const admin = getAdmin();
    const runId = randomUUID().slice(0, 8);

    // Deterministically fast-forward the sequence so the NEXT nextval() call
    // returns 196 — no need to insert 195 rows to reach the boundary.
    await admin.rpc('exec_sql' /* or a dedicated test-only setval helper RPC */, {
      sql: `SELECT setval('public.waitlist_founder_seq', 195, false);`,
    });

    const CALLS = 20; // ranks 196..215 → exactly 5 should be founders (196-200)
    const forms = Array.from({ length: CALLS }, (_, i) => {
      const fd = new FormData();
      fd.set('email', `race-${runId}-${i}@example.com`);
      fd.set('audience', 'athlete');
      return fd;
    });

    const results = await Promise.all(
      forms.map((fd) => claimWaitlistSpot(
        { status: 'idle', isFounder: false, founderRank: null, message: '' }, fd,
      )),
    );

    const foundersReported = results.filter((r) => r.isFounder).length;
    expect(foundersReported).toBe(5);

    // Prove it at the DB level too — not just via the Server Action's own claim.
    const { data } = await admin
      .from('waitlist_signups')
      .select('founder_rank')
      .like('email', `race-${runId}-%`)
      .eq('is_founder', true);
    expect(data).toHaveLength(5);

    // No rank ever assigned twice, across the whole table, not just this batch.
    const { data: dupes } = await admin.rpc('exec_sql', {
      sql: `SELECT founder_rank, count(*) FROM public.waitlist_signups
            WHERE founder_rank IS NOT NULL GROUP BY founder_rank HAVING count(*) > 1;`,
    });
    expect(dupes).toHaveLength(0);
  });
});
```

**Note on the `setval` helper:** whether the migration ships a small test-only `SELECT
setval(...)` RPC or the test uses `admin.rpc('exec_sql', ...)` (if such a generic helper already
exists in this codebase) is a planning-time decision — this session did not find an existing generic
SQL-exec RPC in the codebase and did not invent one as fact; the planner should either (a) add a
narrowly-scoped, `service_role`-only test-support function in the same migration, gated to only ever
run in the test project, or (b) call `setval` via the Supabase CLI/`psql` in a `beforeAll` hook using
a direct Postgres connection string if one is available in the test environment. Flagged here rather
than silently assumed — see Open Questions is not the right place since this is a test-authoring
detail, not a product question, but the planner must resolve it before this test can be implemented.

### RLS deny-all proof — concretely (DATA-05)

```typescript
// backend/api/test/rls/waitlist-rls.spec.ts
import { describe, expect, it } from 'vitest';
import { getAdminClient, getAnonClient } from './fixtures';

describe('waitlist_signups — deny-all RLS (DATA-05)', () => {
  it('anon SELECT returns zero rows (RLS filters, not an error)', async () => {
    const anon = getAnonClient();
    const { data, error } = await anon.from('waitlist_signups').select('*');
    expect(error).toBeNull();       // RLS filters rows silently for SELECT — no error surfaces
    expect(data).toEqual([]);
  });

  it('anon INSERT is rejected (no policy permits it)', async () => {
    const anon = getAnonClient();
    const { error } = await anon
      .from('waitlist_signups')
      .insert({ email: 'x@example.com', email_normalized: 'x@example.com', audience: 'athlete' });
    expect(error).not.toBeNull();   // no CREATE POLICY exists to permit this write
  });

  it('authenticated (logged-in) user gets the same zero-row/rejected result', async () => {
    // Uses createTestUser() from fixtures.ts — a real authenticated session still
    // has no policy granting access; RLS deny-all applies to every role equally.
  });
});
```

### Case-insensitive dedupe proof — concretely (DATA-04)

```typescript
describe('claim_waitlist_signup — normalized dedupe (DATA-04, D-10)', () => {
  it('case + sub-addressing collapse to one row on Gmail', async () => {
    const admin = getAdminClient();
    const first = await admin.rpc('claim_waitlist_signup', {
      p_email: 'Test.User+promo@GMAIL.com', p_audience: 'athlete',
    });
    const second = await admin.rpc('claim_waitlist_signup', {
      p_email: 'testuser@gmail.com', p_audience: 'athlete',
    });
    expect(first.data[0].is_new).toBe(true);
    expect(second.data[0].is_new).toBe(false);
  });

  it('dot is significant outside Gmail — two distinct rows', async () => {
    const admin = getAdminClient();
    const first = await admin.rpc('claim_waitlist_signup', {
      p_email: 'first.last@outlook.com', p_audience: 'coach',
    });
    const second = await admin.rpc('claim_waitlist_signup', {
      p_email: 'firstlast@outlook.com', p_audience: 'coach',
    });
    expect(first.data[0].is_new).toBe(true);
    expect(second.data[0].is_new).toBe(true); // NOT deduped — Pitfall 5
  });
});
```

### Non-disclosure proof — concretely (DATA-07 / D-04)

This is the one property that **must** go through `claimWaitlistSpot` (the Server Action), not the
raw RPC — otherwise the test proves nothing about the actual attack surface, since a real client
never sees the RPC's raw output:

```typescript
// apps/web/test/actions/waitlist.concurrency.test.ts (same file, separate describe block)
describe('claimWaitlistSpot — non-disclosure of a third party founder status (DATA-07, D-04)', () => {
  it('re-submitting a KNOWN FOUNDER email never reveals it via the Server Action', async () => {
    const admin = getAdmin();
    // Force this email to a known founder rank directly at the DB level for a clean fixture.
    // (Exact setup mechanism left to planning — e.g. seed via admin.rpc('claim_waitlist_signup', ...)
    // after setval-ing the sequence to <200, as in the concurrency test above.)

    const fd = new FormData();
    fd.set('email', 'already-a-founder@example.com');
    fd.set('audience', 'athlete');

    const result = await claimWaitlistSpot(
      { status: 'idle', isFounder: false, founderRank: null, message: '' }, fd,
    );

    // The Server Action must report exactly the same neutral shape a brand-new
    // NON-founder signup would get — no field lets a caller distinguish "already
    // registered founder" from "just joined, not a founder."
    expect(result.isFounder).toBe(false);
    expect(result.founderRank).toBeNull();
    expect(result.status).toBe('success');

    // Prove the DB still knows the truth — only the Server Action's response is filtered.
    const { data } = await admin
      .from('waitlist_signups')
      .select('is_founder')
      .eq('email_normalized', 'already-a-founder@example.com')
      .single();
    expect(data?.is_founder).toBe(true);
  });
});
```

### Sampling Rate
- **Per task commit:** the specific spec file for the task just implemented (e.g.
  `npx vitest run test/actions/waitlist.concurrency.test.ts` after implementing the Server Action).
- **Per wave merge:** `npm run test:rls` (backend/api, full RLS folder) + `cd apps/web && npm test`
  (full apps/web suite).
- **Phase gate:** `npx turbo run test` (root) green, matching `ci.yml`'s `verify` job, before
  `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend/api/test/rls/waitlist-rls.spec.ts` — covers DATA-05 (deny-all) and DATA-04 (dedupe)
- [ ] `apps/web/test/actions/waitlist.concurrency.test.ts` — covers DATA-02/DATA-03 (concurrency cap)
  and DATA-07/D-04 (non-disclosure via the Server Action)
- [ ] A test-only `setval`-capable helper (RPC or direct connection) to deterministically seed the
  sequence near 200 without inserting 195 real rows — resolve the mechanism during planning (see
  concurrency harness note above)
- [ ] `apps/web/vitest.config.ts` — add `fileParallelism: false` if more than one DB-mutating spec
  file lands under `apps/web/test/actions/`
- [ ] Confirm/apply this phase's migration against the `SUPABASE_TEST_*` project before relying on
  `test-rls.yml` to pass in CI (Pitfall 4 / Open Question 1)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Visitors are unauthenticated by design; the Server Action is the trust boundary, not a user session |
| V3 Session Management | No | No session state involved in this phase |
| V4 Access Control | Yes | Deny-all RLS + `SECURITY DEFINER` RPC, `service_role`-only grant — the entire control for this phase |
| V5 Input Validation | Yes (minimal, DB-layer) | `CHECK` constraint on `email` format (D-13) as a last net; richer validation (Zod, disposable-domain) is explicitly phase 5's job — do not build it here |
| V6 Cryptography | No | No cryptographic operation in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| SQL injection via dynamic SQL built from user input | Tampering | Not applicable here by construction — every RPC uses parameterized plpgsql function arguments, no `EXECUTE format(...)` with string-concatenated user input anywhere in this design |
| `SECURITY DEFINER` function reachable by `anon` due to a missing `REVOKE ... FROM PUBLIC` | Elevation of Privilege | Mandatory explicit `REVOKE`/`GRANT` pair on every new RPC — see Pitfall 1, which documents a real existing gap (`deduct_ai_credits`) this phase must not repeat |
| Founder-status oracle via response-shape divergence between new/duplicate signups | Information Disclosure | D-03/D-04's Server Action filter (Pitfall 2) — tested explicitly in Validation Architecture. Residual accepted risk: waitlist *membership* (not founder status) remains inferable, per D-04's explicit, deliberate acceptance |
| Unbounded concurrent signups exhausting all 200 spots via bot/script traffic | Denial of Service (of the scarce resource) | Out of phase 1 scope by design — D-01 provides the chokepoint architecture phase 5's rate limiter will attach to, but phase 1 itself ships with no rate limiting. This is a stated, accepted phase boundary, not an oversight — flag to the planner only to ensure it is not silently treated as "already handled" |

## Sources

### Primary (HIGH confidence — files read directly in this worktree, this session)
- `supabase/migrations/026_ai_credits.sql` — full file read; `deduct_ai_credits` shape, `tier` column,
  confirmed absence of `REVOKE`/`GRANT` on `deduct_ai_credits`
- `supabase/migrations/035_coach_invitations_links_rls.sql` — full file read; `is_coach_of()`,
  `redeem_invitation_code()`, RLS policy shapes, `REVOKE`/`GRANT` idiom
- `supabase/migrations/040_peek_invitation_function.sql` — full file read; third `REVOKE`/`GRANT` instance
- `supabase/migrations/034_coach_role_profiles.sql` — full file read; `TEXT + CHECK` enum convention
- `.github/workflows/ci.yml`, `.github/workflows/test-rls.yml` — full files read; migration-application
  path, RLS suite trigger conditions, absence of a migration-apply step in `test-rls.yml`
- `apps/web/src/lib/supabase/admin.ts`, `apps/web/src/lib/ratelimit.ts`,
  `apps/web/src/actions/account.ts`, `apps/web/src/actions/coach-identity.ts` — full files read
- `backend/api/test/rls/redeem-rpc.spec.ts`, `backend/api/test/rls/fixtures.ts`,
  `apps/web/test/safe-next.spec.ts` — full files read; test-harness conventions this phase must match
- `turbo.json`, `backend/api/vitest.config.ts`, `apps/web/vitest.config.ts` — full files read;
  env-passthrough and test-runner configuration
- `.planning/codebase/TESTING.md` — cross-checked against directly-read files above; used only for
  the test-tree inventory, not for CI claims (that document's CI section is stale, superseded by the
  directly-read `.github/workflows/*.yml` files)

### Secondary (MEDIUM confidence — prior research documents in this workstream)
- `.planning/workstreams/lien-invite/research/ARCHITECTURE.md` §1 — the `SEQUENCE`-based design and
  concurrency analysis, treated as the base design and consolidated here per this task's scope note;
  two deltas flagged explicitly (email-column split, RPC-vs-Server-Action response filtering)
- `.planning/workstreams/lien-invite/research/PITFALLS.md`, `research/SUMMARY.md` — cross-referenced
  for the reveal-threshold's unsourced-inference status (Assumptions Log A1)

### Tertiary (LOW confidence)
- None used — this phase's scope note explicitly rules out ecosystem/web research as unnecessary,
  and no external provider calls were made this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every reused component verified by reading its actual
  source file this session
- Architecture: HIGH — `SECURITY DEFINER`/RLS idiom verified three times against real migrations;
  the two deltas from `research/ARCHITECTURE.md` (email columns, response filtering) are directly
  traceable to `01-CONTEXT.md`'s locked decisions, not invented
- Pitfalls: HIGH for the codebase-specific findings (missing `deduct_ai_credits` grant, `test-rls.yml`
  gap, `next/headers()` testability) — all confirmed by direct file reads, not inference
- Validation architecture: MEDIUM — the test *shapes* are concrete and follow proven house patterns,
  but one implementation detail (the sequence-seeding test helper) is explicitly left open for the
  planner to resolve, not silently assumed

**Research date:** 2026-08-12
**Valid until:** 30 days (stable domain — internal codebase idioms, no external dependency drift risk)
