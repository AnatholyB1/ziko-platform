# Requirements — v1.5 Coach Platform & CRM

**Milestone:** v1.5 Coach Platform & CRM
**Defined:** 2026-05-13
**Status:** Mapped — roadmap created 2026-05-13 (Phases 22–31, 76/76 REQ-IDs)

This document lists the user-facing capabilities Ziko v1.5 must deliver. Each requirement is atomic, testable, and user-centric. REQ-IDs are stable identifiers used by the roadmap and verification gates.

---

## v1.5 Requirements

### Coach Identity & Onboarding (COACH)

- [ ] **COACH-01**: A user can become a coach via a self-serve signup flow on `ziko-app.com/coach/onboarding` and have their `user_profiles.role` promoted to `coach` or `both` without admin intervention.
- [ ] **COACH-02**: A coach can fill in their public profile (display name, bio, specialties, optional website) and see it persisted in `coach_profiles`.
- [ ] **COACH-03**: A coach can submit optional KYC data (certifications, ID document upload) without blocking access to coach features; KYC status remains `pending` until reviewed.
- [ ] **COACH-04**: A user who is both client and coach (`role='both'`) can access both the athlete app and the coach web CRM with the same account.
- [ ] **COACH-05**: A coach can edit their profile, specialties, and KYC documents from `/coach/settings`.

### Invitations & Coach↔Client Linking (INVITE)

- [ ] **INVITE-01**: A coach can generate a unique 6-character invitation code (format `[A-Z2-9]{6}`) from their dashboard, set its expiration (default 14 days), and copy/share it.
- [ ] **INVITE-02**: A coach can see all their issued invitations with status (active / used / expired / revoked) and revoke any active invitation.
- [ ] **INVITE-03**: An athlete can enter a coach invitation code from the mobile app and have a `coach_client_links` row created with `status='active'`.
- [ ] **INVITE-04**: Invitation code redemption is rate-limited (5 attempts / 15min per IP, 10 attempts / hour per user) and returns constant-time responses regardless of failure reason.
- [ ] **INVITE-05**: An athlete sees a coach profile preview (display name, bio, specialties, photo) before confirming the link.
- [ ] **INVITE-06**: An athlete can revoke an active coach link from their mobile settings in a 2-step confirmation; coach loses read access immediately.
- [ ] **INVITE-07**: An expired or already-used invitation code returns a clear error and cannot create a link.

### CRM Client Management (CLIENT)

- [x] **CLIENT-01**: A coach can see a paginated list of all linked clients on `/coach/clients` with name, photo, last-active timestamp, and quick filters.
- [ ] **CLIENT-02**: A coach can search clients by name and apply roster filters by signal (missed last 2 sessions / measurements not updated >4 weeks / mood declining).
- [x] **CLIENT-03**: A coach can open a client detail page at `/coach/clients/[id]` showing tabs for sessions, measurements, habits, nutrition, sleep, cardio, journal — all read-only.
- [x] **CLIENT-04**: A coach sees an "executive summary" card at the top of the client detail (% weekly compliance, last workout date, latest measurement, mood trend over 14 days).
- [x] **CLIENT-05**: A coach can attach custom text tags to a client (e.g. "Hyrox prep", "recovery phase") via a `coach_client_tags` table; tags are coach-private (never visible to client).
- [x] **CLIENT-06**: A coach can write private notes per client in a dedicated editor (`coach_client_notes` table); notes are coach-private and version-tracked by `updated_at`.
- [x] **CLIENT-07**: A coach can select 3-5 linked clients and view a multi-client comparison chart for any common metric (body weight, 1RM on a lift, weekly volume, sleep hours).
- [x] **CLIENT-08**: A coach can revoke a coach↔client link from their dashboard with a 2-step confirmation; client retains all data but coach loses read access.

### Coaching Programs (PROG)

