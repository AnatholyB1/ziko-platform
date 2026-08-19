# Phase 17: DB Foundation + Model Fix - Research

**Researched:** 2026-04-05
**Domain:** PostgreSQL atomic RPC design, Supabase migration patterns, Anthropic model ID management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Transaction types use a full set from day one: `deduct`, `earn`, `welcome`, `daily_base`, `monthly_base`, `admin_adjust`, `premium_grant` — avoids migration churn as Phases 18–21 land
- **D-02:** Balance column is INTEGER — 1 credit = EUR 0.001. The EUR 0.75/month ceiling = 750 credits max monthly spend. No fractional credits.
- **D-03:** `ai_credit_transactions` ledger captures full audit columns: `id`, `user_id`, `type`, `amount`, `source`, `idempotency_key`, `balance_after`, `metadata JSONB`, `created_at` — metadata stores model name, token counts, plugin_id for Phase 19 cost reconciliation
- **D-04:** `balance_after` is computed by a BEFORE INSERT trigger on `ai_credit_transactions` — reads current balance from `user_ai_credits` after the update, guarantees consistency regardless of how rows are inserted
- **D-05:** New users get welcome credits via a **new dedicated trigger** on `auth.users` — separate from the existing `user_profiles` trigger in migration 001. Clean separation of concerns.
- **D-06:** Welcome credit amount is defined as a **single SQL variable/constant** in the migration — tweakable before deploy without editing multiple INSERT statements
- **D-07:** Bulk insert for existing users uses `INSERT ... ON CONFLICT DO NOTHING` — idempotent, safe to re-run
- **D-08:** Grep audit confirms zero occurrences of `claude-3-haiku-20240307` in code (currently true — old ID only appears in planning docs). This audit is the **first commit** of the phase.
- **D-09:** Add `VISION_MODEL = anthropic('claude-haiku-4-5-20251001')` constant ready for Phase 19 vision endpoint
- **D-10:** Extract both `AGENT_MODEL` and `VISION_MODEL` to a shared constants file at `backend/api/src/config/models.ts` — centralized model management as more models get added
- **D-11:** `deduct_ai_credits(p_user_id UUID, p_cost INTEGER, p_action_type TEXT, p_idempotency_key TEXT)` — full atomic signature: check balance, deduct, insert transaction with idempotency, all in one RPC call
- **D-12:** RPC returns JSONB: `{ "success": true, "balance_after": 42 }` on success, `{ "success": false, "balance": 0, "required": 3 }` on insufficient credits — rich return for middleware 402 responses
- **D-13:** RPC is `SECURITY DEFINER` with `SELECT ... FOR UPDATE` row lock — prevents negative balance under Vercel Fluid Compute concurrent requests
- **D-14:** Premium tier bypass (`tier = 'premium'`) is **caller-side** — middleware checks tier before calling the RPC. RPC stays focused on credit math only.

### Claude's Discretion

- RLS policy pattern: use `(SELECT auth.uid())` sub-select caching pattern per requirements (not the older `auth.uid() = user_id` direct call)
- Migration numbering: 026
- Exact welcome credit amount: defined as constant, team decides before deploy
- Transaction type column: TEXT with CHECK constraint vs PostgreSQL ENUM — Claude picks based on migration flexibility

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-06 | User's credits are deducted atomically via PostgreSQL RPC (no negative balance possible) | D-11, D-12, D-13: SECURITY DEFINER RPC with FOR UPDATE lock + CHECK (balance >= 0) constraint |
| CRED-07 | User has a separate AI credits balance from shop coins (dual balance) | `user_ai_credits` table separate from `user_gamification.coins` in migration 007; verified schema segregation |
| PREM-01 | User profile has a tier column (free/premium) — premium users bypass credit gate | ALTER TABLE on `user_profiles`, pattern confirmed in migration 011; D-14: bypass is caller-side |
| COST-01 | Photo scan uses Claude Haiku 4.5 instead of Sonnet (~70% cost reduction) | D-09, D-10: `VISION_MODEL` constant in `backend/api/src/config/models.ts`; model ID `claude-haiku-4-5-20251001` verified |

