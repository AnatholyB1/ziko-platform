# Roadmap: Ziko Platform

## Milestones

- [x] **v1.0 Landing Page** — Phases 1–5 (shipped 2026-03-28)
- [x] **v1.1 Smart Pantry Plugin** — Phases 6–9 (shipped 2026-04-02)
- [x] **v1.2 Barcode Enrichment + Tech Debt** — Phases 10–11 (shipped 2026-04-02)
- [x] **v1.3 Security + Cloud Infrastructure** — Phases 12–16 (shipped 2026-04-05)
- [x] **v1.4 Systeme de Credits IA & Monetisation** — Phases 17–21 (shipped 2026-04-29)
- [ ] **v1.5 Coach Platform & CRM** — Phases 22–31 (in progress, started 2026-05-13)

## Phases

<details>
<summary>✅ v1.0 Landing Page (Phases 1–5) — SHIPPED 2026-03-28</summary>

Five phases took the Ziko web marketing site from an empty repo to a publicly-launched product. Phase 1 installed the technical foundation — i18n routing, design tokens, and the static rendering architecture. Phase 2 shipped all RGPD and French legal requirements. Phase 3 built the three marketing sections. Phase 4 hardened SEO metadata. Phase 5 threw the switch: custom domain live, site public.

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-26
- [x] Phase 2: RGPD Compliance (3/3 plans) — completed 2026-03-26
- [x] Phase 3: Marketing Content (3/3 plans) — completed 2026-03-27
- [x] Phase 4: SEO + Performance (3/3 plans) — completed 2026-03-27
- [x] Phase 5: Launch (2/2 plans) — completed 2026-03-28

</details>

<details>
<summary>✅ v1.1 Smart Pantry Plugin (Phases 6–9) — SHIPPED 2026-04-02</summary>

Four phases added the Smart Pantry Plugin to the Ziko mobile app — a kitchen brain with inventory tracking, barcode scan for item lookup, AI macro-aware recipe suggestions, automatic calorie logging to the nutrition plugin, and a rule-based shopping list.

- [x] Phase 6: Smart Inventory (4/4 plans) — completed 2026-03-29
- [x] Phase 7: AI Recipe Suggestions (4/4 plans) — completed 2026-03-29
- [x] Phase 8: Calorie Tracker Sync (3/3 plans) — completed 2026-03-30
- [x] Phase 9: Smart Shopping List (3/3 plans) — completed 2026-04-01

</details>

<details>
<summary>✅ v1.2 Barcode Enrichment + Tech Debt (Phases 10–11) — SHIPPED 2026-04-02</summary>

Two phases enriched the nutrition plugin with Open Food Facts barcode scanning — users can scan any food product and see its Nutri-Score, Eco-Score, macros, and photo before logging. All v1.1 tech debt closed: SHOP-03 quantity prompt, AI tool registry migration, Nyquist VALIDATION.md audit.

- [x] Phase 10: Data Foundation + Tech Debt (3/3 plans) — completed 2026-04-02
- [x] Phase 11: Barcode UI + Score Display (3/3 plans) — completed 2026-04-02

</details>

<details>
<summary>✅ v1.3 Security + Cloud Infrastructure (Phases 12–16) — SHIPPED 2026-04-05</summary>

Five phases secured the Hono backend and added cloud storage infrastructure. Phase 12 provisioned Upstash Redis and added distributed rate limiting (IP + per-user). Phase 13 hardened the API with strict CORS, security headers, and Zod input validation. Phase 14 added Supabase Storage buckets with signed URL uploads. Phase 15 added lifecycle cron cleanup. Phase 16 fixed a middleware regression introduced by Phase 15. Full details in [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md).

- [x] Phase 12: Infra + Rate Limiting (2/2 plans) — completed 2026-04-02
- [x] Phase 13: API Security Hardening (1/1 plans) — completed 2026-04-03
- [x] Phase 14: Supabase Storage (3/3 plans) — completed 2026-04-03
- [x] Phase 15: Lifecycle & Cleanup (1/1 plans) — completed 2026-04-05
- [x] Phase 16: Security Middleware Regression Fix (1/1 plans) — completed 2026-04-05

</details>

<details>
<summary>✅ v1.4 Systeme de Credits IA & Monetisation (Phases 17–21) — SHIPPED 2026-04-29</summary>