- [ ] **PROG-01**: A coach can create a workout program template at `/coach/programs/new` with metadata (name, description, goal, weeks count, equipment) persisted as `workout_programs` with `is_template=TRUE` and `created_by_coach_id` set.
- [ ] **PROG-02**: A coach can structure a program as multi-week with multiple sessions per week, each session containing exercises with sets, reps, target RPE (1-10) or RIR (0-5), rest interval; persisted in `workout_programs.weeks_data` JSONB.
- [ ] **PROG-03**: A coach can pick exercises from the existing Ziko exercise library (1000+ entries) or add free-text exercise names not in the library.
- [ ] **PROG-04**: A coach can organize templates into folders (e.g. "Hyrox prep", "Body recomp"); folder structure persisted on each template.
- [ ] **PROG-05**: A coach can duplicate a template (or a single week, or a single session) with a right-click or context-menu action to create variations quickly.
- [ ] **PROG-06**: A coach can assign a template to one or more linked clients in one action; assignment creates a forked copy of the template with `is_template=FALSE`, `assigned_to_user_id` set, and `template_source_id` pointing back to the template.
- [ ] **PROG-07**: A coach can edit an assigned program (per-client customization) without modifying the source template.
- [ ] **PROG-08**: Ziko ships with 5-10 expert-curated seed templates (PPL, 5/3/1, Hyrox prep, body-recomp, beginner full-body, etc.) available to every coach on signup.
- [ ] **PROG-09**: A client can see their assigned program in the mobile app under "Mon coach" and execute its sessions like any workout program (logs into `workout_sessions`).

### AI File Imports (IMPORT)

- [ ] **IMPORT-01**: An authenticated user can upload a workout file (PDF, image PNG/JPEG, Excel `.xlsx`/`.xls`, Word `.docx`) up to 25 MB via a drag-drop UI; file is sent directly to Supabase Storage via a signed URL (no Vercel body-limit blocker).
- [ ] **IMPORT-02**: After upload, the user triggers a parse step that runs Claude vision/document parsing on the file and returns a structured `ImportedProgramSchema` (Zod-validated); parse cost is deducted from AI credits only on success.
- [ ] **IMPORT-03**: The user sees a preview UI showing the extracted program (weeks, sessions, exercises, sets/reps/rest) with confidence score per field; fields with confidence < 70% are highlighted yellow for manual review.
- [ ] **IMPORT-04**: The user can edit any field in the preview before committing, then click "Commit" to create a `workout_programs` row (athlete mode) or a template (coach mode).
- [ ] **IMPORT-05**: An athlete can import their own training file in "athlete mode" — committed program is owned by them and immediately usable.
- [ ] **IMPORT-06**: A coach can import a coaching document in "coach template mode" — committed result is a template with `is_template=TRUE`, ready to assign.
- [ ] **IMPORT-07**: Multi-page PDF programs (up to 30 pages, e.g. 12-week periodized programs) are extracted page-by-page and reassembled into a single structured program.
- [ ] **IMPORT-08**: A user can re-upload a new version of a previously imported file; the UI shows a diff (new/changed/removed weeks/sessions/exercises) before committing.
- [ ] **IMPORT-09**: The import flow is async — the client polls `GET /coach/imports/:id` every 2s and the UI handles parse durations up to 60s without blocking.
- [ ] **IMPORT-10**: Failed imports (parse error, Zod validation failure, file unreadable) display a clear error message and do not deduct credits.

### AI Coach Orchestrator (AIC)

- [ ] **AIC-01**: A coach can chat with the Ziko AI assistant from `/coach/ai` with a context-aware system prompt that knows the coach's linked clients.
- [ ] **AIC-02**: The AI exposes 3 coach tools registered in the tool registry: `analyze_client(client_id, period_days?)`, `generate_coaching_program(client_id, goal, weeks, equipment, ...)`, `monitor_client_alerts(client_id?)`.
- [ ] **AIC-03**: The `analyze_client` tool reads the client's data via RLS-aware queries (never service-role) and returns a structured summary (progression, risks, suggestions).
- [ ] **AIC-04**: The `generate_coaching_program` tool generates a complete multi-week program for a specific client, persisted to `workout_programs` (assigned, NOT template by default), and returns the program ID.
- [ ] **AIC-05**: The `monitor_client_alerts` tool detects concerning patterns (missed sessions, sleep drop, declining mood, RPE inflation) and returns actionable alerts.
- [ ] **AIC-06**: A background job runs `monitor_client_alerts` every 24h for each coach's linked clients and surfaces results in a coach inbox; coach receives optional push notification.
- [ ] **AIC-07**: A coach can click "Adapt this program for [client X]" inline on any template page to open the AI chat with a pre-filled prompt referencing the template and client.
- [ ] **AIC-08**: A coach receives an automated "Weekly digest" email + in-app notification every Monday morning summarizing key points across all linked clients (AI-generated).
- [ ] **AIC-09**: Every coach AI tool invocation is logged to `ai_tool_audit` (timestamp, coach_id, tool_name, target_client_id, args_hash, result_status, conversation_id) for incident response.
- [ ] **AIC-10**: Coach AI usage is credit-gated by the existing v1.4 credit system; cost classes per tool are defined and visible to the coach.

### Strava Integration (STRAVA)

