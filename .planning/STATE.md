---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Système de Crédits IA & Monétisation
status: planning
stopped_at: Phase 17 context gathered
last_updated: "2026-04-05T12:11:41.893Z"
last_activity: 2026-04-05 — v1.4 roadmap created (Phases 17–21)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and controls AI costs through gamified engagement.
**Current focus:** v1.4 — Phase 17: DB Foundation + Model Fix

## Current Position

Phase: 17 of 21 (DB Foundation + Model Fix)
Plan: — of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-05 — v1.4 roadmap created (Phases 17–21)

Progress: [░░░░░░░░░░] 0% (v1.4 milestone — 0/5 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.4)
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.4 Roadmap]: `deduct_ai_credits` must be a SECURITY DEFINER RPC with `SELECT ... FOR UPDATE` row lock — application-layer check-then-deduct produces negative balances under Vercel Fluid Compute concurrent requests
- [v1.4 Roadmap]: `ai_credit_transactions` requires `UNIQUE (user_id, source, idempotency_key)` with `INSERT ... ON CONFLICT DO NOTHING` — eliminates double-crediting on mobile retry
- [v1.4 Roadmap]: Lazy daily-reset (date-keyed check at earn time) — no cron dependency; avoids Vercel at-least-once cron delivery causing double-resets
- [v1.4 Roadmap]: Redis (Upstash) is rate limiting only — credit balance lives exclusively in Supabase for durable audit trail; never conflate 429 (rate limit) with 402 (credit exhaustion)
- [v1.4 Roadmap]: Phase 20 depends on Phase 18 (not Phase 19) — activity earn hooks need creditService only, not the HTTP routes
- [v1.4 Roadmap]: `claude-3-haiku-20240307` retires April 19, 2026 — grep-and-replace to `claude-haiku-4-5-20251001` must be the first commit of Phase 17

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 17: `claude-3-haiku-20240307` deprecation is a hard calendar deadline (April 19, 2026) — must be resolved in Phase 17 before any other work; failure to grep ALL references causes production failures on that date
- Phase 17: `CREDIT_COSTS` constants must be sized from `messages.countTokens` API calls with the actual system prompt before Phase 18 freezes them — AI SDK v6 `usage` has documented inaccuracies for cache write costs (issue #9921)
- Phase 19: Haiku vision quality on degraded real-world photos is unvalidated — run 50-photo blind test and define Sonnet fallback trigger (Zod parse failure on `ScanResult`) before shipping Haiku-only to production
- Phase 20: Plugin screen audit required at phase start — identify which of 17 plugin screens write directly to Supabase (bypassing tool executors) and must call `POST /credits/earn` from mobile side

## Session Continuity

Last session: 2026-04-05T12:11:41.890Z
Stopped at: Phase 17 context gathered
Resume file: .planning/phases/17-db-foundation-model-fix/17-CONTEXT.md