Five phases implemented a gamified AI credit system — atomic PostgreSQL credit deduction (SECURITY DEFINER RPC + SELECT FOR UPDATE), `creditService.ts` + `creditCheck`/`creditDeduct` Hono middleware, credit-gated AI routes with token telemetry, Haiku vision migration (~70% cost reduction), fire-and-forget earn hooks on 6 activity types, and a complete mobile credit UI (balance chip, earn toast, exhaustion bottom sheet, dual-balance card, cost labels). Full details in [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md).

- [x] Phase 17: DB Foundation + Model Fix (2/2 plans) — completed 2026-04-05
- [x] Phase 18: Credit Service + Middleware (2/2 plans) — completed 2026-04-05
- [x] Phase 19: Backend Routes + AI Integration (3/3 plans) — completed 2026-04-05
- [x] Phase 20: Activity Earn Hooks (2/2 plans) — completed 2026-04-09
- [x] Phase 21: Mobile UI — Credit Display + Exhaustion UX (2/2 plans) — completed 2026-04-09

</details>

### 🚧 v1.5 Coach Platform & CRM (Phases 22–31) — IN PROGRESS

Ten phases transform Ziko from a single-tenant athlete app into a two-sided platform: a coach-facing CRM on the Next.js web app reading client data via cross-user RLS, athlete-side Strava OAuth, and AI file imports replacing CSV. Three parallelizable lanes: (a) backend identity → invitations → clients → programs → imports → AI; (b) Strava integration (after schema); (c) public marketing landing (after onboarding URL stable). The architectural keystone is `coach_client_links` + a `SECURITY DEFINER` SQL function `is_coach_of(coach, client)` extending every existing table's RLS with `OR is_coach_of(auth.uid(), user_id)` — coach reads, never writes.

- [x] **Phase 22: Schema Foundation & RLS Keystone** — Migrations 034–036, `is_coach_of()` function, coach role + profiles + invitations + links + program extensions; cross-user RLS policies on 11 athlete tables — **4/4 plans complete (2026-05-14)**
- [x] **Phase 23: Web Turborepo Onboarding & Auth Bootstrap** — Monorepo path (git subtree merge), `@supabase/ssr` dual-store auth, `(coach)` route group scaffold, `packages/coach-sdk` Zod schemas, Vercel Pro provisioned, CI/CD pipeline — **8/8 plans complete (2026-05-15)**
- [x] **Phase 24: Coach Identity & Onboarding** — `coach/identity` bounded module, self-serve 3-step coach signup (role promotion → profile → KYC), coach-kyc storage bucket, `CoachSidebar` layout, dashboard + settings pages, login page, GAP fixes (locale redirects, NEXT_PUBLIC_API_URL, marketing header) — **6/6 plans complete (2026-05-16)**
- [ ] **Phase 25: Invitations & Mobile "Mon coach" Minimal** — `coach/invitations` + `coach/clients` bounded modules, 6-char codes, web redemption state machine (/redeem + /r/[code]), rate-limited preview/redeem/revoke loop — **gaps: redeem flow broken + visual inaccuracies vs mockups**
- [ ] **Phase 26: CRM Client Management** — `/coach/clients` list + detail with TanStack Table, tabbed read-only client data, executive summary, tags, private notes, multi-client comparison
- [ ] **Phase 27: Coaching Programs & Mobile "Mon coach" Full** — Program templates, folders, assignments (fork-on-assign), seed templates, mobile prescribed-program badge + compliance widget + contact CTA
- [ ] **Phase 28: AI File Imports** — Upload/parse/preview/commit flow for PDF/image/Excel/Word, athlete + coach modes, multi-page PDFs, re-upload diff, async polling
- [ ] **Phase 29: AI Coach Orchestrator** — 3 tools (`analyze_client`, `generate_coaching_program`, `monitor_client_alerts`), web chat UI, weekly digest, `ai_tool_audit`
- [ ] **Phase 30: Strava Integration** — Migration 037, OAuth + webhook + backfill + reconciliation cron, mobile connect/disconnect (parallel with Phases 24–29)
- [ ] **Phase 31: Public Marketing `/coachs`** — FR/EN static landing, demo video, comparison vs Trainerize/TrueCoach, beta signup CTA (parallel after Phase 23)

---

## Phase Details