</phase_requirements>

## Summary

Phase 17 has three parallel tracks that collectively unblock all of v1.4:

1. **Grep-and-replace audit** (D-08). The old Haiku model ID `claude-3-haiku-20240307` has already been confirmed absent from source code — it exists only in planning documents. The audit therefore resolves as a verification commit rather than a find-and-fix operation. The new shared constants file `backend/api/src/config/models.ts` centralizes `AGENT_MODEL` and `VISION_MODEL` for all three backend files that currently inline the Sonnet ID.

2. **Migration 026** (`supabase/migrations/026_ai_credits.sql`). Two new tables (`user_ai_credits` + `ai_credit_transactions`), RLS with the `(SELECT auth.uid())` caching pattern, a `BEFORE INSERT` trigger to compute `balance_after`, a `SECURITY DEFINER` RPC for atomic deduction, and an `ALTER TABLE user_profiles ADD COLUMN tier`. A one-time bulk insert seeds welcome credits for all existing users.

3. **TypeScript constants file** (`backend/api/src/config/models.ts`). A thin file with two exports that all AI routes import from. No new logic — pure refactor of inline strings to named constants. This is Phase 17's entire backend code change.

**Primary recommendation:** Write migration 026 with the RPC returning JSONB per D-12, add the BEFORE INSERT trigger per D-04, then create `models.ts` and update the three import sites. The grep audit is a 1-minute check that should run first.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase PostgreSQL | managed | Credit tables + RLS + RPC | Existing backend datastore; migrations 001–025 already use it |
| `@ai-sdk/anthropic` | ^3.0.58 (installed) | Model constants typed via `anthropic()` helper | Already installed in `backend/api/package.json` |
| `@supabase/supabase-js` | ^2.50.0 (installed) | Backend calls `supabase.rpc('deduct_ai_credits', ...)` | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid-ossp` extension | already enabled | `uuid_generate_v4()` for `id` columns | Used in all 25 existing migrations |
| `pgcrypto` extension | already enabled | `gen_random_uuid()` alternative | Already available, either UUID function acceptable |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TEXT + CHECK for transaction type | PostgreSQL ENUM | TEXT wins: adding new types (e.g. `premium_grant`) requires no migration-within-migration; ENUM type alteration is a table rewrite in older PG versions and requires explicit `ALTER TYPE` in all Supabase PG versions |
| BEFORE INSERT trigger for `balance_after` | Compute in RPC body | Trigger wins per D-04: guarantees consistency regardless of insert path; RPC could be called but a direct insert row would then have NULL in `balance_after` |

**Installation:** No new packages. Phase 17 is pure SQL + TypeScript constant extraction.

**Version verification:** All packages already installed in `backend/api/package.json`. No npm install step needed for this phase.

## Architecture Patterns

### Recommended Project Structure (changes only)

```
backend/api/src/
├── config/
│   └── models.ts          ← NEW: AGENT_MODEL, VISION_MODEL constants
├── routes/
│   ├── ai.ts              ← MODIFIED: import AGENT_MODEL from config/models
│   └── pantry-recipes.ts  ← MODIFIED: import from config/models
└── tools/
    └── ai-programs.ts     ← MODIFIED: import from config/models (2 inline refs)

supabase/migrations/
└── 026_ai_credits.sql     ← NEW: full migration
```

### Pattern 1: Shared Model Constants File

**What:** A single TypeScript file exports typed model constants that all AI routes import.

**When to use:** Any time a model ID string appears in more than one file — prevents drift when model IDs change.

**Example:**
```typescript
// backend/api/src/config/models.ts
import { anthropic } from '@ai-sdk/anthropic';

// Orchestrator agent — all AI chat routes
export const AGENT_MODEL = anthropic('claude-sonnet-4-20250514');

// Vision model — food scan (Phase 19), ready now for Phase 17 COST-01
// claude-haiku-4-5-20251001 replaces deprecated claude-3-haiku-20240307 (retired April 19, 2026)
export const VISION_MODEL = anthropic('claude-haiku-4-5-20251001');
```

```typescript
// backend/api/src/routes/ai.ts — before
const AGENT_MODEL = anthropic('claude-sonnet-4-20250514');

