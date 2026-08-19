# Phase 26: CRM Client Management — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 25 (complete 2026-05-17)

<domain>
## Phase Boundary

Phase 26 ships the **coach-facing CRM core**: browse linked clients, drill into any client's
data read-only across 7 data tabs, view an executive summary, attach private tags and notes,
compare multiple clients on a chart, and revoke coach↔client links from the dashboard.

**In scope (CLIENT-01 through CLIENT-08):**
- `/coach/clients` — paginated TanStack Table roster with search + signal filters
- `/coach/clients/[id]` — tabbed read-only detail (7 tabs, per-tab server fetch)
- Executive summary card (sessions compliance + habit completion + last workout + mood trend)
- `coach_client_tags` + `coach_client_notes` — new tables (new migration ~041/042)
- Multi-client comparison chart (Recharts, 3–5 clients, common metrics)
- Coach-side link revocation (2-step confirmation, immediate RLS effect)

**Out of scope (explicitly deferred):**
- Mobile "Mon coach" plugin — v1.6 seed (Phase 25 deferred)
- Writing to any client data — coach is read-only on all athlete tables
- Real-time data refresh — standard `cache:'no-store'` server fetch is sufficient
- Notes history / append-only log — just `updated_at` (versioning defined as single overwrite)
- Programs tab in client detail — Phase 27 (assigned programs don't exist yet)

</domain>

<decisions>
## Implementation Decisions

### Roster List (CLIENT-01, CLIENT-02)

- **D-01 — Full TanStack Table.** Install `@tanstack/react-table` in `apps/web`. Client-side
  sorting, filtering, pagination, column toggle. Matches ROADMAP SC1 literally. The existing
  `InvitationsTable.tsx` in Phase 25 uses a hand-rolled table — Phase 26 is the first use of
  TanStack Table in the web app. Keep InvitationsTable as-is (no retrofit needed).
- **D-02 — Signal filter definitions (date-threshold checks):**
  - "Missed last 2 sessions" → no `workout_sessions` row in last **14 days**
  - "Measurements stale >4w" → no `body_measurements` row in last **28 days**
  - "Mood declining" → avg mood of last 3 `journal_entries` < avg mood of previous 3 entries
  Filter chips render client-side on the TanStack Table (no extra server round-trip once data
  is loaded). Signals are pre-computed in the server fetch (SELECT aggregates per client) and
  passed as boolean flags.
- **D-03 — Search behavior.** Name search is client-side (TanStack Table `globalFilter`) —
  no debounce needed since all linked clients are loaded in a single server fetch (coaches
  typically have <100 clients in v1.5; no pagination backend required).
- **D-04 — Empty state.** When a coach has no linked clients: full-page empty state with
  illustration + "Invitez votre premier client" CTA linking to `/coach/invitations`. Same
  design pattern as `InvitationsTable` empty state.

### Client Detail Tabs (CLIENT-03)

- **D-05 — All 7 tabs in Phase 26 MVP.** Sessions, measurements, habits, nutrition, sleep,
  cardio, journal — all read-only, all in Phase 26. No deferred subset.
- **D-06 — Per-tab dynamic route segments.** URL pattern:
  `/[locale]/(coach)/coach/clients/[id]/[tab]` where `[tab]` ∈ `sessions | measurements |
  habits | nutrition | sleep | cardio | journal`. Each tab is a Server Component that
  independently fetches via `is_coach_of` RLS. Default tab on `/clients/[id]` redirects to
  `sessions`. `force-dynamic` + `revalidate=0` + `cache:'no-store'` on all (Phase 23 D-15).
- **D-07 — Tab data queries.** Each tab fetches its own table (e.g. `workout_sessions` for
  sessions, `body_measurements` for measurements). All reads use the per-request JWT Supabase
  client (`createServerSupabase()`) — `is_coach_of` RLS kicks in automatically. No service-role.
  Show last 30 rows by default with a "Voir plus" link or simple load-more if >30.
- **D-08 — Read-only enforcement.** UI renders data only — no edit controls, no delete
  buttons. A prominent "Vue lecture seule" badge on the detail page header clarifies scope.

### Executive Summary Card (CLIENT-04)

- **D-09 — "Weekly compliance %" = both sessions + habits.** The summary card shows two
  sub-metrics side by side:
  - **Sessions:** `X / 3 sessions this week` (count of `workout_sessions` WHERE created_at
    >= start of current week; denominator = 3, assumed default frequency, not configurable
    in Phase 26).
  - **Habits:** `Y%` average daily completion rate over last 7 days (habit_logs count /
    habits count per day, averaged). If athlete has no habits configured, show "–".
- **D-10 — 14-day mood trend = color badge + avg delta.** Display:
  `Humeur: ↓ 3.2 → 2.8` (last 7d avg → prev 7d avg) with red/orange/green badge.
  Red: delta < -0.3 · Orange: delta -0.3 to 0 · Green: delta > 0 · Grey: insufficient data.
  No sparkline in the summary card (sparkline lives in the full journal tab).
- **D-11 — Other summary fields:**
  - Last workout: date of most recent `workout_sessions` row ("Il y a 3 jours" relative).
  - Latest measurement: most recent `body_measurements.weight_kg` + date.

### Tags & Notes Schema (CLIENT-05, CLIENT-06)

- **D-12 — New migration for `coach_client_tags` + `coach_client_notes`.** Migration number
  to be confirmed by researcher (likely 041 — Phase 25 used 040 for peek_invitation).

  ```sql
  -- coach_client_tags: free-text labels, multiple per client per coach
  CREATE TABLE public.coach_client_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tag         TEXT NOT NULL CHECK (char_length(tag) <= 50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, client_id, tag)
  );
  ALTER TABLE public.coach_client_tags ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "coach_client_tags_own" ON public.coach_client_tags
    USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

  -- coach_client_notes: single note per coach↔client pair, overwritten on update
  CREATE TABLE public.coach_client_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, client_id)
  );
  ALTER TABLE public.coach_client_notes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "coach_client_notes_own" ON public.coach_client_notes
    USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
  ```

- **D-13 — Notes versioning = `updated_at` only.** A single row per coach↔client pair;
  saving overwrites `content` + `updated_at`. No history table. Satisfies CLIENT-06
  ("version-tracked by updated_at"). Append-only log is deferred to v1.6.
- **D-14 — Tags UX.** Input field with chip display (similar to `SpecialtyTagInput.tsx` from
  Phase 24 — reuse or clone pattern). Add tag on Enter/comma, remove on chip × click.
  Tags + notes are in a side panel or collapsible section on the client detail page
  (Claude's Discretion on exact layout).
- **D-15 — Tags + notes are coach-private.** Never visible to the athlete. Backend routes
  must enforce `coach_id = auth.uid()` in WHERE clauses (RLS policies already enforce it,
  but service layer also checks for defense-in-depth).

### Multi-Client Comparison (CLIENT-07)

- **D-16 — Recharts.** Install `recharts` in `apps/web`. LineChart for time-series metrics
  (body weight over time, sleep hours, mood), BarChart for aggregate metrics (weekly volume,
  1RM). Chosen for React-first API and reasonable bundle size.
- **D-17 — Available comparison metrics (Phase 26):**
  - Body weight (kg) — from `body_measurements`
  - Weekly training volume (session count) — from `workout_sessions`
  - Sleep duration (hrs) — from `sleep_logs`
  - Mood (avg score) — from `journal_entries`
  Metric: 1RM on a specific lift is deferred to Phase 27 (requires exercise-level data).
- **D-18 — Client selection UI.** Multi-select checkboxes on the roster list (max 5).
  A "Comparer (N)" sticky button appears when ≥2 clients are selected. Clicking opens a
  full-page comparison view at `/coach/clients/compare?ids=id1,id2,id3`.
- **D-19 — Comparison page.** Single metric selector dropdown (defaults to body weight).
  LineChart with one line per client (different colors, legend). Date range selector:
  "30j / 90j / 1an". Server-fetched on load, no real-time updates.

### Coach-Side Link Revocation (CLIENT-08)

- **D-20 — New backend route.** Add `DELETE /coach/clients/links/:clientId` in
  `backend/api/src/coach/clients/service.ts` (coach revoking the link, authorized by
  `coach_id = auth.uid()`). Distinct from the existing athlete-revoke route in Phase 25
  (`DELETE /coach/clients/links/:id` where requester must be `client_id`).
- **D-21 — 2-step confirmation modal.** Same typed-confirmation pattern as Phase 25
  (RevokeConfirmModal.tsx): "Tapez COACH pour confirmer". Copy: title "Retirer ce client ?"
  + body "[Client] perdra l'accès à vos programmes assignés. Vous perdrez l'accès à leurs données."
  + red "Retirer" button. Available from both the roster list (actions column) and the
  client detail page header.

### New Backend Routes (coach/clients module extension)

- **D-22 — Extend `coach/clients` bounded module** with coach-facing read routes:
  - `GET /coach/clients` — list all linked clients with aggregate fields (name, photo_url,
    last_active, signal flags). Uses `is_coach_of` via RLS.
  - `GET /coach/clients/:id/summary` — executive summary aggregates (sessions this week,
    habit completion %, last workout date, latest weight, mood trend delta).
  - `GET /coach/clients/:id/sessions` — paginated workout_sessions for client.
  - `GET /coach/clients/:id/measurements` — body_measurements for client.
  - `GET /coach/clients/:id/habits` — habits + habit_logs for client (last 30 days).
  - `GET /coach/clients/:id/nutrition` — nutrition_logs for client (last 30 days).
  - `GET /coach/clients/:id/sleep` — sleep_logs for client (last 30 days).
  - `GET /coach/clients/:id/cardio` — cardio_sessions for client (last 30 days).
  - `GET /coach/clients/:id/journal` — journal_entries for client (last 30 days).
  - `GET /coach/clients/:id/tags` + `POST` + `DELETE /coach/clients/:id/tags/:tagId`
  - `GET /coach/clients/:id/notes` + `PUT /coach/clients/:id/notes`
  - `DELETE /coach/clients/links/:clientId` — coach-side revoke (D-20)
  - `GET /coach/clients/compare` — batch aggregates for comparison chart

  **All routes:** per-request JWT client, `is_coach_of` RLS enforced automatically. No
  service-role. Bounded module pattern (service.ts public entry only).

### Web Architecture

- **D-23 — New web route group.** `/[locale]/(coach)/coach/clients/` with sub-pages:
  - `page.tsx` — roster list (TanStack Table)
  - `[id]/page.tsx` → redirects to `[id]/sessions/page.tsx`
  - `[id]/sessions/page.tsx`, `[id]/measurements/page.tsx`, etc. (7 tab pages)
  - `compare/page.tsx` — multi-client comparison chart
- **D-24 — Sidebar "Clients" enabled.** Flip `disabled: false` on the "Clients" nav item in
  `CoachSidebar.tsx`. Phase 26 also unlocks it (same pattern as "Invitations" in Phase 25).

### Claude's Discretion

- Exact Tailwind class structure for TanStack Table wrapper (column widths, hover states,
  sticky header).
- Whether the executive summary card uses a 2-column or 4-column grid layout.
- Whether tags + notes appear in a right-side panel on the detail page or as a bottom section.
- Exact color coding for the mood trend badge (precise Tailwind color values within the
  design system).
- Whether comparison metric selector is a `<select>` or a styled dropdown component.
- Whether "load more" in tab data is a button or infinite scroll (given per-tab server pages).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — vision, bounded-contexts architecture, v1.5 key decisions log
- `.planning/REQUIREMENTS.md` — §CLIENT-01..08, §ARCH-01..08; Out of Scope (AG Grid out)
- `.planning/ROADMAP.md` — §Phase 26 success criteria (5 SCs), §Open Decisions table
- `.planning/STATE.md` — v1.5 completion record through Phase 25, current pending todos

### Phase 22 (DB keystone)
- `.planning/phases/22-schema-foundation-rls-keystone/22-CONTEXT.md` — D-01 (`is_coach_of`
  shape), D-02 (11 cross-user SELECT policies on athlete tables), D-06/D-07/D-08 (invitation
  + link schema). Phase 26 reads from ALL 11 athlete tables via these policies.
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of()` + 11
  `<table>_coach_read` FOR SELECT policies. Phase 26 new migration must NOT break these.

### Phase 23 (web foundation)
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md` — D-15
  (`force-dynamic` + `revalidate=0` + `cache:'no-store'` mandatory on all coach routes),
  D-11 (ESLint ban on direct `@supabase/supabase-js` in Server Components)
- `apps/web/src/lib/supabase/server.ts` — `createServerSupabase()` factory

### Phase 24 (bounded module pattern)
- `.planning/phases/24-coach-identity-onboarding/24-CONTEXT.md` — D-08 (bounded module
  shape: service.ts public entry, db.ts internal, types.ts internal)
- `backend/api/src/coach/identity/{service.ts,db.ts,types.ts}` — reference shape

### Phase 25 (existing coach/clients module)
- `.planning/phases/25-invitations-mobile-mon-coach-minimal/25-CONTEXT.md` — D-04 to D-09
  (existing routes in `coach/clients/` + `coach/invitations/`), D-20 (coach-sdk schemas)
- `backend/api/src/coach/clients/service.ts` — existing athlete-side routes Phase 26 extends
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` — reuse for coach-side revocation
- `apps/web/src/components/coach/InvitationsTable.tsx` — reference for table + empty-state pattern
- `apps/web/src/components/coach/CoachSidebar.tsx` — flip `disabled: false` on Clients entry

### External (research targets)
- `@tanstack/react-table` v8 docs — table instance, column definitions, global filter, sorting
- `recharts` docs — LineChart, BarChart, ResponsiveContainer, Legend for comparison chart
- `packages/coach-sdk/src/schemas/` — existing schemas; Phase 26 may add ClientSummarySchema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/src/coach/clients/{service.ts,db.ts,types.ts,ratelimit.ts}` — existing module.
  Phase 26 adds coach-read routes to this module (extends, does NOT replace).
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` — typed-confirmation pattern.
  Reuse for coach-side client revocation (change copy only).
- `apps/web/src/components/coach/InvitationsTable.tsx` — hand-rolled table + filter chips +
  empty-state. Reference pattern for TanStack Table wrapper design consistency.
- `apps/web/src/components/coach/FilterChipGroup.tsx` — Phase 25 filter chips component.
  Reuse for signal filter chips on the roster page.
- `apps/web/src/components/coach/KycStatusChip.tsx` — chip component. Reuse/clone for
  signal flag chips (missed sessions, stale measurements, mood declining).
- `apps/web/src/components/coach/SpecialtyTagInput.tsx` — tag input with chip display.
  Clone/adapt for `coach_client_tags` input.
- `apps/web/src/components/coach/WelcomeCard.tsx` — card layout reference for executive
  summary card structure.
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Server Component pattern
  with `force-dynamic` + `createServerSupabase()` + `getLocale()`. Clone for all Phase 26
  pages.

### Established Patterns
- **Bounded contexts:** `backend/api/src/coach/<module>/{service.ts,db.ts,types.ts}` —
  service.ts only public entry. Phase 26 extends `coach/clients/` (does not create new module).
- **Per-request JWT:** `createUserClient(jwt)` in `db.ts`; `is_coach_of` RLS auto-applied.
- **Server Component pages:** `force-dynamic` + `revalidate=0` + `cache:'no-store'` at top.
- **Route groups:** `[locale]/(coach)/coach/` with auth-guard layout.tsx (Phase 23).
- **Design tokens:** `#FF5C1A` primary, `#F7F6F3` background, `#1C1A17` text, `#E2E0DA` border.
- **i18n:** `next-intl` namespaces on web — Phase 26 adds `coach.clients.*` namespace.

### Integration Points
- **CoachSidebar.tsx** — flip `disabled: false` on "Clients" `href: '/fr/coach/clients'`.
- **Hono router** (`backend/api/src/index.ts`) — `clientsRouter` already mounted at
  `/coach/clients`. Phase 26 adds new route handlers to the existing router.
- **`packages/coach-sdk`** — may add `ClientSummarySchema` + `CoachClientTagSchema` +
  `CoachClientNoteSchema` Zod schemas for backend↔web validation.

</code_context>

<specifics>
## Specific Ideas

- Signal filter thresholds: "missed 2 sessions" = no workout in 14 days; "stale measurements"
  = no body_measurements in 28 days; "mood declining" = last-3 avg < prev-3 avg.
- Weekly compliance = TWO sub-metrics: `X/3 sessions this week` + `Y% habits (7d avg)`.
- Mood trend display: `Humeur: ↓ 3.2 → 2.8` color badge (red/orange/green/grey).
- Comparison metrics available: body weight, weekly session count, sleep hours, mood avg.
  1RM deferred to Phase 27.
- Comparison URL: `/coach/clients/compare?ids=id1,id2,id3`.
- Notes versioning: `updated_at` only — single overwrite row per coach↔client pair.
- Coach revoke copy: "Retirer ce client ?" + "Tapez COACH pour confirmer".
- "Vue lecture seule" badge on client detail page header.
- Default tab on `/clients/[id]` → redirect to `sessions` tab.
- Empty roster state: full-page with "Invitez votre premier client" CTA → `/coach/invitations`.

</specifics>

<deferred>
## Deferred Ideas

- **Notes history / append-only log** — single overwrite in Phase 26; full history in v1.6.
- **1RM comparison metric** — requires session_sets exercise-level data; deferred to Phase 27
  when workout program execution is in scope.
- **Habit compliance configuration** — Phase 26 uses fixed denominator of 3 sessions/week;
  per-client target frequency deferred to Phase 27 (where coach assigns programs).
- **Programs tab on client detail** — no assigned programs exist until Phase 27; add the tab
  in Phase 27 gap closure.
- **Multi-coach per athlete** — DB UNIQUE constraint currently allows one active link per
  coach↔client pair; Phase 25 D-16 notes this. Multiple coaches per athlete deferred to v1.6.
- **Real-time roster refresh** — Supabase Realtime for live client activity updates; deferred
  post-v1.5 (standard server fetch sufficient for v1.5 coach use).
- **Bulk tag operations** — tag all selected clients at once; deferred to Phase 27+.
- **GDPR hard-purge on revocation** — Phase 22 uses SET NULL (D-12). Legal review for
  CASCADE purge deferred; Phase 26 CONTEXT notes this for the researcher.

</deferred>

---

*Phase: 26-crm-client-management*
*Context gathered: 2026-05-18*