### Phase 22: Schema Foundation & RLS Keystone
**Goal**: Every downstream module can read coach↔client relationships and join client data through a single, audited SECURITY DEFINER function.
**Depends on**: Nothing (v1.5 foundation phase)
**Requirements**: ARCH-07
**Success Criteria** (what must be TRUE):
  1. Migration 034 lands `user_profiles.role` (`client`/`coach`/`both`) and `coach_profiles` with RLS, and existing users default to `client` without breaking any read path.
  2. Migration 035 lands `coach_invitations`, `coach_client_links` (with partial UNIQUE on active rows + `coach_id <> client_id` CHECK), `is_coach_of(coach, client)` SECURITY DEFINER STABLE function, and the `redeem_invitation_code` RPC.
  3. Every cross-user-readable athlete table (habits, habit_logs, workout_sessions, session_sets, body_measurements, nutrition_logs, sleep_logs, cardio_sessions, hydration_logs, journal_entries, stretching_logs) has a separate `FOR SELECT` policy (owner OR `is_coach_of`) while the existing `FOR ALL` (owner only) write policy is unchanged.
  4. Migration 036 lands `workout_programs` extensions (`created_by_coach_id`, `assigned_to_user_id`, `is_template`, `weeks_data JSONB`, `template_source_id`) and the `ai_imports` table.
  5. A 4-case smoke test passes: coach can read linked client, coach cannot read unlinked client, revoked link blocks read immediately, expired link is treated as revoked.
**Plans**: 4 plans
- [x] 22-01-PLAN.md — Test infrastructure (Vitest install, fixtures, CI workflow) — Wave 0
- [x] 22-02-PLAN.md — Migration 034: user_profiles.role + coach_profiles + RLS — Wave 1
- [x] 22-03-PLAN.md — Migration 035: invitations, links, is_coach_of(), redeem RPC, 11 SELECT policies (keystone) — Wave 2
- [x] 22-04-PLAN.md — Migration 036: workout_programs extensions + ai_imports — Wave 3

### Phase 23: Web Turborepo Onboarding & Auth Bootstrap
**Goal**: A `(coach)` segment under `apps/web/` is reachable with cookie-based Supabase auth, `force-dynamic`, and the shared `coach-sdk` Zod package installed.
**Depends on**: Phase 22
**Requirements**: ARCH-02, ARCH-04, ARCH-05, ARCH-06, ARCH-08
**Success Criteria** (what must be TRUE):
  1. The web app lives at `apps/web/` inside the Turborepo with documented spike outcome (onboard `c:/ziko-web` into monorepo as recommended path, or fallback to dual-repo with published `coach-sdk` NPM package — decision recorded with rollback plan).
  2. `@supabase/ssr` powers layered auth (middleware refresh + layout `getUser()` + Server Action re-check); raw `@supabase/supabase-js` is ESLint-banned in Server Components.
  3. `packages/coach-sdk` exists in the workspace exporting `ImportedProgramSchema`, `CoachClientLinkSchema`, `CoachProfileSchema` Zod schemas consumed by backend, web, and mobile.
  4. ESLint `no-restricted-imports` is configured to block cross-module imports outside `coach/<m>/service`; a CI grep verifies no `SERVICE_ROLE` references appear under `backend/api/src/coach/`.
  5. Vercel Pro tier is confirmed enabled for both `apps/web/` and backend deployments; `/coach/imports/:id/parse` declares `maxDuration = 60`; all `(coach)` routes use `dynamic = 'force-dynamic'`, `revalidate = 0`, and `cache: 'no-store'`.
**Plans**: 8 plans
- [x] 23-01-PLAN.md — Wave 0: Pre-flight cleanup + rollback tag — completed 2026-05-14
- [x] 23-02-PLAN.md — Wave 1: Spike — subtree merge c:/ziko-web → apps/web + triple-green gate — completed 2026-05-15 (PASS)
- [ ] 23-02b-PLAN.md — Wave 1b (CONTINGENT on 23-02 FAIL): Dual-repo fallback per D-04 (reset, publish coach-sdk to GH Packages, c:/ziko-web .npmrc)
- [x] 23-03-PLAN.md — Wave 2: packages/coach-sdk (Zod schemas + tsup dual ESM/CJS) — completed 2026-05-15
- [x] 23-04-PLAN.md — Wave 3: @supabase/ssr factories + composed middleware — completed 2026-05-15
- [x] 23-05-PLAN.md — Wave 4: ESLint no-restricted-imports (D-11 + D-12) — completed 2026-05-15
- [x] 23-06-PLAN.md — Wave 5: (coach) layout + /fr/coach/_smoke thin slice — completed 2026-05-15
- [x] 23-07-PLAN.md — Wave 6: Vercel topology + Pro-tier probes + CI workflow + GHA release insurance — completed 2026-05-15
- [ ] 23-08-PLAN.md — Wave 7: Vercel cutover + smoke deploy + 23-VERIFICATION.md
**UI hint**: yes