// after
import { AGENT_MODEL } from '../config/models.js';
```

### Pattern 2: Atomic Credit Deduction RPC

**What:** A `SECURITY DEFINER` PostgreSQL function that row-locks, checks balance, deducts, and inserts a ledger row — all within one transaction.

**When to use:** Any credit-gating operation. The RPC is the ONLY path that modifies `user_ai_credits.balance`. Never UPDATE the balance from application code.

**Example:**
```sql
-- Source: Supabase SECURITY DEFINER pattern + EnterpriseDB FOR UPDATE pattern
CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_user_id        UUID,
  p_cost           INTEGER,
  p_action_type    TEXT,
  p_idempotency_key TEXT
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

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'balance', 0, 'required', p_cost);
  END IF;

  IF v_balance < p_cost THEN
    RETURN jsonb_build_object('success', false, 'balance', v_balance, 'required', p_cost);
  END IF;

  -- Relative update — safe under concurrent access
  UPDATE public.user_ai_credits
  SET balance = balance - p_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Ledger row — balance_after populated by BEFORE INSERT trigger (D-04)
  INSERT INTO public.ai_credit_transactions
    (user_id, type, amount, source, idempotency_key, metadata)
  VALUES
    (p_user_id, 'deduct', -p_cost, p_action_type, p_idempotency_key, '{}'::jsonb)
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance - p_cost);
END;
$$;
```

### Pattern 3: RLS with Sub-Select Caching

**What:** All RLS policies on credit tables use `(SELECT auth.uid())` (parenthesized sub-select) rather than bare `auth.uid()`.

**When to use:** Every new RLS policy in this migration. Existing policies in migrations 001–025 use the old form — do not retroactively change them in this migration.

**Example:**
```sql
-- Source: Supabase RLS Performance and Best Practices official docs
-- Fast: cached per statement (up to 99.99% improvement per Supabase benchmarks)
CREATE POLICY "user_ai_credits_own" ON public.user_ai_credits
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "ai_credit_transactions_own" ON public.ai_credit_transactions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

### Pattern 4: BEFORE INSERT Trigger for balance_after (D-04)

**What:** A trigger fires before every insert into `ai_credit_transactions` and reads the current balance from `user_ai_credits` to populate `balance_after`.

**When to use:** All inserts into the ledger table, regardless of caller (RPC, direct backend insert, future earn grants).

**Example:**
```sql
CREATE OR REPLACE FUNCTION public.set_credit_transaction_balance_after()
RETURNS TRIGGER AS $$
BEGIN
  SELECT balance INTO NEW.balance_after
  FROM public.user_ai_credits
  WHERE user_id = NEW.user_id;

  IF NEW.balance_after IS NULL THEN
    NEW.balance_after := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_credit_transaction_balance_after
  BEFORE INSERT ON public.ai_credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_credit_transaction_balance_after();
```

### Pattern 5: Existing-User Bulk Insert (D-07)

**What:** A one-time `INSERT ... SELECT ... ON CONFLICT DO NOTHING` at the end of the migration seeds welcome credits for all existing `auth.users` rows.

**When to use:** Only in migration 026. Safe to re-run due to ON CONFLICT guard.

**Example:**
```sql
-- Welcome credit amount defined once (D-06)
DO $$
DECLARE
  v_welcome_credits INTEGER := 5;  -- tweakable before deploy
BEGIN
  INSERT INTO public.user_ai_credits (user_id, balance)
  SELECT id, v_welcome_credits
  FROM auth.users
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.ai_credit_transactions (user_id, type, amount, source, idempotency_key)
  SELECT id, 'welcome', v_welcome_credits, 'migration_026', 'migration_026_welcome_' || id::text
  FROM auth.users
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;
END;
$$;
```

### Pattern 6: New-User Credit Trigger (D-05)

**What:** A second trigger on `auth.users` (separate from `handle_new_user` in migration 001) fires after new user creation and inserts a `user_ai_credits` row.

