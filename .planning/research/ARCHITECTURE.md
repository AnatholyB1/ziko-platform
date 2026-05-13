# Architecture Research — v1.5 Coach Platform & CRM

**Domain:** Ziko Platform v1.5 — Coach Platform, Client CRM, AI File Imports, Strava Integration
**Researched:** 2026-05-13
**Confidence:** HIGH — all integration points cross-verified against existing repo (`backend/api/src/app.ts`, `tools/registry.ts`, migrations 001/026/032/033)

---

## Overview

v1.5 introduces a coach-facing web CRM as a Next.js app inside the Turborepo (`apps/web/`), six new bounded-context modules in the Hono backend (`backend/api/src/coach/{identity,clients,programs,invitations,imports,ai}`), eight new Supabase tables (one of which — `coach_client_links` — drives cross-user RLS access), one column extension on `user_profiles` (`role`), one extension on `workout_programs` (coaching fields), and two new integrations (Claude vision/document parsing for file imports + Strava OAuth + webhook reconciliation). Existing client-side architecture (mobile, RLS-per-user pattern, credit system, AI orchestrator) is left structurally intact — coach features are additive.

The architecture deliberately mirrors module boundaries between backend (`coach/<module>`) and Next.js (`app/(coach)/<module>`) so that the future ERP milestones (`coach/billing`, `coach/scheduling`) can be added without disturbing any v1.5 module.

---