### Phase 24: Coach Identity & Onboarding
**Goal**: A user can complete a self-serve coach signup, populate a public profile, and access the coach web section.
**Depends on**: Phase 23
**Requirements**: COACH-01, COACH-02, COACH-03, COACH-04, COACH-05, ARCH-01, ARCH-03
**Success Criteria** (what must be TRUE):
  1. A user visiting `ziko-app.com/coach/onboarding` can self-promote their `user_profiles.role` to `coach` or `both` without admin intervention and lands on the coach dashboard.
  2. A coach can fill display name, bio, specialties, and website on the onboarding form and see the values persisted in `coach_profiles` and reflected on `/coach/settings`.
  3. A coach can upload optional KYC documents (certifications, ID) without being blocked from coach features; `kyc_status` stays `pending` and is visible in their settings.
  4. A `role='both'` user signs in once and reaches both the athlete app (mobile) and the coach CRM (web) with the same account.
  5. `backend/api/src/coach/identity/` exists as a bounded module with `service.ts` as the only public entry; CI verifies no `SERVICE_ROLE` reference anywhere under `coach/`.
**Plans**: 6 plans
- [ ] 24-01-PLAN.md — Housekeeping + storage bucket migration + Wave 0 test stub
- [ ] 24-02-PLAN.md — Backend bounded module (coach/identity/ types, db, service) + integration tests
- [ ] 24-03-PLAN.md — Coach layout chrome (sidebar) + /fr/login page + loginAction
- [ ] 24-04-PLAN.md — Shared coach components + Server Actions (promoteRole, saveProfile, saveKyc)
- [ ] 24-05-PLAN.md — Pages assembly (onboarding wizard, dashboard, settings) + i18n keys
- [ ] 24-06-PLAN.md — Full verification (automated suite + manual smoke all 5 surfaces)
**UI hint**: yes

### Phase 25: Invitations & Mobile "Mon coach" Minimal
**Goal**: A coach can issue an invitation code and an athlete can redeem it FROM WEB to create a revocable coach↔client link. (Mobile "Mon coach" plugin deferred to v1.6 seed per 25-CONTEXT.md D-01 — see .planning/seeds/SEED-002-mobile-mon-coach-plugin.md.)
**Depends on**: Phase 24
**Requirements**: INVITE-01, INVITE-02, INVITE-03, INVITE-04, INVITE-05, INVITE-06, INVITE-07 (MOBILE-01 + MOBILE-05 deferred to v1.6 seed)
**Success Criteria** (what must be TRUE):
  1. A coach can generate a 6-character `[A-Z2-9]` invitation code from `/coach/invitations`, set its expiration (preset chips 7d/14d-default/30d/Never), see it in a list with status (active/used/expired/revoked), and revoke any active code.
  2. An athlete sees a state-aware web surface at `/redeem` (manual entry) or `/r/[code]` (deep-link): when unlinked, code-entry input; entering a valid code transitions to a preview state; valid redemption creates a `coach_client_links` row.
  3. Before confirming, the athlete sees a preview of the coach (display name, bio, specialties, signed-URL photo, KYC badge); expired or already-used codes return a single constant-time error (no per-cause leak) and do not create a link.
  4. Code redemption is rate-limited (5 attempts/15min per IP, 10/hour per user) with constant-time wire envelope regardless of failure reason; serial IP+user composition via Upstash sliding window.
  5. The athlete can revoke the coach link from `/redeem` (state C) via a typed-confirmation modal ("Tapez COACH"); the coach loses read access immediately (RLS check on next read returns nothing).
**Plans**: 8 plans
  - [x] 25-01-PLAN.md — Foundation (peek_invitation migration 040, nanoid@^3.3.11, coach-sdk schemas, i18n stubs)
  - [x] 25-02-PLAN.md — Backend coach/invitations bounded module (generate/list/revoke)
  - [x] 25-03-PLAN.md — Backend coach/clients bounded module (links/me, preview, redeem, revoke) + composed rate limiter + constant-time envelope
  - [x] 25-04-PLAN.md — Web (coach) /coach/invitations page + components + Server Actions + sidebar nav INSERT
  - [x] 25-05-PLAN.md — Web (athlete) /redeem + /r/[code] state machine + CoachPreviewCard + safeNext extension
  - [x] 25-06-PLAN.md — Validation (backend unit + integration + rate-limit + timing + safeNext tests)
  - [x] 25-07a-PLAN.md — Refonte Phase 24 (1/2) — login + 3-step onboarding wizard (pixel-perfect to Ziko+Onboarding.html)
  - [x] 25-07b-PLAN.md — Refonte Phase 24 (2/2) — coach dashboard + settings (pixel-perfect to Ziko+Onboarding.html)
  - [x] 25-08-PLAN.md — Gap closure: redeem flow JWT fix (getUser() first, API_URL fallback, error logging, pending CTAs)