- [ ] **STRAVA-01**: An athlete can connect their Strava account from the mobile app via OAuth (scope: read, activity:read_all) with deep-link callback `ziko://strava/callback`.
- [ ] **STRAVA-02**: Connection persists access_token, refresh_token, expires_at in `strava_accounts` with row-level security limiting access to the user.
- [ ] **STRAVA-03**: New Strava activities are auto-imported into `cardio_sessions` via webhook delivery; each activity is idempotent (UNIQUE on `external_strava_id`).
- [ ] **STRAVA-04**: A backfill of the last 30 days runs on initial connection, throttled by an app-wide rate limiter (max 90 requests / 15 min via Upstash).
- [ ] **STRAVA-05**: A reconciliation cron runs daily at 03:00 UTC to catch missed webhook deliveries and ensure all activities since `last_sync_at` are imported.
- [ ] **STRAVA-06**: If Strava deauthorizes the connection (webhook `aspect_type='delete' && updates.authorized='false'`), the row is marked deauthorized and the mobile app surfaces a "Reconnect" CTA.
- [ ] **STRAVA-07**: An athlete can disconnect Strava from mobile settings; tokens are cleared and webhook is unsubscribed.

### Mobile Athlete UX — "Mon coach" (MOBILE)

- [ ] **MOBILE-01**: An athlete sees a "Mon coach" screen in the mobile app with an empty state showing a code-entry input when no coach is linked.
- [ ] **MOBILE-02**: When linked, the athlete sees the coach card (display name, photo, certifications) plus a today's-session preview from the assigned program.
- [ ] **MOBILE-03**: The athlete sees a "Programme prescrit par [coach name]" badge on workout sessions that come from an assigned coaching program (read-only badge, no editing of the source).
- [ ] **MOBILE-04**: The athlete sees a weekly compliance widget ("75% this week") and can view the coach's latest private note (if shared) below the coach card.
- [ ] **MOBILE-05**: The athlete has a "Revoke coach access" action in mobile settings with a 2-step confirmation that immediately revokes the link.
- [ ] **MOBILE-06**: The athlete can tap a "Contact coach" CTA that opens `mailto:` with the coach's signup email (real-time messaging deferred to v1.6).

### Public Marketing (MKT)

- [ ] **MKT-01**: A non-authenticated visitor can browse `/coachs` (FR) and `/en/coachs` (EN) on ziko-app.com with hero, 3-4 feature blocks, FAQ, and footer.
- [ ] **MKT-02**: The page includes a "Rejoindre la bêta privée" / "Join the private beta" CTA that links to `/coach/onboarding` signup (no pricing displayed).
- [ ] **MKT-03**: The page includes a 60s muted auto-play demo video showing the coach CRM in action.
- [ ] **MKT-04**: The page includes an honest comparison table vs Trainerize / TrueCoach (key features only, no testimonials).
- [ ] **MKT-05**: The page is fully static (SSG via `generateStaticParams` + `setRequestLocale`), CNIL-compliant (self-hosted fonts), and SEO-optimized with OG metadata.
- [ ] **MKT-06**: The page contains a "Built by athletes, for coaches" founder section with the Ziko team mission.

### Cross-Cutting Architecture (ARCH)

- [ ] **ARCH-01**: All v1.5 backend code is structured as 6 bounded-context modules under `backend/api/src/coach/` (`identity`, `clients`, `programs`, `invitations`, `imports`, `ai`); Strava lives at `backend/api/src/integrations/strava/`.
- [ ] **ARCH-02**: Cross-module imports are restricted to each module's `service.ts` entry — ESLint enforces `no-restricted-imports` to block direct `db/*` or `internal/*` imports.
- [ ] **ARCH-03**: All coach AI tools use the per-request user-JWT Supabase client, never the service role; CI grep verifies no `SERVICE_ROLE` reference under `coach/`.
- [ ] **ARCH-04**: A `packages/coach-sdk` package provides shared Zod schemas (`ImportedProgramSchema`, `CoachClientLinkSchema`, `CoachProfileSchema`) consumed by backend, web, and mobile.
- [ ] **ARCH-05**: The Next.js web app exists at `apps/web/` in the Turborepo (onboarded in Phase 2) with `@supabase/ssr` for cookie-based auth and layered auth (middleware refresh + layout `getUser()` + Server Action re-check).
- [ ] **ARCH-06**: All `(coach)` web pages enforce `dynamic = 'force-dynamic'`, `revalidate = 0`, and `cache: 'no-store'` on all Supabase reads to prevent cross-coach cache leakage.
- [x] **ARCH-07**: The `is_coach_of(coach UUID, client UUID)` SECURITY DEFINER STABLE SQL function is the sole pattern for cross-user RLS reads; every coach-readable table gets a separate `FOR SELECT` policy (owner OR is_coach_of), preserving the existing `FOR ALL` (owner only) write policy. *(Delivered by Phase 22-03 — migration 035 ships `is_coach_of` SECURITY DEFINER STABLE + 11 `<table>_coach_read` FOR SELECT policies; existing `<table>_own` FOR ALL policies untouched. Verified by 10 coach-rls tests + 8 redeem-rpc tests, all green.)*
- [ ] **ARCH-08**: Vercel Pro tier is enabled for the `apps/web/` and backend deployments; `/coach/imports/:id/parse` route has `maxDuration = 60` explicit.

