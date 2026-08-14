# Ziko Platform

## What This Is

The Ziko fitness platform — a fully-extensible React Native / Expo mobile app with 18 plugins, AI coaching, GPS cardio tracking, and a Supabase backend. The `.planning` folder also tracks the Next.js marketing website (`ziko-app.com`) that launched as milestone v1.0. v1.5 introduces an authenticated Coach Platform / CRM section on the web — the first step toward a future ERP for fitness coaches.

## Core Value

A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and controls AI costs through gamified engagement. Coaches manage their clients, assign programs, and use AI to analyze and adapt those programs from the web CRM.

<details>
<summary>✅ v1.7 Mobile UX v2 [milestone-mobile] — SHIPPED 2026-05-28</summary>

**Goal:** Full visual redesign of the Ziko mobile app matching 24 canonical mockups; design + real data per screen.

**What shipped:**
- 10 shared components in `packages/ui/`: FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip, BugFab/BugSheet, PaywallScreen, RechargeSheet, PluginsDrawer, EmptyState/ErrorScreen (4 variants each)
- 40+ screens redesigned pixel-for-pixel; 17 plugins fully updated
- 100% fixture elimination — zero domain-data arrays in production screens
- GPS Cardio live tracker (Haversine + noise filter + RouteVisualizer + Strava-like dashboard)
- Coach StateC: real stats (`sessionsCount` + `habitsPct`) + linked-since date
- 3-tab nav (Accueil/Séance/Profil); BugFab globally mounted

**Deferred:** Phase 35 gaps (35-G01–G07) — cache invalidation, password spinner, progress photo, crédits IA, apparences, parrainage