**Canonical mockups:** `.planning/mockups/Ziko-Onboarding.html` (Phase 24 surfaces) + `.planning/mockups/Ziko-Screens.html` (Phase 25 surfaces) - pixel-perfect match required.
**Phase 24 refonte (folded into Phase 25):** login + onboarding wizard + dashboard + settings re-delivered pixel-perfect to canonical Phase 24 mockup. Tracked in plans 25-07a (login + onboarding) and 25-07b (dashboard + settings).
**UI hint**: yes

### Phase 26: CRM Client Management
**Goal**: A coach can browse their roster, drill into any linked client's data read-only, and capture coach-private observations.
**Depends on**: Phase 25
**Requirements**: CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04, CLIENT-05, CLIENT-06, CLIENT-07, CLIENT-08
**Success Criteria** (what must be TRUE):
  1. A coach can browse `/coach/clients` with a paginated TanStack Table list showing name, photo, last-active timestamp, and quick filters; search by name works; signal filters (missed last 2 sessions / measurements stale >4w / mood declining) narrow the list.
  2. A coach can open `/coach/clients/[id]` and see tabs for sessions, measurements, habits, nutrition, sleep, cardio, journal — all read-only, all loaded via `is_coach_of` RLS reads with `cache: 'no-store'`.
  3. A coach sees an executive summary card at the top of the client detail (weekly compliance %, last workout date, latest measurement, 14-day mood trend).
  4. A coach can attach custom tags (`coach_client_tags`) and write versioned private notes (`coach_client_notes`) per client; both are coach-private and never visible to the client.
  5. A coach can select 3–5 clients and view a multi-client comparison chart for a common metric; a coach can revoke a coach↔client link from the dashboard with a 2-step confirmation that immediately removes read access while preserving client data.
**Plans**: TBD
**UI hint**: yes

### Phase 27: Coaching Programs & Mobile "Mon coach" Full
**Goal**: A coach can author program templates, assign forked copies to linked clients, and the assigned athlete sees and executes the program in the mobile app.
**Depends on**: Phase 26
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, PROG-05, PROG-06, PROG-07, PROG-08, PROG-09, MOBILE-02, MOBILE-03, MOBILE-04, MOBILE-06
**Success Criteria** (what must be TRUE):
  1. A coach can create a multi-week template at `/coach/programs/new` with metadata + structured weeks/sessions/exercises (sets, reps, target RPE 1–10 or RIR 0–5, rest interval) persisted as `workout_programs` with `is_template=TRUE` and `weeks_data JSONB`; exercises come from the existing 1000+ Ziko library or free-text.
  2. A coach can organize templates into folders, duplicate a template / week / session via context menu, and Ziko ships with 5–10 expert-curated seed templates (PPL, 5/3/1, Hyrox prep, body-recomp, beginner full-body) available on signup.
  3. A coach can assign a template to one or more linked clients in a single action; assignment creates a forked copy (`is_template=FALSE`, `assigned_to_user_id` set, `template_source_id` back-reference) and per-client edits never touch the source template.
  4. An athlete with an assigned program sees the coach card (name, photo, certifications) plus today's session preview in the "Mon coach" mobile screen; assigned sessions execute like any workout and log into `workout_sessions`.
  5. The mobile athlete sees a "Programme prescrit par [coach]" badge on prescribed sessions (read-only badge), a "75% this week" weekly compliance widget, the coach's latest shared note, and a "Contact coach" CTA that opens `mailto:` with the coach's signup email.
**Plans**: TBD
**UI hint**: yes