### Traceability

Each v1.5 requirement is mapped to exactly one phase. Coverage: 76/76 ✓ (no orphans, no duplicates). Plan column populated by `/gsd-plan-phase` as phases are decomposed.

| REQ-ID | Phase | Plan |
|--------|-------|------|
| COACH-01 | Phase 24 — Coach Identity & Onboarding | TBD |
| COACH-02 | Phase 24 — Coach Identity & Onboarding | TBD |
| COACH-03 | Phase 24 — Coach Identity & Onboarding | TBD |
| COACH-04 | Phase 24 — Coach Identity & Onboarding | TBD |
| COACH-05 | Phase 24 — Coach Identity & Onboarding | TBD |
| INVITE-01 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| INVITE-02 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| INVITE-03 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| INVITE-04 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| INVITE-05 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| INVITE-06 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| INVITE-07 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| CLIENT-01 | Phase 26 — CRM Client Management | 26-02 (listCoachClients + GET / route) |
| CLIENT-02 | Phase 26 — CRM Client Management | TBD |
| CLIENT-03 | Phase 26 — CRM Client Management | 26-03 (7 tab db functions + /:id/[tab] routes) |
| CLIENT-04 | Phase 26 — CRM Client Management | 26-03 (getClientSummary + GET /:id/summary route) |
| CLIENT-05 | Phase 26 — CRM Client Management | 26-02 (coach_client_tags table + tags CRUD routes) |
| CLIENT-06 | Phase 26 — CRM Client Management | 26-02 (coach_client_notes table + notes CRUD routes) |
| CLIENT-07 | Phase 26 — CRM Client Management | 26-03 (listCompareData + GET /compare route) |
| CLIENT-08 | Phase 26 — CRM Client Management | 26-02 (revokeClientLinkByCoach + DELETE /links/:clientId route) |
| PROG-01 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-02 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-03 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-04 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-05 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-06 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-07 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-08 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| PROG-09 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| IMPORT-01 | Phase 28 — AI File Imports | TBD |
| IMPORT-02 | Phase 28 — AI File Imports | TBD |
| IMPORT-03 | Phase 28 — AI File Imports | TBD |
| IMPORT-04 | Phase 28 — AI File Imports | TBD |
| IMPORT-05 | Phase 28 — AI File Imports | TBD |
| IMPORT-06 | Phase 28 — AI File Imports | TBD |
| IMPORT-07 | Phase 28 — AI File Imports | TBD |
| IMPORT-08 | Phase 28 — AI File Imports | TBD |
| IMPORT-09 | Phase 28 — AI File Imports | TBD |
| IMPORT-10 | Phase 28 — AI File Imports | TBD |
| AIC-01 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-02 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-03 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-04 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-05 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-06 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-07 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-08 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-09 | Phase 29 — AI Coach Orchestrator | TBD |
| AIC-10 | Phase 29 — AI Coach Orchestrator | TBD |
| STRAVA-01 | Phase 30 — Strava Integration | TBD |
| STRAVA-02 | Phase 30 — Strava Integration | TBD |
| STRAVA-03 | Phase 30 — Strava Integration | TBD |
| STRAVA-04 | Phase 30 — Strava Integration | TBD |
| STRAVA-05 | Phase 30 — Strava Integration | TBD |
| STRAVA-06 | Phase 30 — Strava Integration | TBD |
| STRAVA-07 | Phase 30 — Strava Integration | TBD |
| MOBILE-01 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| MOBILE-02 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| MOBILE-03 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| MOBILE-04 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| MOBILE-05 | Phase 25 — Invitations & Mobile "Mon coach" Minimal | TBD |
| MOBILE-06 | Phase 27 — Coaching Programs & Mobile "Mon coach" Full | TBD |
| MKT-01 | Phase 31 — Public Marketing `/coachs` | TBD |
| MKT-02 | Phase 31 — Public Marketing `/coachs` | TBD |
| MKT-03 | Phase 31 — Public Marketing `/coachs` | TBD |
| MKT-04 | Phase 31 — Public Marketing `/coachs` | TBD |
| MKT-05 | Phase 31 — Public Marketing `/coachs` | TBD |
| MKT-06 | Phase 31 — Public Marketing `/coachs` | TBD |
| ARCH-01 | Phase 24 — Coach Identity & Onboarding | TBD |
| ARCH-02 | Phase 23 — Web Turborepo Onboarding & Auth Bootstrap | TBD |
| ARCH-03 | Phase 24 — Coach Identity & Onboarding | TBD |
| ARCH-04 | Phase 23 — Web Turborepo Onboarding & Auth Bootstrap | TBD |
| ARCH-05 | Phase 23 — Web Turborepo Onboarding & Auth Bootstrap | TBD |
| ARCH-06 | Phase 23 — Web Turborepo Onboarding & Auth Bootstrap | TBD |
| ARCH-07 | Phase 22 — Schema Foundation & RLS Keystone | 22-03 (delivered 2026-05-14) |
| ARCH-08 | Phase 23 — Web Turborepo Onboarding & Auth Bootstrap | TBD |