**Archive:** `.planning/milestones/v1.7-ROADMAP.md` · `.planning/milestones/v1.7-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v1.6 Mobile v2 [milestone-mobile] — SHIPPED 2026-05-21</summary>

**Goal:** Livrer le plugin "Mon coach" mobile (côté athlete).

**What shipped:**
- `manifest.mandatory: true` field in `PluginManifest` type; PluginLoader pre-load bypass; mandatory trash gate in plugin store (migration 047 adds coach to `plugins_registry`)
- Plugin "Mon coach" — pre-installed, non-removable for athletes; 3-state UX: State A (code entry `[A-Z2-9]`, 6-char), State B (coach preview card from `GET /preview`), State C (linked + revocation)
- Typed "COACH" confirmation modal for revocation from both plugin screen and Settings > Mon coach
- 22 fr+en i18n keys across all states, error cases, and modals
- AI tools `coach_get_link` + `coach_revoke_link` wired into backend tool registry
- UI design contract: Figma + UI-SPEC.md for all 3 states in light sport theme

**Archive:** `.planning/milestones/v1.6-ROADMAP.md` · `.planning/milestones/v1.6-REQUIREMENTS.md`

</details>

---

<details>
<summary>✅ v1.8 Sport Dashboards (main — web/coach) — SHIPPED 2026-05-30</summary>

**Goal:** Fournir aux coachs des dashboards pré-construits par type de sport — élimine le blank-page problem et permet une analyse client immédiate sans configuration.

**What shipped:**
- Dashboard tab in coach client detail view — sport selector dropdown + date range filter (week/month/3 months)
- Powerlifting dashboard: 1RM SBD progression, RPE fatigue trend, weekly tonnage, intensity % (4 Recharts charts)
- 4 additional sport dashboards: Hyrox (station splits, finish times, weekly volume), Running/Cardio (pace, distance, VO2max), Bodybuilding (volume per muscle group, overload, bodyweight), Weight Loss/Injury Return (bodyweight curve, calorie compliance, load progression)
- Side-by-side compare mode (second client or second period, dual-series charts)
- PDF export (html2canvas + jsPDF, dynamic import for SSR safety)
- AI context injection: dashboard metrics → coach chat system prompt (AI-01); insight chips per chart card (AI-02); narrative summary card (AI-03); numeric threshold alerts + ChartCard badge (AI-04, gap closed in Phase 41.1)

**Phases:** 37–41.1 (6 phases, 20 plans)
**Archive:** `.planning/milestones/v1.8-ROADMAP.md` · `.planning/milestones/v1.8-REQUIREMENTS.md`

</details>

## Active Parallel Workstreams

**Parallel workstream:** v1.9 Retour Vocal Coach (`retour-vocal`) — coach enregistre retour vocal → Whisper + Claude structure avec mémoire athlète → card exploitable.
**Parallel workstream:** v1.10 Custom Coach Exercises (`custom-coach`) — coach crée ses propres exercices (vidéo + photo), disponibles dans les programmes de ses athlètes.
**Parallel workstream:** v1.11 Notification System (`notification-mobile`) — push + in-app notifications mobile (Expo Push, APNs/FCM), Hono-triggered, préférences par catégorie.
**Parallel workstream:** v1.12 DA Coach (`da-coach`) — coach définit sa direction artistique (couleurs, logo, ton) → app des athlètes liés affiche la DA automatiquement au refresh. Différenciateur Pro 29€/mois.
**Parallel workstream:** v1.13 Retour Vidéo Coach (`retour-video`) — athlète upload vidéo depuis mobile → player web coach avec annotations timecodées (texte + vocal nettoyé).
**Parallel workstream:** v1.14 Formulaires Conditionnels (`formulaire-condi`) — le coach crée des formulaires déclenchés par des conditions ; écran bloquant global mobile tant que non rempli ; réponses injectées dans Claude.
**Parallel workstream:** v1.15 Custom Widget Dashboards (`custom-widget`) — coach customise un dashboard par athlète via chat Claude (set fermé 7 widgets, flat JSON, tool calling → preview live → save). Critère : personnalisation en 30s.
**Parallel workstream:** v1.16 Exercise Library Import (`image-exo`) — remplace la bibliothèque d'exercices (1324 exos, GIFs + thumbnails 180×180, instructions FR/EN) depuis le dataset `hasaneyldrm/exercises-dataset` sur Supabase Storage ; médias sous licence Gym visual (attribution obligatoire) ; UPDATE par nom matché pour préserver les FK `program_exercises`/`session_sets`.

---

<details>
<summary>v1.5 Coach Platform & CRM — ongoing on main branch</summary>

**Goal:** Ship the first coach-facing milestone — a modular web CRM (bounded-contexts architecture preparing the future ERP) that lets a coach manage their clients, assign programs, import data via AI file parsing, and use a dedicated AI assistant — with a simple invitation link between coach and athlete.

**Target features:**

- Coach identity (`role` column on `user_profiles`: client/coach/both) with self-serve signup + light KYC
- Invitation system — 6-character code generated by coach, entered in the mobile app to link client↔coach (full-access default, revocable)
- Web `/coach/clients` CRM — list, search, client detail view (read-only sessions, measurements, habits, nutrition, sleep, cardio)
- Coaching programs — `workout_programs` extended (`created_by_coach_id`, `assigned_to_user_id`, `is_template`, `weeks_data JSONB`), templates reusable across clients
- **AI file imports** (instead of CSV) — upload any file (PDF, image, Excel, Word, screenshot) → Claude vision/document parsing → structured program/sessions via `generateObject` + Zod → preview/commit. Two flows: athlete (own data) + coach (coaching templates)
- AI coach orchestrator — 3 new tools (`analyze_client`, `generate_coaching_program`, `monitor_client_alerts`) + web chat UI for the coach
- Strava OAuth (athlete side) — connect from mobile app, auto-sync cardio_sessions via webhook + cron
- Public landing `/coachs` (FR/EN) on ziko-app.com presenting the coach offer with signup CTA
- Mobile "Mon coach" screen — read-only view of linked coach + active program

**Architecture decision — bounded contexts from day one:**

```
backend/api/src/coach/
  identity/       # signup coach, profil, KYC
  clients/        # liens coach↔client, lecture data client
  programs/       # templates + assignations
  invitations/    # codes, validation
  imports/        # AI parsing workouts + programs
  ai/             # tools analyze/generate/monitor