### Phase 28: AI File Imports
**Goal**: Any authenticated user (athlete or coach) can upload a workout file in any common format and commit a structured program after reviewing the AI parse.
**Depends on**: Phase 27
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08, IMPORT-09, IMPORT-10
**Success Criteria** (what must be TRUE):
  1. A user can drag-drop a PDF, image (PNG/JPEG), Excel (`.xlsx`/`.xls`), or Word (`.docx`) file up to 25 MB; upload goes directly to Supabase Storage via a signed URL bypassing Vercel's 4.5 MB body limit.
  2. After upload, a parse step runs Claude vision/document parsing producing a Zod-validated `ImportedProgramSchema`; credits are deducted only on success, failed parses (Zod failure / unreadable file) show a clear error and do not deduct credits.
  3. The preview UI shows extracted weeks/sessions/exercises with confidence scores per field; fields below 70% confidence are highlighted yellow; every field is editable before commit; multi-page PDFs (up to 30 pages, e.g. 12-week programs) are reassembled into a single structured program.
  4. An athlete commits in "athlete mode" creating a usable `workout_programs` row owned by them; a coach commits in "coach template mode" creating a template (`is_template=TRUE`) ready to assign.
  5. The import flow is async — the client polls `GET /coach/imports/:id` every 2s and handles parse durations up to 60s without blocking; re-uploading a new version of a previously imported file shows a diff (new/changed/removed weeks/sessions/exercises) before commit.
**Plans**: TBD
**UI hint**: yes

### Phase 29: AI Coach Orchestrator
**Goal**: A coach can chat with the Ziko AI assistant from the web CRM, invoke client-aware tools, and receive proactive client monitoring.
**Depends on**: Phase 28
**Requirements**: AIC-01, AIC-02, AIC-03, AIC-04, AIC-05, AIC-06, AIC-07, AIC-08, AIC-09, AIC-10
**Success Criteria** (what must be TRUE):
  1. A coach can chat from `/coach/ai` with a context-aware system prompt listing their linked clients; the AI exposes 3 tools (`analyze_client`, `generate_coaching_program`, `monitor_client_alerts`) registered in the tool registry.
  2. `analyze_client(client_id, period_days?)` uses the coach's per-request user JWT (never service role), passes `is_coach_of` defense-in-depth, and returns a structured progression/risks/suggestions summary; `generate_coaching_program(...)` persists a multi-week program (assigned, NOT template by default) and returns the program ID.
  3. `monitor_client_alerts` flags concerning patterns (missed sessions, sleep drop, declining mood, RPE inflation) and a background job runs it every 24h per coach, surfacing results in a coach inbox with optional push notification.
  4. A coach can click "Adapt this program for [client X]" on any template page and the AI chat opens pre-filled with the template + client context; every Monday morning, a coach receives a weekly digest (email + in-app notification) summarizing key points across all linked clients.
  5. Every coach AI tool invocation is logged to `ai_tool_audit` (timestamp, coach_id, tool_name, target_client_id, args_hash, result_status, conversation_id); coach AI usage is credit-gated by the v1.4 credit system with per-tool cost classes visible to the coach.
**Plans**: TBD
**UI hint**: yes

### Phase 30: Strava Integration
**Goal**: An athlete can connect Strava once and have their activities auto-flow into Ziko's cardio sessions with no duplicates and no manual sync.
**Depends on**: Phase 22 (schema); parallel with Phases 24–29
**Requirements**: STRAVA-01, STRAVA-02, STRAVA-03, STRAVA-04, STRAVA-05, STRAVA-06, STRAVA-07
**Success Criteria** (what must be TRUE):
  1. An athlete can connect Strava from the mobile app via OAuth (scope `read,activity:read_all`, deep-link callback `ziko://strava/callback`); tokens persist in `strava_accounts` with own-RLS.
  2. Migration 037 lands `strava_accounts`, `strava_webhook_events`, and `cardio_sessions.external_strava_id` with a partial UNIQUE index ensuring webhook-driven UPSERTs are idempotent.
  3. New Strava activities arrive via webhook (handler returns 200 in <2s, processing in a `*/5 * * * *` cron with `FOR UPDATE SKIP LOCKED`); on initial connection, a 30-day backfill runs throttled by Upstash (max 90 req/15min).
  4. A daily reconciliation cron (03:00 UTC) catches missed webhook deliveries since `last_sync_at`; Strava deauthorization marks the row deauthorized and the mobile app surfaces a "Reconnect" CTA.
  5. An athlete can disconnect Strava from mobile settings; tokens are cleared and the webhook subscription is unsubscribed.
**Plans**: TBD
**UI hint**: yes

