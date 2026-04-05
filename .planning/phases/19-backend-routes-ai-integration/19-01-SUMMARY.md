---
phase: 19-backend-routes-ai-integration
plan: "01"
subsystem: backend/database
tags: [database, migration, credits, ai-cost, service]
dependency_graph:
  requires: [026_ai_credits.sql, creditService.ts]
  provides: [027_ai_cost_log.sql, getBalanceSummary]
  affects: [backend/api/src/routes/credits.ts (Plan 02)]
tech_stack:
  added: []
  patterns: [parallel-supabase-queries, rls-subselect-cache]
key_files:
  created:
    - supabase/migrations/027_ai_cost_log.sql
  modified:
    - backend/api/src/services/creditService.ts
decisions:
  - "getBalanceSummary runs getBalance and earn-count as parallel Promise.all — avoids N+1 that would occur if calling getQuotaStatus (which itself calls getBalance)"
  - "ai_cost_log uses (SELECT auth.uid()) RLS sub-select pattern from migration 026 for plan cache efficiency"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements: [COST-02]
---

# Phase 19 Plan 01: ai_cost_log Migration + getBalanceSummary Summary

ai_cost_log table (migration 027) created with RLS and two indexes; getBalanceSummary() exported from creditService using parallel Supabase queries for the credits balance endpoint.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create migration 027 — ai_cost_log table | eb3624a | supabase/migrations/027_ai_cost_log.sql |
| 2 | Add getBalanceSummary() to creditService.ts | ae03ce8 | backend/api/src/services/creditService.ts |

## What Was Built

### Migration 027 (supabase/migrations/027_ai_cost_log.sql)

Creates the `ai_cost_log` table for per-call token usage logging:
- Columns: `id` (UUID PK), `user_id` (FK → auth.users, CASCADE), `model`, `input_tokens`, `output_tokens`, `created_at`
- Two indexes: `idx_ai_cost_log_user_created` (user_id, created_at DESC) for per-user queries; `idx_ai_cost_log_created` (created_at DESC) for billing reconciliation
- RLS enabled with `ai_cost_log_own` policy using `(SELECT auth.uid()) = user_id` sub-select caching pattern (same as migration 026)

### getBalanceSummary (backend/api/src/services/creditService.ts)

New exported interface and function:
- `BalanceSummary` interface: `{ balance: number; dailyEarned: number }`
- `getBalanceSummary(userId)`: runs `getBalance(userId)` and today's earn-count query in `Promise.all` — exactly 2 parallel Supabase queries, no N+1
- Avoids calling `getQuotaStatus` which internally calls `getBalance` again (would create N+1 pattern for balance endpoint)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

Threat mitigations T-19-01 and T-19-02 implemented as specified:
- T-19-01 (Information Disclosure): RLS SELECT policy restricts reads to row owner
- T-19-02 (Tampering): RLS WITH CHECK prevents cross-user inserts via client; server uses service key for application-level inserts

No new security surface introduced beyond what is in the plan's threat model.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| supabase/migrations/027_ai_cost_log.sql exists | FOUND |
| backend/api/src/services/creditService.ts exists | FOUND |
| Commit eb3624a (migration 027) | FOUND |
| Commit ae03ce8 (getBalanceSummary) | FOUND |
| export async function getBalanceSummary | FOUND |
| export interface BalanceSummary | FOUND |