**Coverage check:**
- COACH (5) → Phase 24
- INVITE (7) → Phase 25
- CLIENT (8) → Phase 26
- PROG (9) → Phase 27
- IMPORT (10) → Phase 28
- AIC (10) → Phase 29
- STRAVA (7) → Phase 30
- MOBILE (6) → Phases 25 (MOBILE-01, 05) + 27 (MOBILE-02, 03, 04, 06) — split because MOBILE-01/05 only need the link primitive (Phase 25), while MOBILE-02/03/04/06 require an assigned program (Phase 27)
- MKT (6) → Phase 31
- ARCH (8) → Phases 22 (ARCH-07 — RLS keystone) + 23 (ARCH-02, 04, 05, 06, 08 — web/repo tooling) + 24 (ARCH-01, 03 — backend module scaffolding lands when first module is built)

**Total: 76/76 mapped, no orphans, no duplicates.** Phase 22 has 1 requirement (the RLS keystone is intentionally a single foundational ARCH item — the rest of Phase 22's work is infrastructure setup that does not surface as a user-observable REQ-ID but is captured by Phase 22 success criteria #1–5).

---

## Future Requirements (Deferred to v1.6+)

- Real-time messaging coach↔client (chat, push, notifications)
- Coach billing / subscription management (future ERP)
- Coach scheduling / calendar / session planning (future ERP)
- Coach hours tracking + accounting exports (future ERP)
- Mobile-native coach views (Expo) — vue tableau dense
- Coach admin back-office (manual KYC review, abuse moderation)
- Granular per-domain permissions (training-only / training+nutrition / etc.)
- Multi-coach per athlete
- Google Sheets API OAuth import
- Garmin `.fit` file import
- Coach pricing page + testimonials on landing
- AI program marketplace (coach sells templates)
- Real-time collaborative editing of programs
- In-program video upload + moderation

---

## Out of Scope (v1.5, with reasoning)

- **Dark mode** — light sport theme only across the platform (existing decision)
- **CSV/Excel rigid format imports** — replaced by AI file parsing; no stable schema to maintain
- **Strava SDK** — direct fetch + Zod-typed wrappers; available SDKs are unmaintained
- **AG Grid** — bundle size + license tier; TanStack Table covers needs at 14kb gz
- **`pdf-parse`/`pdfjs-dist` raw** — pull `canvas` native deps, break Vercel cold starts (use `unpdf` fallback)
- **SheetJS CE for Excel** — in-memory only, OOM risk; ExcelJS streaming is mandatory
- **Materialized views for client aggregates** — bypass RLS at read time, dangerous in multi-tenant
- **LangChain / direct Anthropic SDK** — Vercel AI SDK v6 already covers it
- **Coach editing of client journals/nutrition/sleep** — breaks trust + GDPR
- **AI medical advice from coach tools** — hard refuse in system prompt
- **AI directly messaging clients on coach's behalf** — liability + trust

---

*Last updated: 2026-05-13 — v1.5 milestone requirements defined + traceability mapped to Phases 22–31*
*Updated: 2026-05-14 — Phase 22 execution complete: ARCH-07 marked delivered by Plan 22-03 (migration 035, 47/47 RLS tests green). 1/76 requirements complete.*