## High-Level Topology

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       Turborepo (existing)                                  │
│                                                                            │
│  apps/                                                                     │
│    mobile/      Expo SDK 54 — adds: invitation entry, "Mon coach" screen   │
│    web/         Next.js 14 App Router (NEW or migrated from public repo)   │
│      app/                                                                  │
│        (marketing)/     /coachs FR/EN landing  (NEW)                       │
│        (coach)/         /coach/* authenticated CRM  (NEW)                  │
│          identity/   programs/   clients/[id]/   imports/   ai/            │
│                                                                            │
│  backend/api/src/                                                          │
│    coach/         (NEW — bounded contexts)                                 │
│      identity/    clients/    programs/    invitations/    imports/   ai/  │
│    routes/        (existing — ai, plugins, credits, storage, …)            │
│    middleware/    (existing — auth, rateLimiter, credits)                  │
│    tools/         (existing registry — 3 new coach tools wired in)         │
│                                                                            │
│  packages/                                                                 │
│    plugin-sdk/   (existing — shared theme, i18n, AITool type)              │
│    coach-sdk/    (NEW — shared Zod schemas for coach domain, used by both  │
│                  Next.js web and Hono backend; mirrors plugin-sdk pattern) │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Supabase Postgres                                                          │
│    NEW tables:  coach_profiles, coach_client_links, coach_invitations,     │
│                 coach_programs_meta (or merged into workout_programs ext), │
│                 ai_imports, strava_accounts, strava_webhook_events         │
│    EXTENDED:    user_profiles (role), workout_programs (coach fields)      │
│    NEW RPC:     is_coach_of(coach_uuid, client_uuid)  — SECURITY DEFINER   │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  External services                                                          │
│    Anthropic (existing) — Claude vision/document for AI imports            │
│    Strava OAuth + webhook — NEW                                            │
│    Supabase Storage (existing) — reused for import file uploads            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Bounded Contexts

The boundary rule: **a module owns its tables, its Hono routes, its web routes, its types, and (optionally) its AI tools.** Cross-module reads go through the owning module's service layer — never direct table reads from another module's code. This is what makes the v1.6 ERP modules drop-in.

### Module 1 — `coach/identity`

Owns the concept of "a user who is a coach": signup, profile, light KYC, role transitions.

| Concern | Owns |
|---------|------|
| Tables (NEW) | `coach_profiles` (display_name, bio, specialties[], website, kyc_status, created_at) |
| Tables (EXTENDED) | `user_profiles.role TEXT CHECK (role IN ('client','coach','both')) DEFAULT 'client'` |
| Hono routes | `POST /coach/identity/signup` (promote existing user_profile to coach), `GET /coach/identity/me`, `PATCH /coach/identity/me`, `POST /coach/identity/kyc-submit` |
| Web routes | `(coach)/onboarding`, `(coach)/settings/profile`, `(coach)/settings/kyc` |
| Types (`packages/coach-sdk`) | `CoachProfile`, `CoachIdentityState`, `KycStatus` |
| AI tools | None |
| Depends on | nothing (root of the dependency tree) |
| Provides to others | `getCoachProfile(coachId)`, `requireCoachRole(userId)` service helpers; `is_coach(user_id)` SQL fn |
| **ERP migration** | `coach/billing` will FK `coach_subscriptions.coach_id → coach_profiles.user_id`; `coach/scheduling` will FK `coach_calendar_settings.coach_id → coach_profiles.user_id`. The `coach_profiles` table never changes — billing/scheduling extend, do not modify. |

### Module 2 — `coach/invitations`

Owns the 6-character invitation code lifecycle and the act of binding a client to a coach.

| Concern | Owns |
|---------|------|
| Tables (NEW) | `coach_invitations (id UUID, coach_id UUID, code TEXT UNIQUE, expires_at TIMESTAMPTZ, max_uses INT DEFAULT 1, used_count INT DEFAULT 0, created_at)` |
| Hono routes | `POST /coach/invitations` (generate code, coach-only), `GET /coach/invitations` (list own codes), `DELETE /coach/invitations/:id` (revoke), `POST /coach/invitations/redeem` (client-side: validates code, creates link in `coach/clients` via service call) |
| Web routes | `(coach)/invitations` — list + generate + share-link UI |
| Mobile UI | Onboarding step + profile screen: "Enter coach code" → calls `POST /coach/invitations/redeem` |
| Types | `Invitation`, `RedeemResult` |
| AI tools | None |
| Depends on | `coach/identity` (only coaches can create); `coach/clients` (calls its `createLink()` service on redeem) |
| Provides | `validateAndConsumeCode(code, clientUserId)` → returns `{coach_id}` |
| **ERP migration** | Stable. Billing/scheduling don't touch invitations. |

Code generation: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (exclude `IO01` to avoid confusion), generated server-side, retried on UNIQUE collision. Default expiry: 30 days. `max_uses` left configurable in schema but always 1 in v1.5 UI.

### Module 3 — `coach/clients`

Owns the **link relation** between coach and client, and exposes read access to linked-client data. This is the trickiest module because it crosses RLS boundaries.

| Concern | Owns |
|---------|------|
| Tables (NEW) | `coach_client_links (id UUID, coach_id UUID REFERENCES auth.users, client_id UUID REFERENCES auth.users, status TEXT CHECK status IN ('active','revoked'), invited_via UUID REFERENCES coach_invitations(id), created_at, revoked_at, UNIQUE(coach_id, client_id) WHERE status = 'active')` |
| Hono routes | `GET /coach/clients` (list active links + denormalized client preview), `GET /coach/clients/:clientId` (full client detail aggregate), `DELETE /coach/clients/:clientId` (revoke), `GET /coach/clients/:clientId/sessions`, `GET /coach/clients/:clientId/measurements`, `GET /coach/clients/:clientId/habits`, `GET /coach/clients/:clientId/nutrition`, `GET /coach/clients/:clientId/sleep`, `GET /coach/clients/:clientId/cardio` |
| Web routes | `(coach)/clients` (list+search), `(coach)/clients/[clientId]` (tabbed detail) |
| Mobile UI | "Mon coach" screen → calls a mirror endpoint `GET /coach/clients/my-coach` (client side reading their own link) |
| Types | `CoachClientLink`, `ClientPreview`, `ClientAggregate` |
| AI tools | None directly; consumed by `coach/ai` |
| Depends on | `coach/identity` (for coach role gate) |
| Provides | `isCoachOf(coachId, clientId)` boolean, `getLinkedClients(coachId)`, `getClientAggregate(coachId, clientId)` |
| **ERP migration** | Stable. Billing will read `coach_client_links` to count active clients (read-only). Scheduling will FK sessions to (`coach_id`, `client_id`) but the link table doesn't change. |

**This is where the cross-user RLS is solved.** See "RLS Policies — Coach Cross-User Access" below.

### Module 4 — `coach/programs`

Owns coach-authored programs (templates) and assignments to clients. Extends the existing `workout_programs` rather than duplicating.

| Concern | Owns |
|---------|------|
| Tables (EXTENDED) | `workout_programs`: ADD COLUMN `created_by_coach_id UUID REFERENCES auth.users(id)`, `assigned_to_user_id UUID REFERENCES auth.users(id)`, `is_template BOOLEAN DEFAULT FALSE`, `weeks_data JSONB`, `template_source_id UUID REFERENCES workout_programs(id)` (when a template is forked into an assignment) |
| Tables (NEW) | None — single-table model. (Decision: extending `workout_programs` is correct because the existing `user_id` column doubles as "owner" — for a template, `user_id = created_by_coach_id`; for an assignment, `user_id = assigned_to_user_id` and `created_by_coach_id` records authorship.) |
| Hono routes | `GET /coach/programs/templates` (coach's own templates), `POST /coach/programs/templates`, `PATCH /coach/programs/templates/:id`, `DELETE /coach/programs/templates/:id`, `POST /coach/programs/templates/:id/assign` (forks template → creates assignment row for a client), `GET /coach/programs/assignments` (filterable by client), `PATCH /coach/programs/assignments/:id`, `DELETE /coach/programs/assignments/:id` |
| Web routes | `(coach)/programs` (template library), `(coach)/programs/[id]/edit`, `(coach)/clients/[clientId]/programs` (assignments view) |
| Mobile | Read-only on "Mon coach" — uses existing `workout_programs` reads (which already work via `user_id = auth.uid()` since the assignment row's `user_id = client_id`) |
| Types | `WorkoutProgramExtended`, `ProgramTemplate`, `ProgramAssignment` |
| AI tools | None directly; consumed by `coach/ai` and `coach/imports` (both write programs) |
| Depends on | `coach/identity`, `coach/clients` (to validate coach has link to target client on assignment) |
| Provides | `assignTemplateToClient(coachId, templateId, clientId)`, `listTemplates(coachId)`, `listAssignments(coachId, clientId?)` |
| **ERP migration** | Stable. `coach/scheduling` will reference `program_assignments` to plan sessions; no shape change. |

### Module 5 — `coach/imports`

Owns the AI file → structured program/sessions pipeline (replaces CSV).

| Concern | Owns |
|---------|------|
| Tables (NEW) | `ai_imports (id UUID, user_id UUID, mode TEXT CHECK IN ('athlete_self','coach_template','coach_for_client'), target_client_id UUID NULL, source_storage_path TEXT, source_mime TEXT, status TEXT CHECK IN ('uploaded','parsing','preview_ready','committed','failed','cancelled'), parsed_json JSONB, committed_program_id UUID REFERENCES workout_programs(id), error_message TEXT, credit_cost INT, created_at, updated_at)` |
| Hono routes | `POST /coach/imports/upload-url` (returns signed Supabase Storage URL — reuses v1.3 pattern), `POST /coach/imports/:id/parse` (triggers Claude vision/document → generateObject → writes parsed_json, advances status), `GET /coach/imports/:id` (poll status + preview), `POST /coach/imports/:id/commit` (writes to `workout_programs` via `coach/programs` service), `DELETE /coach/imports/:id` (cancel/cleanup) |
| Web routes | `(coach)/imports` (list), `(coach)/imports/new` (uploader + preview/commit) |
| Mobile | `(plugins)/ai-programs/import` screen — same flow, mode='athlete_self' |
| Types | `ImportJob`, `ParsedProgram` (Zod schema in `coach-sdk`), `ImportPreview` |
| AI tools | None exposed to orchestrator (imports are an explicit user action with a preview, not an autonomous tool call) |
| Depends on | `coach/programs` (for commit path), `coach/clients` (for `coach_for_client` mode to verify link), existing `routes/credits.ts` (cost gate), existing `routes/storage.ts` (signed URL bucket) |
| Provides | Nothing exported to other modules |
| **ERP migration** | Stable. |

The parsed program Zod schema lives in `packages/coach-sdk` so both web (for preview rendering) and backend (for `generateObject` shape) reference the same source of truth.

### Module 6 — `coach/ai`

Owns the three coach-specific AI tools and their wiring into the existing AI orchestrator. Does **not** own its own chat endpoint — reuses `/ai/chat/stream`. The orchestrator decides whether the user is a coach (via the role column) and what tool set is exposed.

| Concern | Owns |
|---------|------|
| Tables | None |
| Hono routes | None new — extends existing `/ai/chat/stream` via tool injection |
| Web routes | `(coach)/ai` — coach AI chat UI (Next.js, calls the same `/ai/chat/stream` SSE endpoint as mobile but with `audience: 'coach'` header or message metadata) |
| Tool registrations (added to `backend/api/src/tools/registry.ts`) | `analyze_client(client_id)`, `generate_coaching_program(client_id, goal, weeks, …)`, `monitor_client_alerts(client_id?)` |
| Types | `AnalyzeClientResult`, `MonitoringAlert` |
| AI tools | The three above. Each tool's executor calls `coach/clients.isCoachOf(userId, params.client_id)` first — RLS via service layer, not just DB layer. |
| Depends on | `coach/clients` (link verification + data reads), `coach/programs` (program generation write path) |
| Provides | Nothing |
| **ERP migration** | Future `coach/billing` may add a `report_invoice_summary` tool; `coach/scheduling` may add `propose_session_slots`. All slot into the same registry. |

---

## Cross-Module Communication

**Decision: direct service-layer imports within the same Hono process. No internal HTTP, no event bus.**

Rationale: Hono runs in a single Vercel serverless function. Cross-module calls become TypeScript function calls into a thin `service.ts` file per module. This:

1. Avoids HTTP overhead and serialization on each call.
2. Keeps types end-to-end without contract duplication.
3. Lets us still enforce the boundary by **import linting** — each module exports a single `service.ts` index; routes/handlers in other modules may only import from that index (enforced via an ESLint rule `no-restricted-imports` allowing `coach/<m>/service` but disallowing `coach/<m>/db` or `coach/<m>/internal/*`).

```
backend/api/src/coach/
  identity/
    routes.ts        ← Hono sub-router, mounted at /coach/identity
    service.ts       ← public API for other modules
    db.ts            ← internal Supabase queries (private)
    schemas.ts       ← Zod schemas (re-exported from packages/coach-sdk where shared)
  clients/
    routes.ts
    service.ts       ← exports isCoachOf, getClientAggregate, createLink, …
    db.ts
    schemas.ts
  programs/   { routes, service, db, schemas }
  invitations/ { routes, service, db, schemas }
  imports/    { routes, service, db, schemas, parser.ts }
  ai/
    tools.ts         ← exports analyze_client, generate_coaching_program, monitor_client_alerts
    schemas.ts
  index.ts           ← mounts each sub-router on the parent /coach router
```

**Mount point** in `app.ts`:
```ts
import { coachRouter } from './coach/index.js';
app.route('/coach', coachRouter);
```

**Tool registry wiring** in `backend/api/src/tools/registry.ts`:
```ts
import * as CoachAiTools from '../coach/ai/tools.js';
// ...add to schemas array and executors map (same pattern as habits, cardio, etc.)
```

For the **web app → backend** call (Next.js server actions or route handlers calling Hono), the call is always HTTPS to `https://ziko-api-lilac.vercel.app/coach/*` carrying the user's Supabase JWT in `Authorization`. The web has no direct DB write path — it always goes through Hono. This is non-negotiable: it preserves the existing security model (one auth boundary, one logging point, one rate limiter).

---

## Data Model

### New Tables (migration 034 — first new migration in v1.5)

```sql
-- 034_coach_platform_foundation.sql

-- 1. coach_profiles ───────────────────────────────────────────
CREATE TABLE public.coach_profiles (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  bio            TEXT,
  specialties    TEXT[] NOT NULL DEFAULT '{}',
  website        TEXT,
  kyc_status     TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','approved','rejected')),
  kyc_data       JSONB DEFAULT '{}'::jsonb,  -- doc URLs, submission notes
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_coach_profiles_updated BEFORE UPDATE ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

-- 2. coach_client_links ───────────────────────────────────────
CREATE TABLE public.coach_client_links (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  invited_via   UUID REFERENCES public.coach_invitations(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  CHECK (coach_id <> client_id)
);
-- One active link per pair
CREATE UNIQUE INDEX idx_coach_client_active
  ON public.coach_client_links (coach_id, client_id)
  WHERE status = 'active';
CREATE INDEX idx_coach_client_by_coach  ON public.coach_client_links (coach_id)  WHERE status = 'active';
CREATE INDEX idx_coach_client_by_client ON public.coach_client_links (client_id) WHERE status = 'active';
ALTER TABLE public.coach_client_links ENABLE ROW LEVEL SECURITY;

-- 3. coach_invitations ────────────────────────────────────────
CREATE TABLE public.coach_invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$'),
  expires_at  TIMESTAMPTZ NOT NULL,
  max_uses    INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invitations_coach ON public.coach_invitations(coach_id, created_at DESC);
CREATE INDEX idx_invitations_code  ON public.coach_invitations(code);
ALTER TABLE public.coach_invitations ENABLE ROW LEVEL SECURITY;

-- 4. ai_imports ───────────────────────────────────────────────
CREATE TABLE public.ai_imports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode                  TEXT NOT NULL CHECK (mode IN ('athlete_self','coach_template','coach_for_client')),
  target_client_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_storage_path   TEXT NOT NULL,        -- bucket key in import-uploads
  source_mime           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','parsing','preview_ready','committed','failed','cancelled')),
  parsed_json           JSONB,
  committed_program_id  UUID REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  error_message         TEXT,
  credit_cost           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_imports_user_created ON public.ai_imports(user_id, created_at DESC);
CREATE TRIGGER trg_ai_imports_updated BEFORE UPDATE ON public.ai_imports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.ai_imports ENABLE ROW LEVEL SECURITY;

-- 5. strava_accounts ──────────────────────────────────────────
CREATE TABLE public.strava_accounts (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id         BIGINT NOT NULL UNIQUE,
  access_token       TEXT NOT NULL,   -- encrypted at app layer (pgcrypto optional later)
  refresh_token      TEXT NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  scope              TEXT,
  last_sync_at       TIMESTAMPTZ,
  last_cursor_id     BIGINT,          -- last activity id reconciled
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_strava_accounts_updated BEFORE UPDATE ON public.strava_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
ALTER TABLE public.strava_accounts ENABLE ROW LEVEL SECURITY;

-- 6. strava_webhook_events ────────────────────────────────────
CREATE TABLE public.strava_webhook_events (
  id              BIGSERIAL PRIMARY KEY,
  athlete_id      BIGINT NOT NULL,
  object_type     TEXT NOT NULL,        -- 'activity' | 'athlete'
  object_id       BIGINT NOT NULL,
  aspect_type     TEXT NOT NULL,        -- 'create' | 'update' | 'delete'
  event_time      TIMESTAMPTZ NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_strava_events_unprocessed ON public.strava_webhook_events(processed, created_at)
  WHERE processed = FALSE;
CREATE INDEX idx_strava_events_athlete ON public.strava_webhook_events(athlete_id, object_id);
-- No RLS — webhook table is service-role-only, never queried from client
```

### Extended Tables

```sql
-- user_profiles: add role
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client'
  CHECK (role IN ('client', 'coach', 'both'));
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role)
  WHERE role <> 'client';

-- workout_programs: coaching fields
ALTER TABLE public.workout_programs
  ADD COLUMN IF NOT EXISTS created_by_coach_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_template          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weeks_data           JSONB,
  ADD COLUMN IF NOT EXISTS template_source_id   UUID REFERENCES public.workout_programs(id) ON DELETE SET NULL;
CREATE INDEX idx_programs_coach    ON public.workout_programs(created_by_coach_id) WHERE created_by_coach_id IS NOT NULL;
CREATE INDEX idx_programs_template ON public.workout_programs(created_by_coach_id) WHERE is_template = TRUE;
```

**Migration plan:** three sequential migration files keeps blast radius small.

- `034_coach_role_and_profile.sql` — adds `role` column, `coach_profiles` table.
- `035_coach_links_and_invitations.sql` — `coach_invitations` + `coach_client_links` + RPC helper `is_coach_of()` + RLS policies that depend on the links table (see next section).
- `036_coach_programs_and_imports.sql` — `workout_programs` extension + `ai_imports` table + adjusted RLS policy on `workout_programs` to allow coach read/write of templates and assignments.
- `037_strava_integration.sql` — `strava_accounts` + `strava_webhook_events`.

Splitting like this lets us deploy `034` early (coach onboarding without yet exposing client data) and ship `035` once the cross-user RLS is validated.

---

## RLS Policies — Coach Cross-User Access

This is the architecturally hardest problem. The existing RLS pattern is `auth.uid() = user_id` everywhere. A coach must read **another user's** habits, sessions, measurements, etc. — without breaking the existing pattern for direct client access.

**Approach:** introduce a SECURITY DEFINER SQL function `public.is_coach_of(p_coach UUID, p_client UUID) RETURNS BOOLEAN` that bypasses RLS to check the link table, then extend each relevant table's policy with `OR is_coach_of(auth.uid(), user_id)`.

### The link-check function

```sql
CREATE OR REPLACE FUNCTION public.is_coach_of(p_coach UUID, p_client UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_client_links
    WHERE coach_id = p_coach
      AND client_id = p_client
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_coach_of(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) TO authenticated;
```

**Why SECURITY DEFINER**: a user-side query against `coach_client_links` is itself RLS-restricted to their own rows. The function escapes that to answer "is X linked to Y" without leaking the broader link table. `STABLE` lets Postgres cache the result within a single query plan.

### Link table's own RLS

Each side sees only their own rows.

```sql
-- Coach sees their links; client sees their links. Neither sees others'.
CREATE POLICY "links_select_own" ON public.coach_client_links
  FOR SELECT
  USING (auth.uid() = coach_id OR auth.uid() = client_id);

-- Only the coach creates links (via service-role redeem flow that uses a SECURITY DEFINER fn, not direct insert)
CREATE POLICY "links_insert_via_redeem" ON public.coach_client_links
  FOR INSERT
  WITH CHECK (auth.uid() = client_id);   -- client redeems → row inserted with their id

-- Either party can revoke
CREATE POLICY "links_update_revoke" ON public.coach_client_links
  FOR UPDATE
  USING (auth.uid() = coach_id OR auth.uid() = client_id)
  WITH CHECK (status = 'revoked');       -- only allowed transition via this policy
```

Pragmatically, link insert happens server-side through the redeem endpoint using the Hono backend's authenticated Supabase client, so even tighter would be acceptable; the policy above is defense-in-depth.

### Pattern for each data table (habits, sessions, measurements, nutrition, sleep, cardio, hydration, journal, stretching)

Replace the existing `auth.uid() = user_id` SELECT policy with an OR'd version. Keep INSERT/UPDATE/DELETE strictly self-owned (coach is **read-only** of client data in v1.5).

```sql
-- Example: habit_logs (and apply same shape to: workout_sessions, session_sets via join,
--   body_measurements, nutrition_logs, sleep_logs, cardio_sessions, hydration_logs,
--   journal_entries, stretching_logs, habits, habit_logs)
DROP POLICY IF EXISTS "own_habit_logs" ON public.habit_logs;

CREATE POLICY "habit_logs_select" ON public.habit_logs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_coach_of(auth.uid(), user_id)
  );

CREATE POLICY "habit_logs_modify" ON public.habit_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

For `session_sets` and `program_workouts`/`program_exercises` which use JOIN-based policies, the existing JOIN expands transparently because `workout_sessions`/`workout_programs` themselves carry the OR'd SELECT policy.

### `workout_programs` — special two-axis policy

Programs split into three rows: client-owned (`user_id=client`), coach templates (`user_id=coach`, `is_template=true`), coach assignments (`user_id=client`, `created_by_coach_id=coach`).

```sql
DROP POLICY IF EXISTS "own_programs" ON public.workout_programs;

CREATE POLICY "programs_select" ON public.workout_programs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = created_by_coach_id
    OR public.is_coach_of(auth.uid(), user_id)
  );

CREATE POLICY "programs_insert" ON public.workout_programs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR (
      auth.uid() = created_by_coach_id
      AND (
        is_template = TRUE                                       -- coach template
        OR public.is_coach_of(auth.uid(), assigned_to_user_id)   -- coach assignment to linked client
      )
    )
  );

CREATE POLICY "programs_update" ON public.workout_programs
  FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = created_by_coach_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = created_by_coach_id);

CREATE POLICY "programs_delete" ON public.workout_programs
  FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = created_by_coach_id);
```

### `coach_profiles` RLS

```sql
-- Coach owns their profile
CREATE POLICY "coach_profile_own" ON public.coach_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Linked clients can read their coach's profile (read-only public-ish info)
CREATE POLICY "coach_profile_visible_to_clients" ON public.coach_profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_coach_of(user_id, auth.uid())   -- inverse direction: this profile belongs to my coach
  );
```

### `ai_imports` RLS

```sql
CREATE POLICY "imports_own" ON public.ai_imports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### `strava_accounts` RLS

```sql
CREATE POLICY "strava_accounts_own" ON public.strava_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Performance note

`is_coach_of` is called once per row by SELECT policies. With B-tree on `(coach_id, client_id) WHERE status = 'active'` the lookup is O(log n). For a coach with ≤ 50 clients reading a 30-day window of habit_logs (~1500 rows), the planner inlines the STABLE function once per query — verified pattern in Supabase docs. At 10k+ active links table-wide it remains negligible. If it ever becomes hot, materialize a `pg_trgm`-style cache. Out of scope for v1.5.

---

## Data Flows

### AI File Import Flow

```
[Mobile or web client]                              [Backend]                       [Storage / Anthropic]
       │                                                │                                    │
       │ 1. POST /coach/imports/upload-url              │                                    │
       │    { mime, mode, target_client_id? }           │                                    │
       │                                                │ a. validate role + link (if mode=  │
       │                                                │    coach_for_client)               │
       │                                                │ b. ai_imports row → 'uploaded'     │
       │                                                │ c. signed URL via Supabase Storage │
       │ ◄── { import_id, signed_url, storage_path } ───│                                    │
       │                                                │                                    │
       │ 2. PUT (binary) → signed_url ──────────────────┼───────────────────────────────────►│
       │                                                │                                    │
       │ 3. POST /coach/imports/:id/parse               │                                    │
       │                                                │ creditCheck(IMPORT_COST)           │
       │                                                │ ai_imports → 'parsing'             │
       │                                                │ fetch file bytes / signed download │◄──┐
       │                                                │ Claude messages.create with        │   │
       │                                                │   document or image block          │───┘
       │                                                │ generateObject(ParsedProgramSchema)│──►│ Anthropic
       │                                                │ ai_imports.parsed_json = result    │◄──│ (vision/doc)
       │                                                │ ai_imports → 'preview_ready'       │
       │                                                │ creditDeduct (only if success)     │
       │ ◄── { status:'preview_ready', preview:{…} } ───│                                    │
       │                                                │                                    │
       │ 4. POST /coach/imports/:id/commit              │                                    │
       │    { edits? }                                  │                                    │
       │                                                │ coach/programs.commitFromImport(   │
       │                                                │   parsed, mode, target_client_id)  │
       │                                                │ → INSERT workout_programs (+rows)  │
       │                                                │ ai_imports.committed_program_id    │
       │                                                │ ai_imports → 'committed'           │
       │ ◄── { program_id } ────────────────────────────│                                    │
```

Reuses existing v1.3 Supabase Storage signed-URL pattern (bypasses Vercel's 4.5 MB body limit). Storage bucket: new `import-uploads` (private, path-prefixed RLS `(storage.foldername(name))[1] = auth.uid()`). Lifecycle cron extended to clean `import-uploads/*` after 30 days.

Credit cost is taken from `coach/imports/parse` route via the existing `creditCheck`/`creditDeduct` middleware pair. Cost likely 3 credits (higher than chat) — final number set by FEATURES research.

### Strava Sync Flow

```
[Mobile]                  [Backend]                    [Strava]
   │                         │                            │
   │ 1. tap "Connect Strava" │                            │
   │ open WebBrowser to:     │                            │
   │ https://strava.com/oauth?                            │
   │  client_id, redirect=   │                            │
   │  https://api/strava/cb  │                            │
   │ ──────────────────────────────────────────────────►  │
   │                         │ ◄── 302 redirect with code │
   │                         │     (callback hits Hono)   │
   │                         │ POST oauth/token (client_  │
   │                         │   secret, code) ─────────► │
   │                         │ ◄── access_token, refresh, │
   │                         │     athlete_id             │
   │                         │ UPSERT strava_accounts     │
   │                         │ register webhook subscription (once, on first ever connect)
   │                         │ initial backfill: GET /api/v3/athlete/activities (last 30d)
   │                         │   → INSERT cardio_sessions │
   │ ◄── deep link back ─────│                            │
   │                         │                            │
   │                         │                            │
   │ later: athlete records an activity in Strava         │
   │                         │ ◄── POST /webhooks/strava  │
   │                         │     {object_type:'activity',aspect:'create',object_id, owner_id}
   │                         │ INSERT strava_webhook_events (processed=false)
   │                         │ respond 200 within 2s      │
   │                         │                            │
   │                         │ cron every 5 min:          │
   │                         │   SELECT * FROM events WHERE processed=false LIMIT 50
   │                         │   for each:                │
   │                         │     refresh token if expired
   │                         │     GET /api/v3/activities/{object_id} ──►
   │                         │     map → cardio_sessions (UPSERT on external_strava_id)
   │                         │     mark event processed   │
   │                         │                            │
   │                         │ reconciliation cron daily: │
   │                         │   for each account:        │
   │                         │     GET activities?after=last_sync_at
   │                         │     UPSERT any missed      │
```

Webhook reconciliation is mandatory because Strava webhook delivery is best-effort; the daily cron closes gaps. `cardio_sessions` gets an extra nullable column `external_strava_id BIGINT UNIQUE` (sparse unique allowed via partial index) to support idempotent UPSERT.

```sql
ALTER TABLE public.cardio_sessions
  ADD COLUMN IF NOT EXISTS external_strava_id BIGINT,
  ADD COLUMN IF NOT EXISTS external_source TEXT CHECK (external_source IN ('strava'));
CREATE UNIQUE INDEX idx_cardio_strava ON public.cardio_sessions(user_id, external_strava_id)
  WHERE external_strava_id IS NOT NULL;
```

Routes (live under `coach/` only by file location for organization — Strava is athlete-facing, but its module conceptually belongs to the wearables/cardio domain; placing in `backend/api/src/integrations/strava/` is cleaner and avoids mis-binding it to coach modules):

```
backend/api/src/integrations/strava/
  routes.ts    POST /integrations/strava/connect (returns OAuth URL)
               GET  /integrations/strava/callback (OAuth redirect handler)
               POST /integrations/strava/disconnect
               POST /webhooks/strava        (Strava → us)
               GET  /webhooks/strava        (subscription validation handshake)
  service.ts   refreshIfExpired, upsertActivity, mapStravaToCardioSession
  cron.ts      processWebhookQueue, dailyReconcile
  db.ts
```

Vercel cron in `vercel.json`:
```json
{
  "crons": [
    { "path": "/integrations/strava/cron/process-webhooks", "schedule": "*/5 * * * *" },
    { "path": "/integrations/strava/cron/daily-reconcile",  "schedule": "0 3 * * *" }
  ]
}
```

(Existing storage-cleanup cron in v1.3 stays; just add these entries.)

### Invitation Flow

```
[Coach web]                  [Backend]                        [Client mobile]
    │                            │                                  │
    │ POST /coach/invitations    │                                  │
    │   { expires_in_days:30 }   │                                  │
    │                            │ requireCoachRole(userId)         │
    │                            │ generate 6-char code (retry on   │
    │                            │   UNIQUE collision)              │
    │                            │ INSERT coach_invitations         │
    │ ◄── { code, share_url } ───│                                  │
    │                            │                                  │
    │ share_url copied → SMS/WhatsApp to client ──────────────────► │
    │                            │                                  │
    │                            │      POST /coach/invitations/redeem
    │                            │      { code: "X7K2NP" }          │
    │                            │ ◄────────────────────────────────│
    │                            │                                  │
    │                            │ SECURITY DEFINER fn:             │
    │                            │   SELECT * FROM invitations      │
    │                            │   WHERE code=$1 AND used_count<max_uses
    │                            │     AND expires_at>NOW()         │
    │                            │   FOR UPDATE                     │
    │                            │ INSERT coach_client_links        │
    │                            │   (coach_id, client_id=auth.uid()) ON CONFLICT DO NOTHING (active)
    │                            │ UPDATE invitations.used_count++  │
    │                            │ ──────────────────────────────►  │
    │                            │ { ok, coach: {...profile} }      │
    │                            │                                  │
    │                            │                                  │ mobile redirects to "Mon coach" screen
