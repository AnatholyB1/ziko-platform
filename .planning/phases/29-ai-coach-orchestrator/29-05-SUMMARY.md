---
phase: 29-ai-coach-orchestrator
plan: "05"
subsystem: backend/email
tags: [email, resend, react-email, cron, weekly-digest, workspace-package]
dependency_graph:
  requires:
    - 29-02 (monitor-cron route + coach_alerts table — stub replaced here)
    - resend npm package (installed in backend/api)
    - @react-email/components (installed via packages/email deps, hoisted to root)
  provides:
    - packages/email — @ziko/email workspace package with WeeklyDigest React Email template
    - sendWeeklyDigest() — Resend-backed email send in backend/api/src/coach/ai/service.ts
    - Monday digest path in monitor-cron — collects week's coach_alerts, sends email, skips when RESEND_API_KEY absent
  affects:
    - backend/api/package.json (resend + @ziko/email added)
    - backend/api/tsconfig.json (jsx:react-jsx added)
    - backend/api/src/coach/ai/service.ts (Monday stub replaced with full email path)
tech_stack:
  added:
    - resend@^6.12.3 (backend/api — email delivery SDK)
    - "@react-email/components@^1.0.12" (packages/email — JSX email template primitives)
  patterns:
    - React Email template rendered to HTML string via render() from @react-email/components
    - RESEND_API_KEY guard — graceful skip (no throw) when key is absent
    - Email only to coach's own registered email (auth.admin.getUserById) — never to client
key_files:
  created:
    - packages/email/package.json
    - packages/email/tsconfig.json
    - packages/email/src/templates/WeeklyDigest.tsx
  modified:
    - backend/api/package.json
    - backend/api/tsconfig.json
    - backend/api/src/coach/ai/service.ts
decisions:
  - "Used render() from @react-email/components (re-exports @react-email/render) — async, returns Promise<string> — not renderAsync"
  - "Removed @types/react devDep from packages/email to avoid React 18 vs 19 type mismatch; uses root-hoisted @types/react@19"
  - "jsx:react-jsx added to backend/api tsconfig (was missing) — required for React Email templates to compile through tsc --noEmit"
  - "packages/email exports mapped ./src/templates/WeeklyDigest.js to tsx source file (tsx resolves .js to .tsx at runtime)"
  - "coach display name fetched in parallel with coach_client_links at cron loop start via coach_profiles query"
metrics:
  duration: "35 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 29 Plan 05: Email Package + Weekly Digest Summary

**One-liner:** @ziko/email workspace package with WeeklyDigest React Email template wired into Monday monitor-cron via Resend, with graceful RESEND_API_KEY skip guard.

## What Was Built

### Task 1: Install resend + create packages/email workspace

- `resend@^6.12.3` installed in `backend/api/` (added to dependencies)
- `@react-email/components@^1.0.12` installed via `packages/email` (hoisted to root node_modules)
- `packages/email/` directory scaffolded with `src/templates/` subdirectory

### Task 2: packages/email scaffold + WeeklyDigest template + service.ts Monday email wiring

**`packages/email/package.json`**:
- Name: `@ziko/email`, version 0.1.0, type: module
- Exports `./src/templates/WeeklyDigest.js` mapped to TSX source (tsx-compatible)
- Dependencies: `@react-email/components@^1.0.12`
- No local `@types/react` — uses root-hoisted React 19 types to avoid type mismatch

**`packages/email/tsconfig.json`**:
- `jsx: "react-jsx"`, `module: "ESNext"`, `moduleResolution: "bundler"`, strict mode

