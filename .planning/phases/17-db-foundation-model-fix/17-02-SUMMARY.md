---
phase: 17-db-foundation-model-fix
plan: "02"
subsystem: database
tags: [supabase, migration, credits, rls, security-definer]
dependency_graph:
  requires: []
  provides: [user_ai_credits, ai_credit_transactions, deduct_ai_credits, user_profiles.tier]
  affects: [phase-18-credit-service, phase-19-mobile-credit-ui, phase-20-activity-earn, phase-21-monetization]
tech_stack:
  added: []
  patterns: [SECURITY DEFINER RPC, FOR UPDATE row lock, partial unique index, BEFORE INSERT trigger, RLS sub-select caching]
key_files:
  created:
    - supabase/migrations/026_ai_credits.sql
  modified: []
decisions:
  - "SECURITY DEFINER + FOR UPDATE row lock in deduct_ai_credits prevents negative balances under concurrent Vercel Fluid Compute requests"
  - "Partial unique index (WHERE idempotency_key IS NOT NULL) on (user_id, source, idempotency_key) prevents double-crediting on mobile retry"
  - "balance_after stamped by BEFORE INSERT trigger — reads from user_ai_credits after deduct completes, eliminating app-layer race for read-after-write"
  - "handle_new_user_credits is a separate trigger from handle_new_user — keeps credit provisioning decoupled from profile creation"
  - "tier TEXT NOT NULL DEFAULT 'free' on user_profiles — all existing rows migrate to 'free' automatically; Phase 18 reads this for premium bypass"
metrics:
  duration: "1m 37s"
  completed_at: "2026-04-05T12:36:47Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 17 Plan 02: AI Credits DB Foundation Summary

SQL migration 026 establishes the complete PostgreSQL credit system: dual-table balance+ledger architecture with atomic SECURITY DEFINER deduction RPC, balance_after trigger, new-user welcome credits trigger, bulk existing-user seeding, and tier column on user_profiles.

## What Was Built

### Migration 026 — `supabase/migrations/026_ai_credits.sql`

Self-contained, idempotent migration with 7 sections:

1. **`user_ai_credits` table** — UUID primary key, `balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)`, RLS with sub-select caching pattern
2. **`ai_credit_transactions` ledger** — 7 transaction types (`deduct`, `earn`, `welcome`, `daily_base`, `monthly_base`, `admin_adjust`, `premium_grant`), partial idempotency unique index, `balance_after` column populated by trigger
3. **`set_credit_transaction_balance_after` trigger** — BEFORE INSERT on ledger, reads current balance and stamps it on each row
4. **`deduct_ai_credits` RPC** — SECURITY DEFINER, SET search_path, SELECT FOR UPDATE row lock, JSONB return `{success, balance_after}` or `{success, balance, required}`
5. **`handle_new_user_credits` trigger** — AFTER INSERT ON auth.users, provisions 5 welcome credits + welcome transaction row
6. **Bulk seeding** — INSERT INTO user_ai_credits + ai_credit_transactions for all existing auth.users (ON CONFLICT DO NOTHING)
7. **`user_profiles.tier` column** — `TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium'))`

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "CREATE TABLE"` | 2 (user_ai_credits + ai_credit_transactions) |
| `grep -c "ENABLE ROW LEVEL SECURITY"` | 2 |
| `grep -c "SECURITY DEFINER"` | 4 (balance_after fn, deduct RPC, new-user fn, comment) |
| `grep "FOR UPDATE"` | Present |
| `grep "CHECK (balance >= 0)"` | Present |
| `grep "tier TEXT"` | Present |
| `grep "(SELECT auth.uid())"` | Present on both tables |
| `grep "WHERE idempotency_key IS NOT NULL"` | Present (partial index) |

## Deviations from Plan

None — plan executed exactly as written.

The plan explicitly noted the DO block scope issue (v_welcome_credits not accessible inside trigger functions) and provided the corrected structure using a local DECLARE inside the trigger function. Migration was written using the corrected structure directly.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write migration 026 — credit tables, RLS, tier column | 425024b | supabase/migrations/026_ai_credits.sql |
| 2 | Write deduct RPC + welcome credit triggers in migration 026 | 425024b | supabase/migrations/026_ai_credits.sql (verified complete) |

## Known Stubs

None. This is a pure SQL migration — no UI components, no placeholder data. All tables and functions are fully implemented.

## Self-Check: PASSED

- [x] `supabase/migrations/026_ai_credits.sql` exists and is 188 lines
- [x] Commit `425024b` confirmed in git log
- [x] All plan acceptance criteria verified by grep
