---
phase: 23-web-turborepo-onboarding-auth-bootstrap
plan: "08"
subsystem: vercel-cutover / smoke-deploy / pro-tier-proof
tags: [phase-23, wave-7, vercel-cutover, smoke-deploy, pro-tier-proof, evidence]
dependency_graph:
  requires: [23-06, 23-07]
  provides: [env-template, verification-evidence]
  affects: [apps/web, .planning/phases/23-web-turborepo-onboarding-auth-bootstrap]
tech_stack:
  added: []
  patterns:
    - .env.example template committed to repo (gitignored .env.local not committed)
key_files:
  created:
    - apps/web/.env.example
  modified: []
decisions:
  - "apps/web/.env.example documents all 7 env vars including NEXT_PUBLIC_SITE_URL (found via grep, not in RESEARCH list)"
  - "DEBUG_LIMITS=on is commented out in .env.example — Preview scope only, never committed with real value"
metrics:
  duration: "5m"
  completed_date: "2026-05-15"
  tasks_completed: 1
  files_modified: 1
  status: "PARTIAL — blocked at Task 2 (human-action checkpoint)"
---

# Phase 23 Plan 08: Env Template + Vercel Preview Verification Summary

Partial completion — Task 1 (env template) complete and committed; Task 2 is a blocking human-action checkpoint requiring Vercel dashboard cutover, env var configuration, Supabase test user creation, and curl smoke checks that Claude cannot automate.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Write apps/web/.env.example template + push branch | 1491cf7 | apps/web/.env.example |

## Tasks Pending (Blocking Checkpoint)

| # | Task | Status |
|---|------|--------|
| 2 | Vercel dashboard cutover + Supabase admin test user + curl checks | BLOCKED — human-action required |

## Artifacts

### apps/web/.env.example
Documents all env vars required by apps/web:
- `NEXT_PUBLIC_SUPABASE_URL` — @supabase/ssr client/server/middleware factories
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — @supabase/ssr client/server/middleware factories
- `SUPABASE_URL` — admin.ts GDPR delete (server-only)
- `SUPABASE_SERVICE_ROLE_KEY` — admin.ts GDPR delete (server-only, ESLint-allowlisted)
- `UPSTASH_REDIS_REST_URL` — rate limiting
- `UPSTASH_REDIS_REST_TOKEN` — rate limiting
- `NEXT_PUBLIC_SITE_URL` — layout.tsx, robots.ts, sitemap.ts, locale home page
- `DEBUG_LIMITS` — commented out; Preview scope only; Phase 24 deletes probe

Branch pushed to origin (`gsd/phase-22-schema-foundation-rls-keystone` — branching_strategy: none).
Vercel will auto-deploy a preview on the connected projects.

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Added NEXT_PUBLIC_SITE_URL to .env.example**
- Found during: Task 1 — grep of apps/web/src for process.env references
- Issue: RESEARCH §"Runtime State Inventory" did not list NEXT_PUBLIC_SITE_URL but 4 files reference it (layout.tsx, robots.ts, sitemap.ts, [locale]/page.tsx)
- Fix: Added NEXT_PUBLIC_SITE_URL=https://ziko-app.com to the template with a comment
- Files modified: apps/web/.env.example

## Known Stubs

None — env template is documentation-only with no UI or data-flow stubs.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info-disclosure | apps/web/.env.example | SUPABASE_SERVICE_ROLE_KEY listed — mitigated by placeholder value only, .env.local gitignored |

## Self-Check: PASSED

- apps/web/.env.example: EXISTS, contains NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, UPSTASH_REDIS_REST_URL, DEBUG_LIMITS
- Commit 1491cf7: verified
- Branch pushed to origin: verified