```

Redeem happens server-side in a single SECURITY DEFINER PL/pgSQL function (`redeem_invitation_code(p_code, p_client_id)`) to atomically check-then-consume.

### Coach AI Tool Execution Flow

```
[Coach web]                           [Backend /ai/chat/stream]
    │                                       │
    │ POST messages=[..."Comment va Léa ?"] │
    │ Authorization: Bearer <coach JWT>     │
    │                                       │ existing chain: ipRateLimiter, auth, aiChatLimiter, creditCheck
    │                                       │ fetchUserContext(userId) detects role='coach'|'both'
    │                                       │   → expands tool set with coach AI tools
    │                                       │   → system prompt addition: "You are a coach assistant.
    │                                       │       The user is a fitness coach. Their linked clients: [...]"
    │                                       │ streamText({ model, messages, tools: [...client tools, ...coach tools] })
    │                                       │
    │                                       │ Claude decides: call analyze_client({ client_id: "<Léa's uuid>" })
    │                                       │
    │                                       │ tools/registry.execute('analyze_client',
    │                                       │   { client_id }, userId, userToken)
    │                                       │   → coach/ai/tools.analyze_client(userId, params)
    │                                       │      ├─ coach/clients.service.isCoachOf(userId, client_id) → must be true (else throw)
    │                                       │      ├─ coach/clients.service.getClientAggregate(userId, client_id, 30days)
    │                                       │      │   ← Supabase reads via the user's JWT → RLS allows OR is_coach_of(...)
    │                                       │      └─ return structured analysis JSON to model
    │                                       │
    │                                       │ Claude generates final assistant message
    │ ◄── SSE chunks ──────────────────────│ persist messages (existing ai_messages table)
    │                                       │ creditDeduct