apps/web/src/app/(coach)/   # Next.js authenticated section
apps/web/src/app/coachs/    # landing publique FR/EN
```

This isolation prepares the future ERP (`coach-billing/`, `coach-scheduling/`) without refactoring existing modules.

**Key constraints:**
- Web only for coach CRM — Expo unsuitable for dense table views
- Full-access default on client data via RLS JOIN on `coach_client_links` (revocable, GDPR covered by revocation)
- Self-serve coach onboarding with a posteriori moderation — no human bottleneck in v1.5
- AI imports replace CSV — no stable format to maintain, reuses existing AI/vision stack, cost-gated by v1.4 credit system

</details>

---

<details>
<summary>✅ v1.4 Système de Crédits IA & Monétisation — SHIPPED 2026-04-29</summary>

**What shipped:**
- Atomic PostgreSQL credit system — dual-table balance+ledger (`user_ai_credits` + `ai_credit_transactions`) with SECURITY DEFINER `deduct_ai_credits` RPC and SELECT FOR UPDATE row lock
- `creditService.ts` + `creditCheck`/`creditDeduct` Hono middleware pair gating all AI routes; premium tier bypass
- `GET /credits/balance`, `POST /credits/earn` endpoints; AI chat/stream/scan credit-gated; `ai_cost_log` per-call token logging; monthly cost ceiling ≤ €0.75 verified
- Haiku vision migration (`claude-haiku-4-5-20251001`, ~70% cost reduction); centralized `models.ts`
- Fire-and-forget earn hooks in 5 backend tool executors + 6 mobile screens; idempotent via record-UUID
- `CreditEarnToast`, `CreditExhaustionSheet`, balance chip, dual-balance card, cost labels, `/ai/programs/generate` monthly quota route

</details>

<details>
<summary>Previous: v1.2 Barcode Enrichment + Tech Debt — SHIPPED 2026-04-02</summary>

**What shipped:**
- Barcode scan tab in nutrition log screen — Open Food Facts product card with photo, name, brand, macros per 100g, Nutri-Score + Eco-Score badges, serving size adjuster
- `food_products` shared catalogue table (migration 024) + `offApi.ts` caching utility
- Nutri-Score + Eco-Score badges on journal entries (barcode-logged meals only)
- Daily average Nutri-Score widget on nutrition dashboard (hidden when no scanned meals)
- SHOP-03 fix: quantity prompt Modal before any shopping list check-off (recipe or low-stock)
- `pantry_log_recipe_cooked` registered as proper AI tool; RecipeConfirm.tsx migrated to `/ai/tools/execute`
- Nyquist VALIDATION.md written for phases 07 and 09

</details>

## Requirements

### Validated (v1.0 — Landing Page)

- [x] FR/EN i18n routing with `next-intl` — FR clean URLs, EN `/en/` prefix
- [x] Ziko design tokens applied globally via Tailwind v4 `@theme`
- [x] All pages statically generated — `generateStaticParams` + `setRequestLocale`
- [x] Fonts self-hosted via `next/font` — CNIL-compliant
- [x] Supabase admin client uses `SUPABASE_SERVICE_ROLE_KEY` with `server-only` guard
- [x] Footer visible on every page with legal links
- [x] Self-service account deletion — IP rate-limited, anti-enumeration
- [x] Mentions legales, Politique de confidentialite, CGU — all RGPD/LCEN compliant
- [x] Hero section + Features showcase + Pricing section
- [x] OG metadata, Plausible analytics, Google Search Console

### Validated (v1.1 — Smart Pantry Plugin)

- [x] Smart inventory — pantry items with qty, unit, expiration, category
- [x] AI recipe suggestions — from pantry contents + remaining daily macros
- [x] Calorie tracker sync — confirm cooked -> auto-log macros to nutrition plugin
- [x] Smart shopping list — rule-based from low-stock items + recipe ingredients

### Validated (v1.2 — Barcode Enrichment + Tech Debt)

- [x] `food_products` shared-catalogue table + `offApi.ts` cache utility
- [x] Barcode scan tab — product card with Nutri-Score, Eco-Score, macros, photo
- [x] Nutri-Score + Eco-Score badges on journal entries; daily average widget
- [x] SHOP-03 fix: quantity prompt Modal; `pantry_log_recipe_cooked` AI tool registered

### Validated (v1.3 — Security + Cloud Infrastructure)

- [x] Rate limiting per-user + per-IP on sensitive Hono endpoints (AI chat, barcode scan, tools)
- [x] API security hardening — strict CORS, Zod input validation, secureHeaders
- [x] Supabase Storage — 3 private buckets, signed URL upload flow, mobile bypass of Vercel body limit
- [x] Lifecycle cron — daily cleanup of scan-photos (90d) and exports (7d)

### Validated (v1.4 — Système de Crédits IA & Monétisation)

- [x] Atomic PostgreSQL credit deduction via SECURITY DEFINER RPC — no negative balance possible (CRED-06)
- [x] Dual balance — shop coins + AI credits as separate balances (CRED-07)
- [x] Daily base allocation (1 chat + 1 scan) without activity; monthly program quota (1/month) (CRED-02, CRED-03)
- [x] Activity earn hooks — workout, habits, meals, measurements, stretching, cardio → +1 credit (EARN-01–06)
- [x] Idempotent earning — mobile retry does not double-credit (partial unique index + ON CONFLICT) (EARN-10)
- [x] Daily earn cap (EARN-07); earn toast after activity save (EARN-08); daily progress visible (EARN-09)
- [x] Balance chip in AI header; cost labels on action buttons; exhaustion bottom sheet (CRED-01, CRED-04, CRED-05)
- [x] Haiku vision migration — `claude-haiku-4-5-20251001`, ~70% cost reduction; centralized `models.ts` (COST-01)
- [x] Per-call token logging to `ai_cost_log`; monthly cost ≤ €0.75 verified (COST-02, COST-03)
- [x] `user_profiles.tier` column (free/premium); middleware bypasses deduction for premium (PREM-01, PREM-02)

### Validated (v1.8 — Sport Dashboards)

- [x] Dashboard tab in coach client detail view — sport selector + date range filter (DASH-01, DASH-02, DASH-03) — v1.8
- [x] Powerlifting dashboard: 1RM SBD progression, RPE fatigue trend, weekly tonnage, intensity % (PL-01–04) — v1.8
- [x] Hyrox dashboard: station splits, finish times, weekly training volume (HYR-01) — v1.8
- [x] Running/Cardio dashboard: pace trend, distance, VO2max estimate, weekly km (RUN-01) — v1.8
- [x] Bodybuilding dashboard: muscle volume, progressive overload, bodyweight trend (BB-01) — v1.8
- [x] Weight Loss/Injury Return dashboard: bodyweight curve, calorie compliance, load progression (WL-01) — v1.8
- [x] Side-by-side compare mode (two clients or two periods, dual-series charts) (DASH-04) — v1.8
- [x] PDF export — html2canvas + jsPDF, dynamic import for SSR safety (DASH-05) — v1.8
- [x] Dashboard metrics injected into coach chat system prompt (AI-01) — v1.8
- [x] AI insight chips per chart card; narrative summary card (AI-02, AI-03) — v1.8
- [x] Numeric threshold alerts + ChartCard badge (prop chain completed in Phase 41.1) (AI-04) — v1.8

### Validated (v1.5 — Coach Platform & CRM)

- [x] `is_coach_of()` SECURITY DEFINER STABLE function + 11 cross-user SELECT policies — coach reads, never writes — v1.5
- [x] Self-serve coach signup (3-step wizard: role promotion → profile → KYC); `coach/identity` bounded module — v1.5
- [x] 6-char invitation codes; rate-limited constant-time redemption; web redeem state machine — v1.5
- [x] Coach CRM: paginated roster + signal chips + 7-tab read-only client detail — v1.5
- [x] Executive summary card + private coach notes + tags + multi-client comparison chart — v1.5
- [x] Multi-week program editor (fork-on-assign); 5–10 expert seed templates — v1.5
- [x] AI file imports — PDF/image/Excel/Word → Zod-validated programs; async polling; confidence highlights — v1.5
- [x] AI coach orchestrator — 3 tools + SSE chat UI + alerts panel + weekly digest — v1.5
- [x] Public `/coachs` SSG marketing page FR/EN — v1.5
- [x] React `cache()` auth deduplication — one getUser() DB call per coach request — v1.5

### Deferred (post-v1.5)

**Coach ERP (future milestone, after v1.5 CRM ships)**
- [ ] Coach billing / subscription management
- [ ] Coach scheduling / calendar / session planning
- [ ] Coach hours tracking + accounting exports

**v1.5 explicit deferrals (to v1.6+)**
- [ ] Real-time messaging coach↔client
- [ ] Mobile-native coach views (Expo) — only "Mon coach" athlete screen in v1.5
- [ ] Google Sheets API OAuth import
- [ ] Garmin `.fit` file import
- [ ] Manual coach validation / admin back-office
- [ ] Granular per-domain permissions (training-only, etc.) — full-access default in v1.5
- [ ] Coach pricing page + testimonials on landing — beta privée gratuite en v1.5

### Out of Scope

- Dark mode — light sport theme only
- Blog / content management system — static content only
- AWS S3 direct — Supabase Storage (backed by S3) suffices
- In-memory rate limiting — useless on Vercel serverless
- CSV/Excel rigid format imports — replaced by AI file parsing in v1.5

## Context

- **Shipped milestones**: v1.0 (landing page), v1.1 (Smart Pantry Plugin), v1.2 (Barcode Enrichment), v1.3 (Security + Cloud Infrastructure), v1.4 (AI Credits), v1.5 (Coach Platform & CRM — 2026-05-22), v1.6 (Mon coach plugin mobile — 2026-05-21), v1.7 (Mobile UX v2 — 2026-05-28), v1.8 (Sport Dashboards — 2026-05-30)
- **Mobile app state**: 18 plugins, 26 Supabase migrations, React Native / Expo SDK 54, NativeWind v4, Zustand v5, TanStack Query v5
- **Backend state**: Hono v4 at `https://ziko-api-lilac.vercel.app`, Upstash Redis rate limiting, secureHeaders, Zod validation, AI orchestrator with pantry + nutrition tools, Supabase Storage (3 buckets + signed URLs), lifecycle cron cleanup, centralized model config (`backend/api/src/config/models.ts`)
- **Design system**: Light sport theme — primary `#FF5C1A` (orange), background `#F7F6F3`, text `#1C1A17`, border `#E2E0DA`. No dark mode.
- **Legal jurisdiction**: French law — RGPD, mentions legales mandatory, CGU required.
- **Infrastructure**: API + web on Vercel, Supabase (DB + Auth + Storage), Upstash Redis