**When to use:** This is the only mechanism for new-user credit initialization. The existing `handle_new_user` function must NOT be modified.

**Example:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_welcome_credits INTEGER := 5;
BEGIN
  INSERT INTO public.user_ai_credits (user_id, balance)
  VALUES (NEW.id, v_welcome_credits)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.ai_credit_transactions
    (user_id, type, amount, source, idempotency_key)
  VALUES
    (NEW.id, 'welcome', v_welcome_credits, 'new_user', 'welcome_' || NEW.id::text)
  ON CONFLICT (user_id, source, idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();
```

### Anti-Patterns to Avoid

- **Modifying `handle_new_user` in migration 001:** That trigger is tested and stable. Create a new function/trigger per D-05.
- **Bare `auth.uid()` in RLS policies:** Must use `(SELECT auth.uid())` — the sub-select form allows per-statement result caching; bare form executes per row.
- **`SECURITY DEFINER` without `SET search_path = public`:** Leaves the function vulnerable to schema injection; every SECURITY DEFINER function in this migration must include this clause.
- **Absolute balance UPDATE in application code:** Never `SET balance = 42` from TypeScript. Always use the RPC or a relative SQL update.
- **Adding `tier` to the RPC:** The RPC does credit math only (D-14). Premium bypass is handled by middleware before calling the RPC.
- **Using PostgreSQL ENUM for transaction type:** TEXT + CHECK constraint is more flexible — adding `premium_grant` in Phase 18 requires no `ALTER TYPE`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent deduction safety | JS check-then-update | `SECURITY DEFINER` RPC with `FOR UPDATE` | Two Vercel Fluid Compute requests share module state; only the DB row lock is reliable |
| Idempotent ledger entries | Manual duplicate check in JS | `UNIQUE (user_id, source, idempotency_key)` + `ON CONFLICT DO NOTHING` | Race condition between check and insert; DB constraint is atomic |
| Balance tracking | Application-side running total | `balance_after` column populated by BEFORE INSERT trigger | Single source of truth; auditable even when RPC is bypassed |
| Non-negative balance guarantee | JS `if balance < 0` guard | `CHECK (balance >= 0)` database constraint | Last-resort safety net that fires even if a bug bypasses the RPC |

**Key insight:** Every credit correctness guarantee must live at the PostgreSQL layer. Application-layer guards are complementary, not sufficient, under serverless concurrency.

## Runtime State Inventory

> This phase adds new tables and alters an existing one — not a rename/refactor. Runtime state is scoped to schema additions.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `user_profiles` rows for all existing users — no `tier` column yet | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free'` — existing rows get `'free'` automatically via DEFAULT |
| Stored data | No `user_ai_credits` rows exist for existing users — table does not exist yet | Bulk insert in migration 026 `DO $$ ... $$` block |
| Live service config | None — no external service config references credit tables | None |
| OS-registered state | None | None |
| Secrets/env vars | `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` already in `backend/api/.env` — RPC calls use existing client | None |
| Build artifacts | None relevant | None |

**Key finding:** The `claude-3-haiku-20240307` grep audit confirms zero occurrences in source files. The old ID appears only in `.planning/` documents which are not deployed. The "first commit" per D-08 is therefore a verification commit with a new `models.ts` file — no find-and-replace is needed in production code.

## Common Pitfalls

### Pitfall 1: Negative Balance Under Concurrent Requests

**What goes wrong:** Two AI requests arrive simultaneously. Both read balance = 1. Both pass the JS check `balance >= cost`. Both call UPDATE. One succeeds; the other sets balance = -1 or is rejected by the CHECK constraint with a 500 error instead of a clean 402.

**Why it happens:** Vercel Fluid Compute (default since early 2025) allows a single function instance to handle multiple simultaneous requests. Module-level JS state is shared. Any check-then-update in application code is a TOCTOU race.

**How to avoid:** Use `deduct_ai_credits` RPC exclusively. The `FOR UPDATE` row lock serializes concurrent callers at the PostgreSQL level. The RPC returns `{ success: false }` JSONB — never raises an unhandled exception — so the calling middleware maps it cleanly to HTTP 402.

**Warning signs:** `balance` column showing -1 or -2 in production rows; two simultaneous requests both returning 200 when only one credit remained.

### Pitfall 2: SECURITY DEFINER Without SET search_path

**What goes wrong:** A `SECURITY DEFINER` function resolves table names relative to the calling user's `search_path`. A malicious or misconfigured role creates a `public.user_ai_credits` shadow in a different schema. The function operates on the wrong table.

**Why it happens:** Standard function creation template omits the `SET search_path` clause.

**How to avoid:** Every SECURITY DEFINER function in this migration must include `SET search_path = public` immediately after `LANGUAGE plpgsql`. This is also a Supabase security advisor requirement.

**Warning signs:** Supabase Security Advisor flags "Function with mutable search_path" on the function.

### Pitfall 3: balance_after Trigger Ordering

**What goes wrong:** The BEFORE INSERT trigger on `ai_credit_transactions` reads `user_ai_credits.balance` AFTER the RPC has already updated it. So `balance_after` correctly captures the post-deduction balance. BUT — if someone inserts a deduction ledger row WITHOUT first updating `user_ai_credits` (e.g., a bug or a direct INSERT for testing), `balance_after` will reflect the pre-deduction balance.

**Why it happens:** The trigger reads the current state of `user_ai_credits` at trigger execution time — it does not have access to the transaction's in-flight UPDATE unless the UPDATE is already committed (it is, since both are in the same RPC transaction).

**How to avoid:** The RPC function performs: (1) SELECT FOR UPDATE, (2) UPDATE balance, (3) INSERT ledger row. The BEFORE INSERT trigger fires during step 3, after step 2 has already modified the balance within the same transaction. PostgreSQL's MVCC guarantees the trigger sees the updated row. This ordering is correct and safe.

**Warning signs:** `balance_after` in a ledger row equals the balance BEFORE the deduction — indicates the ledger insert happened before the balance UPDATE.

### Pitfall 4: Idempotency Key Collision

**What goes wrong:** The `UNIQUE (user_id, source, idempotency_key)` constraint is designed to prevent double-deductions. But if `p_idempotency_key` is generated client-side with low entropy (e.g., timestamp-only, or a non-UUID), two genuinely different requests could share the same key and one would silently be skipped.

**Why it happens:** The idempotency key design is the caller's responsibility. The DB constraint enforces uniqueness but does not validate key quality.

**How to avoid:** For deductions, the idempotency key should be the UUID of the resource being accessed (e.g., conversation_id + turn_number, or a UUID generated per-request on the server). For Phase 17 specifically, the RPC itself is not called from any route yet — the constraint is being designed correctly for when Phase 18 wires it. The idempotency key design is documented here for the planner.

**Warning signs:** A legitimate deduction is silently skipped (ON CONFLICT DO NOTHING) because a previous request used the same key for a different operation.

### Pitfall 5: ALTER TABLE on user_profiles Locks the Table

**What goes wrong:** `ALTER TABLE user_profiles ADD COLUMN tier TEXT DEFAULT 'free'` on a large table with existing rows rewrites all rows to fill in the default. In PostgreSQL 11+, adding a column with a NOT NULL DEFAULT is instant (metadata-only). Adding a nullable column with a DEFAULT is also instant in PostgreSQL 11+.

**Why it happens:** This is a PostgreSQL 10 or earlier concern. Supabase runs PostgreSQL 15+. This is not a real risk for this project.

**How to avoid:** Use `ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free'`. The `IF NOT EXISTS` guard makes the migration idempotent. No table lock issue on Supabase PostgreSQL 15.

**Warning signs:** Supabase migration dashboard shows "migration pending" or a timeout on the ALTER TABLE step — would indicate an older PostgreSQL version (not applicable here).

## Code Examples

Verified patterns from official sources and existing migrations.

### Full Migration Structure (026_ai_credits.sql outline)

```sql
-- Source: Existing migrations 001–025 pattern + Supabase RLS docs + PostgreSQL FOR UPDATE docs

-- 1. user_ai_credits table
CREATE TABLE IF NOT EXISTS public.user_ai_credits (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_ai_credits_own" ON public.user_ai_credits
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 2. ai_credit_transactions ledger (D-03)
CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN (
                     'deduct', 'earn', 'welcome', 'daily_base',
                     'monthly_base', 'admin_adjust', 'premium_grant'
                   )),  -- TEXT over ENUM for migration flexibility
  amount           INTEGER NOT NULL,
  source           TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL,
  balance_after    INTEGER,  -- populated by BEFORE INSERT trigger (D-04)
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source, idempotency_key)
);

CREATE INDEX idx_credit_tx_user ON public.ai_credit_transactions(user_id, created_at DESC);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_credit_transactions_own" ON public.ai_credit_transactions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3. balance_after trigger (D-04)
-- [see Pattern 4 above]

-- 4. deduct_ai_credits RPC (D-11, D-12, D-13)
-- [see Pattern 2 above]

-- 5. new-user credit trigger (D-05)
-- [see Pattern 6 above]

-- 6. tier column on user_profiles (PREM-01)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'premium'));

-- 7. bulk welcome insert for existing users (D-06, D-07)
-- [see Pattern 5 above]
```

### models.ts File (D-10)

```typescript
// Source: Existing pattern at backend/api/src/routes/ai.ts L51
// File: backend/api/src/config/models.ts
import { anthropic } from '@ai-sdk/anthropic';

/** Orchestrator agent — all AI chat, tool execution, and program generation routes */
export const AGENT_MODEL = anthropic('claude-sonnet-4-20250514');

/**
 * Vision model — food scan (Phase 19 /ai/scan endpoint).
 * claude-haiku-4-5-20251001 replaces deprecated claude-3-haiku-20240307
 * (retired April 19, 2026 — Anthropic official announcement).
 * ~70% cost reduction vs Sonnet for vision tasks (COST-01).
 */
export const VISION_MODEL = anthropic('claude-haiku-4-5-20251001');
```

### Import Update Pattern (3 files)

```typescript
// backend/api/src/routes/ai.ts — remove local constant, add import
// REMOVE:  const AGENT_MODEL = anthropic('claude-sonnet-4-20250514');
import { AGENT_MODEL } from '../config/models.js';

// backend/api/src/tools/ai-programs.ts — 2 occurrences of inline anthropic() call
// REMOVE:  model: anthropic('claude-sonnet-4-20250514'),  (lines 68 and 169)
import { AGENT_MODEL } from '../config/models.js';
// REPLACE both inline calls with: model: AGENT_MODEL,

// backend/api/src/routes/pantry-recipes.ts — line 125
// REMOVE:  model: anthropic('claude-sonnet-4-20250514'),
import { AGENT_MODEL } from '../config/models.js';
// REPLACE with: model: AGENT_MODEL,
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid() = user_id` in RLS | `(SELECT auth.uid()) = user_id` | Supabase RLS perf guide 2024 | Up to 99.99% improvement on tables with many rows per user (cached per statement) |
| `claude-3-haiku-20240307` | `claude-haiku-4-5-20251001` | April 19, 2026 retirement | Old ID will hard-fail on that date; new ID is current Haiku 4.5 |
| `ALTER TABLE ADD COLUMN` locks table (PG 10) | Instant in PG 11+ with DEFAULT | PostgreSQL 11, 2018 | No-op concern on Supabase PG 15 — migration is safe without CONCURRENTLY |
| Inline model ID strings in each route | Centralized `config/models.ts` | This phase | Model updates in one file, not three |

**Deprecated/outdated:**
- `claude-3-haiku-20240307`: Retired April 19, 2026 — any remaining reference causes API failures from that date.
- PostgreSQL ENUM for short value sets: TEXT + CHECK is preferred in Supabase migrations when the value set may grow — `ALTER TYPE` is DDL that requires exclusive lock in some PG versions.

## Open Questions

1. **Welcome credit amount (D-06)**
   - What we know: Defined as a `DO $$ DECLARE v_welcome_credits INTEGER := 5; $$` constant — tweakable before deploy
   - What's unclear: The specific value (5 credits) is a business decision, not a technical one
   - Recommendation: Plan leaves this as a named constant `v_welcome_credits := 5` per CONTEXT.md default; team can change before running migration

2. **`tier` column: NOT NULL DEFAULT 'free' vs nullable**
   - What we know: CONTEXT.md says "existing rows read as 'free' with no migration data loss"
   - What's unclear: Whether `NOT NULL` is safe to add in the same migration as the DEFAULT
   - Recommendation: `NOT NULL DEFAULT 'free'` is safe in PostgreSQL 11+ because the DEFAULT satisfies the NOT NULL constraint for all existing rows — no row rewrite needed. Use `NOT NULL DEFAULT 'free'` for stronger data integrity.

3. **`balance_after` for the first deduction after a `balance = 0` return**
   - What we know: The RPC returns `{ success: false }` without inserting a ledger row when balance is insufficient
   - What's unclear: Should rejected deduction attempts be logged to `ai_credit_transactions` for audit purposes?
   - Recommendation: Do NOT log rejected deductions. The `ON CONFLICT DO NOTHING` in the RPC already handles idempotency for successful deductions. Logging rejected attempts adds noise to the audit trail with no recovery value. This is consistent with D-12 (RPC returns JSONB, no exception raised for insufficient credits).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project | Migration 026 | ✓ | PostgreSQL 15 (managed) | — |
| `@ai-sdk/anthropic` | `models.ts` constants | ✓ | ^3.0.58 (installed) | — |
| `@supabase/supabase-js` | Future RPC calls | ✓ | ^2.50.0 (installed) | — |
| Node.js / tsx | TypeScript compile | ✓ | dev environment | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — `backend/api/package.json` has no `vitest`, `jest`, or test script |
| Config file | None — Wave 0 must add vitest |
| Quick run command | `npm run test` (after Wave 0 installs vitest) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-06 | `deduct_ai_credits` RPC returns `{ success: false }` when balance = 0, never negative | manual-only (requires live Supabase) | Run migration + Supabase SQL Editor test | ❌ Wave 0 |
| CRED-06 | `CHECK (balance >= 0)` constraint rejects direct UPDATE that would produce negative | manual-only (requires live Supabase) | Supabase SQL Editor | ❌ Wave 0 |
| CRED-07 | `user_ai_credits` table exists and is separate from `user_gamification.coins` | smoke | `npm run type-check` (schema types) | ❌ Wave 0 |
| PREM-01 | `user_profiles.tier` column exists with DEFAULT 'free'; existing rows read as 'free' | manual-only (requires live Supabase) | Supabase SQL Editor SELECT | ❌ Wave 0 |
| COST-01 | `models.ts` exports `VISION_MODEL` using `claude-haiku-4-5-20251001` | unit | `grep -r 'claude-haiku-4-5-20251001' backend/api/src/config/models.ts` | ❌ Wave 0 |
| COST-01 | No inline `anthropic('claude-sonnet-4-20250514')` remaining in ai.ts, ai-programs.ts, pantry-recipes.ts | unit | `grep -rn "anthropic('" backend/api/src/routes backend/api/src/tools` | ❌ Wave 0 |
| All | TypeScript compiles with new import paths | smoke | `npm run type-check` in `backend/api/` | ✅ exists |

**Note on test strategy:** CRED-06 and PREM-01 are database-level guarantees that require a live Supabase instance to verify. They cannot be unit-tested in isolation. The primary verification method is running the migration against Supabase and executing the verification SQL queries listed in the plan. The `CHECK (balance >= 0)` constraint and `FOR UPDATE` lock are PostgreSQL features — no custom test code is needed, only proof that the migration ran successfully.

### Sampling Rate

- **Per task commit:** `rtk tsc` (type-check) in `backend/api/` — catches import path errors immediately
- **Per wave merge:** `rtk tsc` + grep audit for old model IDs
- **Phase gate:** All manual verification SQL queries pass in Supabase SQL Editor before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/api/src/config/models.ts` — file does not exist yet (created in this phase)
- [ ] Supabase migration `026_ai_credits.sql` — does not exist yet (created in this phase)
- [ ] Vitest not installed — for future test phases; Phase 17 verification is SQL-based and type-check based, not unit test based

## Project Constraints (from CLAUDE.md)

Key directives from `CLAUDE.md` that apply to this phase:

| Directive | Impact on Phase 17 |
|-----------|-------------------|
| Model: `claude-sonnet-4-20250514` (orchestrator) | `AGENT_MODEL` constant must use this exact ID |
| `@ai-sdk/anthropic` + Vercel AI SDK v6 | `anthropic('model-id')` syntax is correct for both `AGENT_MODEL` and `VISION_MODEL` |
| AI SDK v6 differences: `inputSchema`, `stopWhen: stepCountIs(n)`, `input`/`output` | Not relevant to this phase (no new AI route logic) |
| Supabase migrations: sequential numbering, self-contained with IF NOT EXISTS | Migration must be named `026_ai_credits.sql`; all DDL must use `IF NOT EXISTS` guards |
| RLS policy pattern: `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING (auth.uid() = user_id)` | This phase upgrades to `(SELECT auth.uid())` sub-select form for new tables — existing tables not touched |
| Backend local: `http://localhost:3000` | No env change needed for this phase |
| `SUPABASE_PUBLISHABLE_KEY` (not SERVICE_KEY) | Existing client setup in `routes/ai.ts` already uses the correct key pattern |

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/001_initial_schema.sql` — `handle_new_user` trigger pattern, RLS policy structure, `uuid_generate_v4()` usage
- `supabase/migrations/007_gamification_schema.sql` — `user_gamification` table (dual balance reference), `coin_transactions` ledger pattern, existing RLS policy format
- `supabase/migrations/011_name_fr.sql` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern used in this project
- `supabase/migrations/025_storage_buckets.sql` — confirmed latest migration number (026 is next)
- `backend/api/src/routes/ai.ts` L51 — `AGENT_MODEL` definition to move; confirmed `anthropic('claude-sonnet-4-20250514')`
- `backend/api/src/tools/ai-programs.ts` L68, L169 — two inline Sonnet references to centralize
- `backend/api/src/routes/pantry-recipes.ts` L125 — third inline Sonnet reference to centralize
- `backend/api/package.json` — confirmed installed packages; no vitest/jest; no new packages needed
- `.planning/research/SUMMARY.md` — credit system architecture, atomic RPC rationale, Haiku model details
- `.planning/research/PITFALLS.md` — race condition analysis, RLS performance, SECURITY DEFINER requirements
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(SELECT auth.uid())` sub-select caching, up to 99.99% improvement (cited in project research)
- [EnterpriseDB: PostgreSQL Anti-Patterns Read-Modify-Write](https://www.enterprisedb.com/blog/postgresql-anti-patterns-read-modify-write-cycles) — `FOR UPDATE` pattern, relative UPDATE (cited in project research)
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — `claude-haiku-4-5-20251001` confirmed current; `claude-3-haiku-20240307` retired April 19, 2026 (cited in project research)

### Secondary (MEDIUM confidence)

- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) — concurrent requests on same instance; rationale for DB-level locking over application-level guards (cited in project research)
- [Vercel AI SDK GitHub issue #9921](https://github.com/vercel/ai/issues/9921) — token usage normalization inaccuracies (cited in project research, relevant for Phase 19 cost tracking)

### Tertiary (LOW confidence)

None — all findings for this phase are HIGH confidence from first-party source files and official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed; verified from `package.json`
- Architecture patterns: HIGH — all patterns derived from existing migrations 001–025 + official PostgreSQL/Supabase docs
- Pitfalls: HIGH — critical pitfalls sourced from official Vercel, Supabase, and PostgreSQL documentation
- Model ID facts: HIGH — confirmed from Anthropic official docs; current codebase grep confirms no old ID in source

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (model IDs and Supabase patterns are stable; the April 19 deadline is the only time-sensitive item)