**`packages/email/src/templates/WeeklyDigest.tsx`**:
- React Email template using `Html, Body, Head, Container, Section, Text, Button, Hr, Link` from `@react-email/components`
- Props: `coachName`, `weekLabel`, `alertClients: AlertClient[]`, `okClientNames: string[]`, `dashboardUrl`
- Alert clients section: severity badge (PRIORITE HAUTE / A SURVEILLER / A NOTER), client name, summary, deep-link "Analyser {name} →"
- OK clients section: green block listing names + "RAS"
- CTA button: "Ouvrir le tableau de bord →" in `#FF5C1A` orange
- Footer: "Cet email est genere automatiquement par Ziko IA."
- Subject line matches copywriting contract (plan's 29-UI-SPEC.md)
- Light sport theme: background `#F7F6F3`, white card, `#FF5C1A` ZIKO logo/button

**`backend/api/src/coach/ai/service.ts`** — Monday digest path:
- New imports: `Resend` from `resend`, `render` from `@react-email/components`, `WeeklyDigest` + `AlertClient` from `@ziko/email`
- `getWeekLabel()` — computes formatted week range string (e.g., "19 au 25 mai 2026") in French
- `sendWeeklyDigest(params)` — RESEND_API_KEY guard; renders WeeklyDigest via `render()`; sends via `resend.emails.send()` with correct subject; logs skip when key absent (T-29-17)
- Monday cron path replaces stub: fetches coach email via `supabase.auth.admin.getUserById(coachId)` (T-29-16), queries `coach_alerts` for the week, maps `user_profiles` for client names, builds `AlertClient[]` and `okClientNames[]`, calls `sendWeeklyDigest()`
- Digest errors caught with `try/catch` — never abort other coach processing
- Coach profile `display_name` fetched in parallel with `coach_client_links` at loop start

**`backend/api/tsconfig.json`**:
- Added `"jsx": "react-jsx"` — required for tsc to compile React Email JSX (T-29-18 mitigation)

## Commits

| Hash | Message |
|------|---------|
| 34bb704 | feat(29-05): scaffold @ziko/email workspace package with WeeklyDigest template |
| dc7d702 | feat(29-05): wire sendWeeklyDigest into monitor-cron service with Resend + graceful skip |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed @types/react@18 devDep from packages/email — React 19 type mismatch**
- Found during: Task 2 (TypeScript compile check)
- Issue: packages/email originally included `"@types/react": "^18.0.0"` in devDependencies, which npm installed locally in `packages/email/node_modules/@types/react`. This caused a `bigint is not assignable to ReactNode` type conflict with the root-hoisted `@types/react@19.x`, producing ~30 TS2786 errors on every React Email component.
- Fix: Removed `@types/react` devDependency from packages/email/package.json; deleted `packages/email/node_modules` — template now uses root-hoisted React 19 types which match `@react-email/components`' peer dependency
- Files modified: `packages/email/package.json`

**2. [Rule 2 - Missing Critical] Added jsx:react-jsx to backend/api/tsconfig.json**
- Found during: Task 2 (TypeScript compile check)
- Issue: T-29-18 mitigation required `"jsx":"react-jsx"` in backend/api/tsconfig.json; it was absent, causing the plan's own verification step to fail
- Fix: Added `"jsx": "react-jsx"` to compilerOptions in `backend/api/tsconfig.json`
- Files modified: `backend/api/tsconfig.json`

## Known Stubs

None — weekly digest email send is fully wired. The only remaining user-setup is:
- Add `RESEND_API_KEY` to Vercel env vars (resend.com → Dashboard → API Keys)
- Verify sending domain `ziko-app.com` in Resend dashboard (or use sandbox for dev)

## Threat Flags

No new threat surface beyond the plan's threat model. T-29-16, T-29-17, T-29-18 all mitigated:
- T-29-16: Email sent only to `coachEmail` from `auth.admin.getUserById` — never to client
- T-29-17: Monday-only + RESEND_API_KEY guard — graceful no-op when key absent
- T-29-18: jsx:react-jsx added to backend/api/tsconfig.json

## Self-Check: PASSED

**Files exist:**
- `packages/email/package.json` — FOUND, name "@ziko/email"
- `packages/email/tsconfig.json` — FOUND
- `packages/email/src/templates/WeeklyDigest.tsx` — FOUND, exports WeeklyDigest

**Commits exist:**
- 34bb704 — FOUND
- dc7d702 — FOUND

**Done criteria:**
- TypeScript compiles cleanly in backend/api — PASS (npx tsc --noEmit: no output)
- packages/email/package.json contains "@ziko/email" — PASS
- WeeklyDigest.tsx exports WeeklyDigest — PASS (grep: `export { WeeklyDigest }`)
- service.ts contains "RESEND_API_KEY" check — PASS (3 occurrences)
- service.ts contains "isMonday" day check — PASS (2 occurrences)