### Phase 31: Public Marketing `/coachs`
**Goal**: A non-authenticated visitor lands on a static FR/EN page that explains the coach offer and converts to a private beta signup.
**Depends on**: Phase 24 (signup URL stable); parallel with Phases 25–30
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06
**Success Criteria** (what must be TRUE):
  1. A visitor reaches `/coachs` (FR) and `/en/coachs` (EN) on ziko-app.com with hero, 3–4 feature blocks, FAQ, and the existing legal footer.
  2. A "Rejoindre la bêta privée" / "Join the private beta" CTA links to `/coach/onboarding` (no pricing displayed); the page contains a 60s muted auto-play demo video showing the coach CRM and an honest comparison table vs Trainerize / TrueCoach (key features only, no testimonials).
  3. A founder section presents the "Built by athletes, for coaches" mission.
  4. The page is fully static (SSG via `generateStaticParams` + `setRequestLocale`), CNIL-compliant (self-hosted fonts via `next/font`), and SEO-optimized with OG metadata.
**Plans**: TBD
**UI hint**: yes

---

## Open Architectural Decisions (surfaced for Phase 22–23)

| # | Decision | Phase | Default / Recommended | Rollback |
|---|----------|-------|------------------------|----------|
| 1 | `apps/web/` Turborepo onboarding vs dual-repo with published `coach-sdk` NPM | Phase 23 (spike at start) | Onboard `c:/ziko-web` into monorepo as `apps/web/` | If RN-deps bleed into web bundle is unfixable in 1 day, ship `coach-sdk` as a versioned NPM package and keep `c:/ziko-web` separate |
| 2 | Vercel Pro tier confirmation (Hobby 10s timeout kills imports) | Phase 23 | Pro tier mandatory on both `apps/web/` and backend before Phase 28 | None — Phase 28 cannot ship on Hobby |
| 3 | AI import credit cost calibration (per-page pricing vs flat per-file) | Phase 28 | Per-page pricing targeting €0.05/import within €0.75/user/month freemium | Flat per-file with a 5-page cap if per-page accounting is too complex |
| 4 | GDPR retention on revocation — `workout_programs.assigned_to_user_id` ON DELETE CASCADE vs SET NULL | Phase 25 | SET NULL (preserve coach's authored content; mark `source_client_id` redacted) | CASCADE if legal review requires hard purge |
| 5 | `nanoid` ESM vs CJS in backend | Phase 25 | Verify `backend/api/package.json "type"` before installing; use v4 (CJS-compatible) if needed | None |
| 6 | Icon library on web (`lucide-react` vs `@heroicons/react`) | Phase 23 | Audit existing v1.0 landing; reuse whichever is already present | Add only if neither exists |

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31

Within v1.5, Phases 30 (Strava) and 31 (Marketing) execute in parallel lanes after their listed dependencies clear.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-26 |
| 2. RGPD Compliance | v1.0 | 3/3 | Complete | 2026-03-26 |
| 3. Marketing Content | v1.0 | 3/3 | Complete | 2026-03-27 |
| 4. SEO + Performance | v1.0 | 3/3 | Complete | 2026-03-27 |
| 5. Launch | v1.0 | 2/2 | Complete | 2026-03-28 |
| 6. Smart Inventory | v1.1 | 4/4 | Complete | 2026-03-29 |
| 7. AI Recipe Suggestions | v1.1 | 4/4 | Complete | 2026-03-29 |
| 8. Calorie Tracker Sync | v1.1 | 3/3 | Complete | 2026-03-30 |
| 9. Smart Shopping List | v1.1 | 3/3 | Complete | 2026-04-01 |
| 10. Data Foundation + Tech Debt | v1.2 | 3/3 | Complete | 2026-04-02 |
| 11. Barcode UI + Score Display | v1.2 | 3/3 | Complete | 2026-04-02 |
| 12. Infra + Rate Limiting | v1.3 | 2/2 | Complete | 2026-04-02 |
| 13. API Security Hardening | v1.3 | 1/1 | Complete | 2026-04-03 |
| 14. Supabase Storage | v1.3 | 3/3 | Complete | 2026-04-03 |
| 15. Lifecycle & Cleanup | v1.3 | 1/1 | Complete | 2026-04-05 |
| 16. Security Middleware Regression Fix | v1.3 | 1/1 | Complete | 2026-04-05 |
| 17. DB Foundation + Model Fix | v1.4 | 2/2 | Complete | 2026-04-05 |
| 18. Credit Service + Middleware | v1.4 | 2/2 | Complete | 2026-04-05 |
| 19. Backend Routes + AI Integration | v1.4 | 3/3 | Complete | 2026-04-05 |
| 20. Activity Earn Hooks | v1.4 | 2/2 | Complete | 2026-04-09 |
| 21. Mobile UI — Credit Display + Exhaustion UX | v1.4 | 2/2 | Complete | 2026-04-09 |
| 22. Schema Foundation & RLS Keystone | v1.5 | 4/4 | Complete | 2026-05-14 |
| 23. Web Turborepo Onboarding & Auth Bootstrap | v1.5 | 8/8 | Complete | 2026-05-15 |
| 24. Coach Identity & Onboarding | v1.5 | 6/6 | Complete | 2026-05-16 |
| 25. Invitations & Mobile "Mon coach" Minimal | v1.5 | 8/8 | Gaps | — |
| 26. CRM Client Management | v1.5 | 0/0 | Not started | — |
| 27. Coaching Programs & Mobile "Mon coach" Full | v1.5 | 0/0 | Not started | — |
| 28. AI File Imports | v1.5 | 0/0 | Not started | — |
| 29. AI Coach Orchestrator | v1.5 | 0/0 | Not started | — |
| 30. Strava Integration | v1.5 | 0/0 | Not started | — |
| 31. Public Marketing `/coachs` | v1.5 | 0/0 | Not started | — |

---
*Roadmap created: 2026-03-26 — Milestone v1.0 Landing Page*
*Updated: 2026-04-29 — v1.4 archived: Systeme de Credits IA & Monetisation (Phases 17–21)*
*Updated: 2026-05-13 — v1.5 Coach Platform & CRM roadmap drafted (Phases 22–31)*
*Updated: 2026-05-14 — Phase 22 (Schema Foundation & RLS Keystone) execution complete: 4/4 plans, 3 migrations live on slkobhavpwsubnsmuhya (034/035/036), 47/47 RLS tests green. Ready for `/gsd-verify-phase`.*
*Updated: 2026-05-14 — Phase 23 Wave 0 complete: Plan 23-01 (root react-native-worklets removed, pre-web-onboarding tag pushed to origin, 23-ROLLBACK.md committed). Ready for Wave 1 spike (Plan 23-02).*
*Updated: 2026-05-15 — Phase 23 Wave 2 complete: Plan 23-03 packages/coach-sdk — ImportedProgramSchema/CoachClientLinkSchema/CoachProfileSchema built, tsup dual ESM+CJS, 4/4 Vitest tests green, apps/web wired. Ready for Wave 3 (Plan 23-04 @supabase/ssr).*
*Updated: 2026-05-15 — Phase 23 Wave 3 complete: Plan 23-04 @supabase/ssr@0.10.3 installed, 3 factories (client/server/middleware), apps/web/middleware.ts replaced with Supabase-first + next-intl composition, 3/3 vitest tests green. ARCH-05 layer 1 operational. Ready for Wave 4 (Plan 23-05 ESLint).*
*Updated: 2026-05-15 — Phase 23 Wave 6 complete: Plan 23-07 Vercel two-project topology (ignoreCommand on both), Pro-tier _debug probes (DELETE IN PHASE 24, ARCH-08), CI 4 new jobs (verify/no-service-role-in-coach/bundle-hygiene/zod-drift), publish-coach-sdk.yml D-04 insurance. 7/8 plans done. Ready for Wave 7 (Plan 23-08 Vercel cutover + smoke deploy).*
*Updated: 2026-05-16 — Phase 24 (Coach Identity & Onboarding) complete: 6/6 plans + GAP fixes, 10/10 UAT pass. coach/identity bounded module, 3-step onboarding wizard, KYC storage bucket (migration 037), CoachSidebar layout, dashboard + settings pages. GAP fixes: locale prefix on all redirects, NEXT_PUBLIC_API_URL added to apps/web, marketing pages isolated in (marketing) route group. Ready for Phase 25 (Invitations & Mobile "Mon coach" Minimal).*
*Updated: 2026-05-17 — Phase 25 (Invitations & Mobile "Mon coach" Minimal) complete: 8/8 plans + focus trap gap fix. coach/invitations + coach/clients bounded modules, 6-char nanoid codes, web-only redeem state machine (/redeem + /r/[code]), serial rate-limit (5/15min IP + 10/hr user), constant-time INVALID_OR_EXPIRED envelope, typed-confirmation revoke (COACH token), Phase 24 refonte pixel-perfect to canonical mockups, RevokeConfirmModal focus trap fixed. Ready for Phase 26 (CRM Client Management).*