## Constraints

- **Tech Stack**: Next.js 14+ (App Router), Vercel deployment — non-negotiable
- **i18n**: French + English — routing via `next-intl`
- **Legal**: All RGPD/French legal pages mandatory
- **Security**: Account deletion uses server-side Supabase admin client; service role key never in client bundle
- **Design**: Must match Ziko brand (orange #FF5C1A, light sport aesthetic)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Upstash Redis (HTTP) over ioredis | Vercel serverless has no persistent connections; HTTP REST works on cold starts | v1.3 |
| Signed URL upload pattern | Vercel hard limit 4.5 MB; mobile uploads directly to Supabase Storage | v1.3 |
| Path-prefix RLS for storage | `storage.objects` has no `user_id` column; `(storage.foldername(name))[1]` pattern | v1.3 |
| Sliding window over fixed window | Prevents boundary spike traffic in rate limiting | v1.3 |
| Separate AI credits table (not gamification coins) | Dual balance — coins are unlimited reward currency, credits are cost-controlled AI currency (CRED-07) | v1.4 Phase 17 |
| Centralized model constants file | Single file to update when model IDs change; prevents drift across 3+ backend files (COST-01) | v1.4 Phase 17 |
| SECURITY DEFINER + SELECT FOR UPDATE in deduct RPC | Application-layer check-then-deduct races under Vercel Fluid Compute produce negative balances; DB-level lock eliminates it | v1.4 Phase 17 ✓ |
| Partial unique index (WHERE idempotency_key IS NOT NULL) | ON CONFLICT DO NOTHING eliminates double-crediting on mobile retry without requiring all rows to have idempotency keys | v1.4 Phase 17 ✓ |
| Lazy daily-reset (date-keyed check at earn time) | No cron dependency — avoids Vercel at-least-once cron delivery causing double-resets | v1.4 Phase 18 ✓ |
| POST /earn always returns HTTP 200 { credited: boolean } | Mobile client must never crash on earn failure; 4xx would require error handling in fire-and-forget context | v1.4 Phase 20 ✓ |
| AIBridge 402 body slice extended 200→500 chars | earned_today array with ≥1 source exceeds 200 chars; truncation caused silent JSON.parse failure and no exhaustion sheet | v1.4 Phase 21 ✓ |
| Monorepo path: apps/web in ziko-platform via git subtree (no --squash) | Preserves full c:/ziko-web history; dual-repo fallback 23-02b not needed; D-01/D-02 triple-green PASS | v1.5 Phase 23 ✓ |
| @supabase/ssr dual-store cookie pattern (request + response) | Fresh tokens must propagate to downstream Server Components; stale JWT on locale redirects causes auth loops | v1.5 Phase 23 ✓ |
| coach-sdk peerDependency zod ^4.0.0 + external:['zod'] in tsup | Prevents zod-instance drift across workspace; CJS bundle 3.6 KB (zod not inlined); T-23-03-02 mitigated | v1.5 Phase 23 ✓ |
| (coach) route group with hard-coded redirect('/fr/login') | No searchParams.next interpolation prevents open-redirect (T-23-06-01 Tampering); Server Action independently re-calls getUser() for TOCTOU defense | v1.5 Phase 23 ✓ |
| NEXT_PUBLIC_API_URL must be set in apps/web | Missing env var caused "Failed to fetch" on /storage/upload-url — component fell back to localhost:3000 (unreachable in production). Added to apps/web/.env. | v1.5 Phase 24 ✓ |
| Marketing pages isolated in (marketing) route group | locale root layout rendered sticky `<Header />` unconditionally — coach pages inherited it, causing CoachSidebar to slide behind. Moving marketing pages to `[locale]/(marketing)/layout.tsx` strips Header/Footer from all coach routes cleanly. | v1.5 Phase 24 ✓ |
| loginAction uses `getLocale()` + `/${locale}/` prefix on all redirects | loginAction returned hardcoded locale-less paths ('/coach/onboarding') causing 404 in next-intl; all redirects now prefixed dynamically. | v1.5 Phase 24 ✓ |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-14 — v1.16 Exercise Library Import (`image-exo`) parallel workstream started.*

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Design + data together per screen (not two separate passes) | User requested "design + data ensemble" — prevents drift between UI and data layer | v1.7 decision |
| Active workout session screen excluded from v1.7 | `workout-active.jsx` already functional; user explicitly said "seulement session active" | v1.7 decision |
| 3-tab nav (Accueil/Séance/Profil) replacing 4-tab structure | `app.jsx` mockup has 3 tabs; PluginsDrawer on home replaces separate plugin tab | v1.7 Phase 32 |
| New shared components in `packages/ui/` | FormRing, AISuggestion, SubTabs, PluginHeader, WeekStrip shared across all plugins | v1.7 Phase 32 |
| Rule-based AICoachInline tips (not AI chat) | Mockup shows rotating contextual tips, not a chat UI; saves AI credits for real coach interactions | v1.7 Phase 33 |
| UI design contract mandatory before any dashboard code (ui_safety_gate: true) | Prevents UI drift between spec and implementation; all 11 surfaces + data shapes locked before Phase 38 | v1.8 Phase 37 ✓ |
| Recharts v3 for dashboard charts (already installed in ComparisonChart.tsx) | No new dependency; consistent with existing chart patterns in codebase | v1.8 Phase 37 ✓ |
| Existing Supabase tables only — no new data collection for dashboards | session_sets + cardio_sessions + body_measurements + nutrition_logs cover all 6 sport dashboards | v1.8 Phase 38 ✓ |
| is_coach_of() SECURITY DEFINER function for cross-user data access | Coach reads athlete data without bypassing RLS; athlete cannot access coach data | v1.8 Phase 38 ✓ |
| Inline ThresholdAlert type (not imported) for crossedThresholds prop | Matches existing ChartCard.tsx pattern — avoids creating a type just for one optional prop | v1.8 Phase 41.1 ✓ |