```

**Critical:** the tool executor uses the **user's JWT** for its Supabase client, not the service role. RLS does the policing. The `isCoachOf` service call inside the tool is defense in depth, providing a clean 4xx error before Supabase silently returns empty rows. This is the same pattern existing plugin tools use (`tools/db.ts` in current registry — each tool receives `userId` and `userToken`).

---

## Build Order

Each phase below maps to a roadmap phase; numbered for dependency ordering.

**Phase 1 — Schema foundation (migrations 034–036)**
Migration 034 (role + coach_profiles). Migration 035 (invitations + links + `is_coach_of`). Migration 036 (programs extension + ai_imports + RLS rewrites for habits/sessions/measurements/etc). Validate RLS with manual SQL test cases. Schema MUST land first because every backend module depends on tables existing.
*Depends on:* nothing.

**Phase 2 — `apps/web/` Turborepo integration**
Decide: pull existing ziko-app.com Next.js into the monorepo as `apps/web/`, or keep dual-repo. (STACK research will recommend; ARCHITECTURE assumes integration.) Wire up `next.config.js`, share design tokens, configure Vercel project for monorepo build, set up `(coach)/` route segment with Supabase auth helpers (`@supabase/ssr`).
*Depends on:* Phase 1 not required, but useful to know schema for the auth context.

**Phase 3 — `coach/identity` module + coach signup**
Backend module skeleton (`coach/index.ts`, sub-router pattern, ESLint boundary rules). `coach/identity` routes, services, schemas. Web `(coach)/onboarding` flow that PATCHes user_profiles.role and inserts coach_profiles row. Self-serve, no KYC blocker.
*Depends on:* Phase 1, Phase 2.

**Phase 4 — `coach/invitations` + `coach/clients` (links only)**
Invitation routes, redeem RPC, link table writes. Mobile invitation-entry screen. Mobile "Mon coach" minimal screen (no data aggregate yet, just shows linked coach name + bio).
*Depends on:* Phase 3.

**Phase 5 — `coach/clients` (read aggregate) + web CRM list/detail**
Implement `getClientAggregate` reading all the cross-RLS data. Web `(coach)/clients` list and `(coach)/clients/[id]` tabbed detail. Read-only sessions/measurements/habits/nutrition/sleep/cardio tabs.
*Depends on:* Phase 4 + RLS from Phase 1 verified end-to-end.

**Phase 6 — `coach/programs` (templates + assignments)**
Migration 036 program extension verified. Service methods. Routes. Web `(coach)/programs` template library + editor. Assign-to-client flow.
*Depends on:* Phase 5.

**Phase 7 — `coach/imports` (AI file imports)**
New storage bucket. `ai_imports` table from migration 036. Upload-url endpoint. Parse endpoint with Claude vision/document + generateObject + Zod (shared schema in `coach-sdk`). Preview + commit flow. Both athlete and coach modes.
*Depends on:* Phase 6 (commit writes through coach/programs service).

**Phase 8 — `coach/ai` orchestrator tools**
Three new tools registered in `tools/registry.ts`. System prompt branch for coach audience. Web `(coach)/ai` chat UI (reuses SSE client pattern from mobile's AIBridge).
*Depends on:* Phase 5 (analyze_client reads client data), Phase 6 (generate_coaching_program writes programs).

**Phase 9 — Strava OAuth + sync**
Migration 037. OAuth connect/callback. Webhook subscription. Webhook ingestion route (idempotent insert into strava_webhook_events). Cron processor. Daily reconciliation. Mobile "Connect Strava" button + status indicator.
*Depends on:* nothing in coach modules; can run in parallel with Phases 6–8 if capacity allows. Sequenced last because it's the lowest-coupling feature.

**Phase 10 — Public landing `/coachs` FR/EN**
Marketing page under `(marketing)/coachs` (and `/en/coachs`). Signup CTA → links to `(coach)/onboarding`. Reuses existing next-intl setup from v1.0 landing.
*Depends on:* Phase 3 (signup flow must exist for the CTA to land somewhere useful). Can be built earlier in parallel.

**Parallelizable lanes:**
- Web Turborepo integration (Phase 2) can start at the same time as backend Phase 3.
- Strava (Phase 9) is independent and can be parallelized any time after Phase 1.
- Landing page (Phase 10) only depends on Phase 3's onboarding URL being decided.

---

## ERP Migration Path (v1.6+)

What the future ERP modules will add and how v1.5 stays unchanged:

### `coach/billing` (v1.6 candidate)

Adds:
- Table `coach_subscriptions(coach_id FK coach_profiles, plan TEXT, status, current_period_end, stripe_customer_id, stripe_subscription_id)`.
- Table `coach_invoices(coach_id, period_start, period_end, amount, …)`.
- Tool `report_invoice_summary` in the registry.
- Web routes `(coach)/billing`.
- Webhook `/webhooks/stripe`.

Touches in v1.5:
- **`coach_profiles`** — read-only FK target, no schema change.
- **`coach_client_links`** — billing reads active link count for usage-based pricing; no schema change.

Conclusion: v1.5 needs no defensive design for billing. The bounded module boundary is the contract.

### `coach/scheduling` (v1.6 candidate)

Adds:
- Tables `coach_calendar_settings(coach_id, availability_rules JSONB, timezone)`, `coach_sessions(coach_id, client_id, scheduled_at, duration_min, type, status, notes)`, `coach_session_notes`.
- Tools `propose_session_slots`, `book_session`, `record_session_notes`.
- Web routes `(coach)/calendar`, `(coach)/clients/[id]/sessions`.
- Cron for reminder emails.

Touches in v1.5:
- **`coach_client_links`** — FK source for `coach_sessions.client_id`. No change needed.
- **`workout_programs`** — `coach_sessions` may optionally FK an assignment. No change needed.
- **AI tools** — three new tools added to registry. The registry pattern already handles N tools.

Conclusion: again, additive.

### `coach/messaging` (deferred per PROJECT.md)

Will likely add `coach_threads`, `coach_messages`, plus Supabase Realtime channels per thread. The link table is the FK source. Existing AI orchestrator can be extended with a `summarize_thread` tool. No v1.5 changes.

### What MUST stay stable

| Surface | Stability promise |
|---------|-------------------|
| `coach_client_links` table shape | Frozen — every future module joins this. Additions (e.g., `tier` per link) allowed; column removals forbidden. |
| `is_coach_of(coach, client)` SQL function signature | Frozen — every cross-user RLS policy uses it. |
| `user_profiles.role` enum values | `'client'|'coach'|'both'` is permanent. New roles (e.g., admin) require a separate column. |
| Tool registry shape (`AITool` + executor) | Frozen — already 30+ tools depend on it. |
| `coach-sdk` ParsedProgram Zod schema (once stable) | Versioned with semver. v1.x additive only. |

---

## Risks

1. **Cross-user RLS performance regression.** Every habit_log, session, measurement now has an OR'd policy with a function call. Mitigation: STABLE function + indexed `coach_client_links` lookup means single B-tree probe; pre-launch benchmark on a seeded 1000-coach × 50-client × 30-day dataset is the gate. *Risk level: MEDIUM.*

2. **`is_coach_of` SECURITY DEFINER leak.** A bug here means any user could read any other user's data. Mitigation: function takes only `(coach, client)` and returns boolean; no row data returned. Unit test the function explicitly. *Risk level: LOW if reviewed; CATASTROPHIC if buggy.*

3. **Strava webhook race conditions.** A single activity may produce create + update webhooks within ms. UPSERT on `external_strava_id` is idempotent, but the cron processor reading "unprocessed" events could double-process if two crons overlap. Mitigation: `SELECT … FOR UPDATE SKIP LOCKED LIMIT 50` on the events table. *Risk level: LOW.*

4. **Vercel function timeout on AI import parse.** Claude document parsing can take 10–30s for large PDFs. Mitigation: parse endpoint must complete within Vercel Fluid's hobby/pro budget (60s); if exceeded, switch to a queued model (`status='parsing'` polled by client) where parse is triggered by a separate cron-tickled queue. Implement polling on day one — even if parse usually completes synchronously, the UI must tolerate async. *Risk level: MEDIUM.*

5. **Web/mobile auth context drift.** Supabase `@supabase/ssr` (web) and `@supabase/supabase-js` (mobile) handle JWT differently. The Hono backend already trusts `Authorization: Bearer <jwt>` from either, but session refresh logic differs. Mitigation: document both flows in `apps/web/src/lib/supabase.ts` and `apps/mobile/src/lib/supabase.ts`. *Risk level: LOW.*

6. **Turborepo monorepo onboarding of `apps/web/`.** Pulling the existing public Next.js repo into the monorepo touches deployment, env vars, and shared package builds. Mitigation: spike before Phase 2 to confirm Vercel monorepo build works with `apps/web/` and existing `backend/api/`; have rollback to dual-repo as fallback (the bounded-context architecture works either way — modules in `coach-sdk` would just be NPM-published instead). *Risk level: MEDIUM.* (Final call deferred to STACK research.)

7. **AI import Zod schema drift.** If the parsed JSON shape changes between commit time and migration, old imports break. Mitigation: version the Zod schema (`ParsedProgramV1`), persist `schema_version` in `ai_imports.parsed_json.__v`, never break old shapes. *Risk level: LOW.*

8. **GDPR right-to-erasure cascade across coach data.** If a client deletes their account, FK cascades remove their `coach_client_links` row and (per `ON DELETE CASCADE`) their cardio_sessions, habit_logs, etc. Their coach still has assignments where `assigned_to_user_id = <deleted_id>` — those should also cascade. The schema above uses `ON DELETE CASCADE` on `workout_programs.assigned_to_user_id`, which is correct for GDPR but means a coach loses the history of a deleted client. Acceptable in v1.5; if not, switch to `ON DELETE SET NULL` and rely on `coach_client_links.status='revoked'` for the lifecycle. *Risk level: LOW; design decision to confirm with product.*

---

## Sources

- Verified from source: `backend/api/src/app.ts` — Hono router mount pattern, CORS, middleware chain order.
- Verified from source: `backend/api/src/tools/registry.ts` — tool schema + executor registration shape; how a new module's tools get wired in.
- Verified from source: `supabase/migrations/001_initial_schema.sql` — RLS pattern (`auth.uid() = user_id`), trigger functions (`handle_updated_at`, `handle_new_user`), workout_programs/sessions/sets shape.
- Verified from source: `supabase/migrations/026_ai_credits.sql` — atomic SECURITY DEFINER pattern with FOR UPDATE row lock, balance_after trigger, ON CONFLICT DO NOTHING idempotency — proven pattern this milestone reuses for `redeem_invitation_code`.
- Verified from source: `supabase/migrations/032_onboarding_profile_fields.sql` — current shape of user_profiles extensions used as model for the `role` column addition.
- Verified from source: `supabase/migrations/033_community_posts.sql` — current shape of public-read tables with private-write; useful pattern for `coach_profiles` "visible to linked clients".
- Verified from source: `.planning/PROJECT.md` — v1.5 milestone definition, bounded-context decision, deferral list.
- Verified from source: `.planning/research/v1.4/ARCHITECTURE.md` — established middleware composition + tool registry conventions (creditCheck/creditDeduct sandwich, fire-and-forget pattern).
- Verified from source: `CLAUDE.md` — tech stack truth (Hono v4, Vercel, Supabase publishable key, AI SDK v6 with `inputSchema`/`stepCountIs`).

---
*Architecture research for: v1.5 Coach Platform & CRM — Ziko Platform*
*Researched: 2026-05-13*
