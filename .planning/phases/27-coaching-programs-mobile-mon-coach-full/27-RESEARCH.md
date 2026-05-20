# Phase 27: Coaching Programs & Mobile "Mon coach" Full — Research (Track A Web ONLY)

**Researched:** 2026-05-20
**Domain:** Web Program Builder — Supabase migrations, Hono programsRouter, coach-sdk Zod schemas, Next.js App Router pages, coach web components
**Confidence:** HIGH (all findings verified directly against codebase)
**Scope restriction:** Track A (Web) ONLY. Track B (Mobile) excluded from this plan.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Full Zod schema locked in `coach-sdk` now. `ProgramWeekSchema` → `ProgramSessionSchema` → `ProgramExerciseSchema` hierarchy defined in `packages/coach-sdk/src/schemas/` before any implementation begins. No DB CHECK — Zod-only per migration 036 D-11.

**D-02** — Session positioning: `day_of_week` (1=Mon … 7=Sun). Each session in `weeks_data` has a required `day_of_week: 1|2|3|4|5|6|7` field.

**D-03** — Exercise intensity: `target_rpe` (nullable, 1–10) OR `target_rir` (nullable, 0–5), both on each exercise object.

**D-04** — Full exercise object shape:
```ts
ProgramExerciseSchema = z.object({
  exercise_id:       z.string().uuid().nullable(),
  exercise_name:     z.string().min(1).max(100),
  sets:              z.number().int().min(1).max(20),
  reps:              z.number().int().min(1).max(100).nullable(),
  duration_seconds:  z.number().int().min(1).nullable(),
  target_rpe:        z.number().min(1).max(10).nullable(),
  target_rir:        z.number().int().min(0).max(5).nullable(),
  rest_seconds:      z.number().int().min(0).max(600).nullable(),
  notes:             z.string().max(300).nullable(),
})
```

**D-05** — Full program object shape (ProgramWeekSchema + ProgramSessionSchema).

**D-06** — Week accordion + slide-over session panel pattern locked.

**D-07** — Exercise typeahead: debounced `GET /exercises?q=` against Ziko library + "Créer l'exercice" option saves to shared `exercises` table with `is_user_defined = TRUE` (new column).

**D-08** — Single-level folders: new `coach_program_folders` table + `folder_id` on `workout_programs`.

**D-09** — Seed templates in `supabase/seed.sql` (or migration) under `created_by_coach_id = NULL`. "Bibliothèque Ziko" section.

**D-10** — Immediate start, `start_date = CURRENT_DATE`. New column on `workout_programs`.

**D-11** — Multi-client assignment: `POST /coach/programs/:templateId/assign` accepts `{ client_ids: string[] }`.

**D-14** — Weekly compliance widget: `source_program_id UUID` + `source_session_id TEXT` columns on `workout_sessions`.

**D-15** — `shared_note TEXT NULL` on `coach_client_links`. Backend: `PUT /coach/clients/:clientId/shared-note`.

**D-17** — Programs tab (8th tab) on `/coach/clients/[id]`. Backend: `GET /coach/clients/:id/programs`.

### Claude's Discretion

- Exact Tailwind class layout of the week accordion
- Slide-over panel width and animation details
- Seed template list visual treatment
- Compliance widget color thresholds (green ≥80%, orange 50–79%, red <50%)
- Whether `/coach/programs` uses the same `CoachSidebar.tsx` "Programs" nav item (currently disabled) or a new entry

### Deferred Ideas (OUT OF SCOPE)

- Scheduled program start (future date)
- Athlete-side program library
- 1RM comparison metric on ComparisonChart
- Append-only shared notes log
- Bulk tag operations from programs
- Track B (Mobile) — excluded from this plan
</user_constraints>

<phase_requirements>
## Phase Requirements (Track A Web — PROG-01 through PROG-09)

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROG-01 | Coach can create a workout program template at `/coach/programs/new` with metadata persisted as `workout_programs` with `is_template=TRUE` | New page `apps/web/src/app/[locale]/(coach)/coach/programs/new/page.tsx`; POST /coach/programs endpoint in new programsRouter |
| PROG-02 | Coach can structure program as multi-week with sessions + exercises with sets/reps/RPE/RIR/rest; persisted in `weeks_data` JSONB | New `ProgramWeekSchema` + `ProgramSessionSchema` + `ProgramExerciseSchema` in coach-sdk; slide-over editor UI |
| PROG-03 | Coach can pick exercises from Ziko library or add free-text names | New `GET /exercises?q=` endpoint + `POST /exercises` with `is_user_defined=TRUE`; ExerciseTypeahead component |
| PROG-04 | Coach can organize templates into folders | New `coach_program_folders` migration; folder nav on `/coach/programs` |
| PROG-05 | Coach can duplicate a template / week / session via context menu | Duplicate endpoints + UI context menus on WeekAccordion |
| PROG-06 | Coach can assign template to clients; assignment forks with `is_template=FALSE`, `assigned_to_user_id` set | `POST /coach/programs/:id/assign` accepts `{ client_ids }` batch; AssignmentModal component |
| PROG-07 | Coach can edit an assigned program (per-client) without modifying the source template | Program editor works on both templates and forks; forks have `template_source_id` pointing back |
| PROG-08 | Ziko ships with 5-10 expert-curated seed templates visible to every coach | Migration 045 seeds templates with `created_by_coach_id=NULL`; "Bibliothèque Ziko" section on `/coach/programs` |
| PROG-09 | Client sees assigned program in mobile "Mon coach" and can execute sessions | Web side: `start_date` column + `source_program_id`/`source_session_id` on `workout_sessions` (columns added by web plan; consumed by mobile) |
</phase_requirements>

---

## Summary

Phase 27 Track A delivers the Web Program Builder: five new web surfaces plus backend infrastructure for a full program template lifecycle. The codebase is well-prepared — the `workout_programs` table already has `is_template`, `created_by_coach_id`, `assigned_to_user_id`, `template_source_id`, and `weeks_data JSONB` from migration 036. The bounded module pattern, Server Component page pattern, and all reusable components needed are already in place.

The migration gap is exactly five columns/tables that are absent from the current 44-migration sequence: `coach_program_folders` table, `folder_id` on `workout_programs`, `start_date` on `workout_programs`, `is_user_defined` on `exercises`, `shared_note` on `coach_client_links`, and `source_program_id`/`source_session_id` on `workout_sessions`. These can be grouped into one to two migrations numbered 045 (and optionally 046).

The backend gap is one new bounded module `backend/api/src/coach/programs/` (service.ts, db.ts, types.ts) mounted at `/coach/programs` in app.ts, plus two new routes on the existing `clientsRouter`. An exercise search endpoint does not exist anywhere in the codebase and must be added.

The `coach-sdk` gap is three new Zod schemas (`ProgramWeekSchema`, `ProgramSessionSchema`, `ProgramExerciseSchema`) that are pre-defined in CONTEXT.md D-04/D-05. A lighter existing `ExerciseSchema` is already exported from `imported-program.ts` but does not match the exact D-04 shape — the new schemas must be separate files.

The web gap is five new pages under `apps/web/src/app/[locale]/(coach)/coach/programs/` and one new tab under `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/`, plus five new components. `CoachSidebar.tsx` requires a one-line flip of `disabled: true → false` on the "Programmes" nav entry. `ClientTabStrip.tsx` requires a one-line addition of the 8th tab.

**Primary recommendation:** Plan in four waves: (1) DB migrations + coach-sdk schemas, (2) backend programsRouter + exercise search + clients extensions, (3) web pages + components, (4) seed templates. This dependency order allows TypeScript to validate schemas before routes are written.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Program template CRUD | API / Backend | Database | Business logic (fork-on-assign, RLS) lives in service.ts; DB handles persistence |
| Program JSONB editor | Frontend Server (SSR) initial load + Client (interactive) | API / Backend | Page loads program with `force-dynamic`; WeekAccordion + SlideOver are 'use client' components |
| Exercise typeahead search | API / Backend | Database | Debounced search hits `GET /exercises?q=` ; fuzzy matching at DB layer |
| Folder management | API / Backend | Database | Folders are simple CRUD; coach-private via RLS |
| Assignment (fork-on-assign) | API / Backend | — | Fork logic (copy `weeks_data`, set fields) must be atomic; cannot be done client-side |
| Seed templates | Database | — | Static data seeded via migration; read at page load as normal programs with `created_by_coach_id=NULL` |
| Programs tab on client detail | Frontend Server (SSR) + Client | API / Backend | Same layout pattern as existing tabs |
| Shared note write (web) | API / Backend | Database | `PUT /coach/clients/:id/shared-note` updates `coach_client_links` row |

---

## Standard Stack

### Core (already installed — no new packages needed for Track A)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Hono v4 | 4.x | Backend router for programsRouter | [VERIFIED: in backend/api/package.json] |
| `@supabase/ssr` | 0.x | Server Component Supabase client | [VERIFIED: in apps/web] |
| `@tanstack/react-table` | 5.x | Table primitives for programs list | [VERIFIED: installed by Phase 26] |
| `zod` | 3.x | Schema validation for new coach-sdk schemas | [VERIFIED: in packages/coach-sdk] |
| `react-icons/io5` | 5.x | Ionicons on web coach components | [VERIFIED: in apps/web coach components] |
| `nanoid` | — | Client-generated `session_id` UUIDs in ProgramSession | [ASSUMED — check apps/web package.json] |

### No New Packages Required

Track A does not introduce new npm dependencies. All components are built with existing Tailwind v4 utilities, existing react-icons/io5, and existing Supabase client patterns. The slide-over panel is CSS `transform: translateX` — no animation library needed. [VERIFIED: 27-UI-SPEC.md — "No external component registries"]

---

## Package Legitimacy Audit

No new external packages are introduced by Track A. The audit is not applicable — all dependencies are existing project libraries. [VERIFIED: 27-UI-SPEC.md registry safety section confirms no third-party component registries]

---

## Architecture Patterns

### System Architecture Diagram

```
Coach Browser
  └─ /coach/programs (Server Component, force-dynamic)
       │  createServerSupabase() → Supabase (RLS: own programs + is_template+created_by_coach_id=NULL)
       │
       ├─ WeekAccordion ['use client'] ──────────────────────────────────────┐
       │   └─ SessionSlideOver ['use client']                                │
       │       └─ ExerciseTypeahead ['use client']                          │
       │           └─ fetch GET /coach/programs/:id/exercises?q= ─────────► Hono API
       │                                                                     │
       ├─ AssignmentModal ['use client']                                     │
       │   └─ POST /coach/programs/:id/assign { client_ids } ──────────►   │
       │                                                       programsRouter│
       │                                                           db.ts     │
       │                                                       Supabase RLS  │
       │                                                                     │
       └─ /coach/clients/[id]/programs (Server Component)                   │
           └─ GET /coach/clients/:id/programs ────────────────────────────► clientsRouter.get
                                                                             clients/db.ts
                                                                             Supabase RLS
```

Data flow for fork-on-assign:
```
AssignmentModal → POST /coach/programs/:id/assign { client_ids: [...] }
  → programsRouter → programs/db.ts
  → for each client_id:
      INSERT INTO workout_programs (
        user_id = client_id,
        created_by_coach_id = coachId,
        assigned_to_user_id = client_id,
        template_source_id = templateId,
        is_template = FALSE,
        weeks_data = template.weeks_data,   -- copy JSONB
        start_date = CURRENT_DATE
      )
  → returns { assigned: N }
```

### Recommended Project Structure

```
packages/coach-sdk/src/schemas/
  program-exercise.ts        ← NEW (D-04 shape)
  program-session.ts         ← NEW (D-05 shape)
  program-week.ts            ← NEW (D-05 shape)
  index.ts                   ← add exports for 3 new schemas

backend/api/src/coach/
  programs/                  ← NEW bounded module
    service.ts               ← Hono router mounted at /coach/programs
    db.ts                    ← internal DB functions
    types.ts                 ← internal TypeScript types
  clients/
    service.ts               ← EXTEND: add programs tab + shared-note routes
    db.ts                    ← EXTEND: add getProgramsForClient + upsertSharedNote

apps/web/src/app/[locale]/(coach)/coach/
  programs/                  ← NEW route group
    page.tsx                 ← Programs list (A1)
    new/
      page.tsx               ← New program form (A2)
    [id]/
      page.tsx               ← Program editor (A3)
      assign/
        page.tsx             ← Assign modal page (or modal triggered from parent)
  clients/[id]/
    programs/                ← NEW tab
      page.tsx               ← Programs tab (A5)

apps/web/src/components/coach/
  WeekAccordion.tsx          ← NEW
  SessionSlideOver.tsx       ← NEW
  ExerciseTypeahead.tsx      ← NEW (clone of SpecialtyTagInput)
  AssignmentModal.tsx        ← NEW (reuses IndeterminateCheckbox from ClientsTable)
  ProgramCard.tsx            ← NEW (programs list card)
  CoachSidebar.tsx           ← EDIT: disabled → false on "Programmes"
  ClientTabStrip.tsx         ← EDIT: add 8th tab "Programmes"
```

### Pattern 1: Bounded Module (programsRouter)

**What:** Service layer at `service.ts` exposes only Hono routes. DB queries live in `db.ts`. Types live in `types.ts`. Only `service.ts` is imported by `app.ts`.
**When to use:** Every new backend coach module. [VERIFIED: Phase 24 CONTEXT.md D-08, confirmed in identity/, invitations/, clients/]

```typescript
// Source: backend/api/src/coach/identity/service.ts pattern
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { createProgram, listPrograms } from './db.js';

export const programsRouter = new Hono();
programsRouter.use('*', authMiddleware);

programsRouter.get('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const result = await listPrograms(jwt, userId);
  return c.json(result);
});
```

Mount in `app.ts`:
```typescript
// Source: backend/api/src/app.ts — existing pattern
app.route('/coach/programs', programsRouter);
```

### Pattern 2: Server Component Page (force-dynamic)

**What:** All coach pages use `export const dynamic = 'force-dynamic'` + `export const revalidate = 0` + `cache: 'no-store'` on all Supabase reads. [VERIFIED: Phase 23 CONTEXT.md D-15, confirmed in dashboard/page.tsx and clients/[id]/layout.tsx]

```typescript
// Source: apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProgramsPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  // ... cache: 'no-store' is enforced by force-dynamic
}
```

### Pattern 3: Per-Request JWT Client in db.ts

**What:** All DB functions accept `jwt` string and create a `createUserClient(jwt)` so RLS is enforced per-request. Never use service-role under coach/. [VERIFIED: backend/api/src/coach/clients/db.ts]

```typescript
// Source: backend/api/src/coach/clients/db.ts
export function createUserClient(jwt: string) {
  return createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
```

### Pattern 4: Coach-SDK Zod Schema (programs)

**What:** New schemas in `packages/coach-sdk/src/schemas/` following the strict() + named export + type export pattern.
**When to use:** Whenever a new complex JSONB shape is shared between backend, web, and mobile.

D-04 and D-05 shapes are fully locked in CONTEXT.md — no design decisions remain. Key points:
- `exercise_id` is nullable (free-text exercises have no UUID)
- `session_id` is client-generated nanoid/UUID
- `day_of_week` is `z.number().int().min(1).max(7)` — required (not optional)
- `reps` and `duration_seconds` are mutually exclusive but both nullable (Zod doesn't enforce this — caller must validate one is non-null)

### Pattern 5: RLS for workout_programs (coach-owned templates)

**What:** The existing `"own_programs"` policy on `workout_programs` is `FOR ALL USING (user_id = auth.uid())`. Templates authored by a coach have `user_id = coachId` AND `is_template = TRUE` AND `created_by_coach_id = coachId`. This means coaches read their own templates under the existing policy — no new RLS needed for coach templates.

Seed templates have `created_by_coach_id = NULL`. They cannot have `user_id = NULL` because `user_id NOT NULL` constraint exists (migration 001). **Resolution:** Seed templates must be inserted with a system/seed user UUID. The cleanest approach is `user_id = '00000000-0000-0000-0000-000000000000'` (a fixed sentinel UUID not in auth.users, or a dedicated system user) AND add a new RLS policy for public template read. [VERIFIED: migration 001 schema — `user_id UUID NOT NULL REFERENCES auth.users(id)`]

**Critical finding:** `workout_programs` has NO `workout_programs_coach_read` policy. The existing `"own_programs"` policy is FOR ALL `user_id = auth.uid()`. A coach querying programs for a client (`assigned_to_user_id = clientId`) will get no rows unless we add a coach-read policy. **Migration 045 must also add a `workout_programs_coach_read` policy using `is_coach_of()`.**

### Anti-Patterns to Avoid

- **Avoid adding program routes to `clientsRouter`:** Programs need their own `programsRouter` — keeping programs in clients muddies module boundaries per ARCH-01.
- **Exception:** `GET /coach/clients/:id/programs` and `PUT /coach/clients/:clientId/shared-note` belong in `clientsRouter` because they are client-scoped operations (D-17, D-15). These two routes extend the clients module, not the programs module.
- **Avoid using `is_template=FALSE` as the only fork signal:** Always set `template_source_id` on forks for lineage tracing (PROG-06).
- **Avoid client-side UUID generation for `session_id` without a library:** Use crypto.randomUUID() (available in all modern browsers and Node.js 14.17+) instead of a third-party nanoid to avoid a new dependency.
- **Avoid Zod `.strict()` on ProgramExerciseSchema without checking existing `imported-program.ts`:** The existing `ExerciseSchema` in `imported-program.ts` is NOT `.strict()` and has different field names (`name` vs `exercise_name`). The new D-04 schemas are separate files — do not try to unify them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkbox with indeterminate state | Custom checkbox | `IndeterminateCheckbox` from `ClientsTable.tsx` | Already implemented and tested; handles ref-based indeterminate state |
| Destructive action modal | New modal | `RevokeConfirmModal.tsx` | Typed-confirmation pattern with Escape + focus trap already built |
| Debounced text input | `setTimeout` in component | Pattern from `SpecialtyTagInput.tsx` (clone this file) | Has correct cleanup, Backspace handling, keyboard nav scaffold |
| Backdrop + dialog card for modals | `fixed inset-0` from scratch | Clone `RevokeConfirmModal.tsx` backdrop structure | Focus trap + Escape key + aria-modal already implemented |
| Supabase server client | Direct `createClient` in page.tsx | `createServerSupabase()` from `@/lib/supabase/server` | Handles cookie-based auth refresh for SSR |

---

## DB Migrations — What Exists vs What's Missing

### Already Exists (migration 036)

The following columns are ALREADY on `workout_programs` — do NOT re-add: [VERIFIED: supabase/migrations/036_workout_programs_ai_imports.sql]

| Column | Type | Notes |
|--------|------|-------|
| `created_by_coach_id` | UUID NULL | References auth.users ON DELETE SET NULL |
| `assigned_to_user_id` | UUID NULL | References auth.users ON DELETE SET NULL |
| `template_source_id` | UUID NULL | Self-reference ON DELETE SET NULL |
| `is_template` | BOOLEAN | DEFAULT FALSE |
| `weeks_data` | JSONB NULL | No CHECK constraint (Zod-only) |

Indexes also already exist: `idx_workout_programs_created_by_coach`, `idx_workout_programs_assigned_to`, `idx_workout_programs_template`.

`cycle_start_date DATE` already exists on `workout_programs` (migration 016). The new `start_date DATE` (D-10) is a different concept — it is the assignment start date (when the athlete started following this program), distinct from any cycle start. Confirm naming does not conflict. [VERIFIED: migrations/016_program_cycles_schema.sql]

### Missing — Phase 27 Must Add (Migration 045)

| Table | Column/Object | Type | Notes |
|-------|--------------|------|-------|
| `workout_programs` | `start_date` | DATE NULL | Assignment start date; D-10 |
| `workout_programs` | `folder_id` | UUID NULL | FK → `coach_program_folders(id)` ON DELETE SET NULL; D-08 |
| `exercises` | `is_user_defined` | BOOLEAN | DEFAULT FALSE; D-07. Do NOT rename `is_custom` — it is used in existing seed.sql and RLS. Add `is_user_defined` as a separate column. |
| `coach_client_links` | `shared_note` | TEXT NULL | D-15; max 500 chars (CHECK optional) |
| `workout_sessions` | `source_program_id` | UUID NULL | FK → workout_programs(id) ON DELETE SET NULL; D-14 |
| `workout_sessions` | `source_session_id` | TEXT NULL | nanoid/UUID of the ProgramSession; D-14 |
| NEW TABLE | `coach_program_folders` | — | See D-08 DDL below |

New table DDL (D-08):
```sql
CREATE TABLE public.coach_program_folders (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL CHECK (char_length(name) <= 100),
  UNIQUE (coach_id, name)
);
ALTER TABLE public.coach_program_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders_own" ON public.coach_program_folders
  FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
```

### RLS Gaps — Also in Migration 045

1. **`workout_programs_coach_read` policy missing.** The existing `"own_programs"` FOR ALL policy covers athletes and coaches reading their own programs. But a coach querying a client's assigned programs (`assigned_to_user_id = clientId`) will get no rows because `user_id = clientId ≠ auth.uid()` (the coach). Add:

```sql
CREATE POLICY "workout_programs_coach_read" ON public.workout_programs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      assigned_to_user_id IS NOT NULL
      AND public.is_coach_of(auth.uid(), assigned_to_user_id)
    )
  );
```

2. **Seed templates read policy.** Seed templates have `created_by_coach_id = NULL`. A separate policy allowing read of seed templates (where `created_by_coach_id IS NULL AND is_template = TRUE`) is needed, OR seed templates use a special system user. Simplest approach — add to the coach_read policy above an OR clause for `is_template = TRUE AND created_by_coach_id IS NULL`. This allows all authenticated users to read seed templates.

### Seed Templates — Migration vs seed.sql

CONTEXT.md D-09 says "seed.sql or a dedicated migration". **Recommendation: use a dedicated migration (046) for seed templates.** Reasons:
- `supabase/seed.sql` is already 500+ lines and runs on every `supabase db reset`
- A migration is idempotent (INSERT ... WHERE NOT EXISTS), versioned, and runs in production on the first deploy
- The seed requires a system user UUID — this needs a DB-level decision that belongs in a migration, not seed.sql
- Pattern established: migration 026 seeds ai_credits default values; migration 035 seeds no data but migrations can contain DML

Seed template approach: `user_id` can reference a special system row in `auth.users`. The cleanest production-safe approach is inserting into `workout_programs` with `user_id` pointing to a known UUID that is inserted by the migration itself (a fake auth user row is fragile). Alternative: relax the `user_id NOT NULL` constraint for rows where `is_template=TRUE AND created_by_coach_id IS NULL`. But this changes the schema contract.

**Simplest safe approach:** Insert seed templates with `user_id = (SELECT id FROM auth.users LIMIT 1)` — fragile. Better: add a nullable override with a dedicated `system_seed BOOLEAN DEFAULT FALSE` column, or use a service-role insert. **Recommend raising as an open question — two valid approaches with tradeoffs.** [ASSUMED — no prior art for null-user program rows in this codebase]

---

## Backend API — programsRouter

### Routes Required

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | `/coach/programs` | `listPrograms(jwt, coachId)` | coach |
| POST | `/coach/programs` | `createProgram(jwt, coachId, body)` | coach |
| GET | `/coach/programs/folders` | `listFolders(jwt, coachId)` | coach |
| POST | `/coach/programs/folders` | `createFolder(jwt, coachId, body)` | coach |
| GET | `/coach/programs/:id` | `getProgram(jwt, coachId, id)` | coach |
| PUT | `/coach/programs/:id` | `updateProgram(jwt, coachId, id, body)` | coach |
| DELETE | `/coach/programs/:id` | `deleteProgram(jwt, coachId, id)` | coach |
| POST | `/coach/programs/:id/assign` | `assignProgram(jwt, coachId, id, clientIds)` | coach |
| POST | `/coach/programs/:id/duplicate` | `duplicateProgram(jwt, coachId, id)` | coach |

**Route ordering note:** `/coach/programs/folders` MUST be registered BEFORE `/coach/programs/:id` in Hono to prevent `folders` matching as a `:id` param. [VERIFIED: Hono routing behavior — first-match wins for parameterized routes]

### Routes Extended on clientsRouter

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | `/coach/clients/:id/programs` | `getProgramsForClient(jwt, coachId, clientId)` | coach |
| PUT | `/coach/clients/:clientId/shared-note` | `upsertSharedNote(jwt, coachId, clientId, note)` | coach |

These are added to `backend/api/src/coach/clients/service.ts` and `db.ts`. [VERIFIED: CONTEXT.md code_context — "don't create a new module; programs are in the clients module scope" for client-facing program queries]

### Exercise Search Endpoint

No exercise search endpoint exists in the backend. [VERIFIED: grep found no `GET /exercises?q=` anywhere in `backend/api/src/`]

The exercise search can be added in two locations:
1. As a route directly on `programsRouter`: `GET /coach/programs/exercises?q=` — scoped to coach usage
2. As a new route on a generic `/exercises` path

**Recommendation:** Add `GET /coach/programs/exercises?q=&limit=10` on `programsRouter`. This avoids polluting the global namespace, maintains module boundaries, and the ExerciseTypeahead component only ever calls it from within the program editor context. Add `POST /coach/programs/exercises` for creating new exercises with `is_user_defined=TRUE`.

Exercise search DB query (fuzzy):
```sql
SELECT id, name, category, muscle_groups
FROM public.exercises
WHERE (is_custom = FALSE OR user_id = auth.uid())
  AND name ILIKE '%' || $1 || '%'
ORDER BY
  CASE WHEN name ILIKE $1 || '%' THEN 0 ELSE 1 END,
  name ASC
LIMIT 10
```

Note: `is_custom = FALSE` covers the Ziko library. `user_id = auth.uid()` covers exercises the coach created in previous sessions. The new `is_user_defined = TRUE` column differentiates coach-created exercises from the seed library but is not needed for the RLS read policy — the existing `read_exercises` policy already handles this correctly.

---

## Web Pages Pattern — Verified

### `/coach/programs` does NOT exist yet

[VERIFIED: `ls apps/web/src/app/[locale]/(coach)/coach/` shows only `clients/`, `dashboard/`, `invitations/`, `layout.tsx`, `settings/`]

All five program pages are new. Pattern to follow exactly: [VERIFIED: `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx`]

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// ... createServerSupabase() + getUser() + redirect
```

### `/coach/clients/[id]/programs` tab does NOT exist yet

[VERIFIED: `ls apps/web/src/app/[locale]/(coach)/coach/clients/[id]/` shows `cardio/`, `habits/`, `journal/`, `layout.tsx`, `measurements/`, `nutrition/`, `page.tsx`, `sessions/`, `sleep/` — no `programs/` directory]

### `ClientTabStrip.tsx` — current 7 tabs, needs 8th

[VERIFIED: `apps/web/src/components/coach/ClientTabStrip.tsx` — TABS array has exactly 7 entries: sessions, measurements, habits, nutrition, sleep, cardio, journal]

Add: `{ key: 'programs', label: 'Programmes' }` as 8th entry.

### `CoachSidebar.tsx` — "Programmes" entry currently disabled

[VERIFIED: `apps/web/src/components/coach/CoachSidebar.tsx` — NAV_ITEMS entry `{ label: 'Programmes', href: '/fr/coach/programs', icon: IoBarChartOutline, disabled: true }`]

Change `disabled: true` → `disabled: false`. One-line edit.

Note: `href` hardcodes `/fr/coach/programs`. This is consistent with the existing Dashboard, Clients, and Invitations entries that also hardcode `/fr/`. This is an existing pattern — do not change it.

---

## Existing coach-sdk Schemas — Gap Analysis

### Already exists (DO NOT duplicate):

`packages/coach-sdk/src/schemas/imported-program.ts` exports a lighter `ExerciseSchema` (used for AI import parsing). It has different field names (`name` not `exercise_name`, `reps` allows up to 1000, no `exercise_name` field). [VERIFIED: packages/coach-sdk/src/schemas/imported-program.ts]

### Must Add (Phase 27):

Three new files:
1. `packages/coach-sdk/src/schemas/program-exercise.ts` — D-04 shape
2. `packages/coach-sdk/src/schemas/program-session.ts` — D-05 ProgramSessionSchema
3. `packages/coach-sdk/src/schemas/program-week.ts` — D-05 ProgramWeekSchema

Export all from `packages/coach-sdk/src/schemas/index.ts`.

The D-04 schema differs from `imported-program.ts` ExerciseSchema in:
- Field is `exercise_name` (not `name`) to reflect that it carries a display name even when `exercise_id` is null
- `reps` max is 100 (not 1000)
- `duration_seconds` min is 1 (not absent)
- Strict no `confidence` field

Do not attempt to unify. The import schema serves AI parsing (needs confidence scores, high maximums for edge cases); the program schema serves coach authoring (stricter, no confidence).

---

## Common Pitfalls

### Pitfall 1: Seed Template User_ID Constraint

**What goes wrong:** Inserting seed templates with `user_id = NULL` fails because `user_id UUID NOT NULL` in migration 001.
**Why it happens:** `workout_programs` was designed for athlete-owned programs; the coach extension (migration 036) added `created_by_coach_id` but didn't relax `user_id`.
**How to avoid:** Decide between: (a) a sentinel UUID inserted as a system user, (b) using the service-role client for seed insertion, or (c) relaxing `user_id` to nullable for templates only (ALTER TABLE ADD CHECK or change NOT NULL). Option (b) is safest: the seed migration runs once with the migration user which has elevated privileges.
**Warning signs:** `null value in column "user_id" of relation "workout_programs" violates not-null constraint`

### Pitfall 2: Hono Route Order for /folders vs /:id

**What goes wrong:** `GET /coach/programs/folders` matches `:id = 'folders'` instead of the static folders route.
**Why it happens:** Hono uses first-match routing for parameterized paths.
**How to avoid:** Register `programsRouter.get('/folders', ...)` and `programsRouter.post('/folders', ...)` BEFORE `programsRouter.get('/:id', ...)` in service.ts.
**Warning signs:** 404 or "program not found: folders" error when loading the folder list.

### Pitfall 3: Missing workout_programs Coach-Read RLS

**What goes wrong:** Coach queries `GET /coach/clients/:id/programs` and gets an empty array even when programs exist.
**Why it happens:** The existing `"own_programs"` policy uses `user_id = auth.uid()`. Assigned programs have `user_id = clientId`, not the coach. No `workout_programs_coach_read` policy exists.
**How to avoid:** Migration 045 must include the new `workout_programs_coach_read` FOR SELECT policy.
**Warning signs:** Empty programs list on client detail Programs tab; no error returned (RLS silently filters rows).

### Pitfall 4: is_custom vs is_user_defined Column Confusion

**What goes wrong:** Developer adds `is_user_defined` and tries to replace `is_custom`, breaking existing seed.sql inserts and the existing `read_exercises` RLS policy.
**Why it happens:** D-07 introduces `is_user_defined` but `is_custom` already exists in migration 001 and seed.sql.
**How to avoid:** Add `is_user_defined BOOLEAN NOT NULL DEFAULT FALSE` as a NEW column alongside `is_custom`. Both columns coexist. Coach-created exercises will have `is_user_defined = TRUE` AND `is_custom = FALSE` (they are shared globally, not custom per-user).
**Warning signs:** seed.sql INSERT failures on `is_custom` column reference.

### Pitfall 5: Duplicate program - weeks_data deep copy

**What goes wrong:** Duplicate template creates a shallow reference — both template and duplicate share JSONB data in application memory, causing silent mutations.
**Why it happens:** JavaScript object spread is shallow for nested structures.
**How to avoid:** Use `structuredClone(program.weeks_data)` on the backend when duplicating. The DB INSERT receives the deep copy as JSON. At the Supabase JSONB level, `INSERT ... SELECT weeks_data FROM ...` is always a copy (JSONB is stored as value).
**Warning signs:** Editing a duplicate changes the original template's session names.

### Pitfall 6: cycle_start_date vs start_date Naming

**What goes wrong:** Developer adds `start_date` but migration 016 already added `cycle_start_date` to `workout_programs`. The two serve different purposes but are easy to confuse.
**Why it happens:** Phase 16 added a cycle feature; Phase 27 adds assignment tracking.
**How to avoid:** The new column must be named `start_date` exactly (D-10 specifies this). Document in the migration comment that `cycle_start_date` is legacy cycle tracking and `start_date` is the assignment start date.
**Warning signs:** TypeScript errors if code references `start_date` before migration runs; SQL errors if trying to add a column that already exists.

---

## Code Examples

### Existing Pattern: Hono router mount (verified)

```typescript
// Source: backend/api/src/app.ts (verified 2026-05-20)
app.route('/coach/identity', identityRouter);
app.route('/coach/invitations', invitationsRouter);
app.route('/coach/clients', clientsRouter);
// Add after:
app.route('/coach/programs', programsRouter);
```

### Existing Pattern: createUserClient in db.ts (verified)

```typescript
// Source: backend/api/src/coach/clients/db.ts (verified 2026-05-20)
export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}
```

### New Pattern: ProgramExerciseSchema (D-04 locked)

```typescript
// New file: packages/coach-sdk/src/schemas/program-exercise.ts
import { z } from 'zod';

export const ProgramExerciseSchema = z.object({
  exercise_id:      z.string().uuid().nullable(),
  exercise_name:    z.string().min(1).max(100),
  sets:             z.number().int().min(1).max(20),
  reps:             z.number().int().min(1).max(100).nullable(),
  duration_seconds: z.number().int().min(1).nullable(),
  target_rpe:       z.number().min(1).max(10).nullable(),
  target_rir:       z.number().int().min(0).max(5).nullable(),
  rest_seconds:     z.number().int().min(0).max(600).nullable(),
  notes:            z.string().max(300).nullable(),
}).strict();

export type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;
```

### New Pattern: AssignmentModal using IndeterminateCheckbox

```typescript
// Source pattern: apps/web/src/components/coach/ClientsTable.tsx IndeterminateCheckbox
// The IndeterminateCheckbox component is NOT exported from ClientsTable — it is defined inline.
// AssignmentModal must either:
// (a) copy the IndeterminateCheckbox component into its own file and import it, OR
// (b) define it inline in AssignmentModal.tsx
// Recommendation: move IndeterminateCheckbox to a shared ui file and import from both.
```

### Existing Pattern: CSS slide-over animation (no library needed)

```css
/* Source: 27-UI-SPEC.md verified pattern — pure CSS transform */
/* SessionSlideOver.tsx */
<div
  className={`fixed right-0 top-0 h-full w-[480px] bg-white border-l border-border
              shadow-xl z-40 transform transition-transform duration-200 ease-out
              ${session ? 'translate-x-0' : 'translate-x-full'}`}
>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Zod `parameters` (AI SDK v3) | `inputSchema` (AI SDK v6) | Phase 22 | Not relevant to Track A — no AI tools in this phase |
| `Alert.alert` in React Native | `showAlert` from @ziko/plugin-sdk | Phase 26 | Not relevant to Track A — web only |
| `is_custom` column on exercises | `is_custom` (existing) + new `is_user_defined` (Phase 27) | Phase 27 | Two coexisting columns; do not rename |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|--------------|
| A1 | `nanoid` or `crypto.randomUUID()` is available for client-generated `session_id` in WeekAccordion | Standard Stack | If `crypto.randomUUID()` unavailable in target Node version, need to add nanoid dep |
| A2 | Seed templates require a service-role insert or sentinel UUID strategy — no prior art in this codebase | DB Migrations | If wrong approach chosen, migration will fail in production on first deploy |
| A3 | `IndeterminateCheckbox` in `ClientsTable.tsx` is not exported as a standalone component | Code Examples | If it is already exported elsewhere, the refactor recommendation is unnecessary |

---

## Open Questions

1. **Seed template `user_id` strategy**
   - What we know: `user_id NOT NULL` constraint exists; seed templates need `created_by_coach_id = NULL`
   - What's unclear: Should the migration (a) insert with a service-role sentinel UUID, (b) relax the NOT NULL constraint for templates, or (c) use a trigger to auto-assign a system user?
   - Recommendation: Use option (a) — create a system user UUID in the migration itself using `auth.users` insert (requires service role in migration) OR defer seed templates to a separate manual step. The planner should pick one approach and document it.

2. **`GET /coach/programs` — seed template visibility filtering**
   - What we know: Seed templates have `created_by_coach_id = NULL`; each coach should see their own templates + all seed templates
   - What's unclear: Should the list endpoint filter `WHERE created_by_coach_id = coachId OR (is_template=TRUE AND created_by_coach_id IS NULL)`? Or rely on RLS alone?
   - Recommendation: Apply the filter in the query (defense-in-depth), not just RLS.

3. **`/coach/programs/[id]/assign` — page vs modal**
   - What we know: UI-SPEC defines it as a modal (Screen A4); it is triggered from the program editor page
   - What's unclear: Does this need its own `page.tsx` route or is it a client component modal rendered within `[id]/page.tsx`?
   - Recommendation: Client-component modal within `[id]/page.tsx`. No separate route needed. The `[id]/assign/` directory in the proposed structure above is a false lead — the assign modal is a 'use client' component, not a separate page.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Hono v4 | programsRouter | ✓ | 4.x | — |
| `@supabase/ssr` | Server Component pages | ✓ | 0.x | — |
| Zod | coach-sdk schemas | ✓ | 3.x | — |
| `@tanstack/react-table` | Programs list (optional) | ✓ | 5.x | Plain `<table>` if not needed |
| `react-icons/io5` | Web coach components | ✓ | 5.x | — |
| Supabase migrations runner | DB changes | ✓ | CLI | — |

No missing dependencies with no fallback. All Track A dependencies are already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in apps/web or backend/api (no jest.config or vitest.config found) |
| Config file | None — Wave 0 must address |
| Quick run command | TBD — no existing test commands in package.json |
| Full suite command | TBD |

Note: The project does not currently have a test infrastructure for the backend or web packages. Based on nyquist_validation being enabled, the planner should include a Wave 0 task to set up at minimum a smoke test for the new API routes.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| PROG-01 | POST /coach/programs creates template with is_template=TRUE | Integration | Backend route test |
| PROG-02 | weeks_data JSONB validates against ProgramWeekSchema | Unit | Zod schema test in coach-sdk |
| PROG-03 | GET /exercises?q= returns filtered results | Integration | Backend route test |
| PROG-04 | POST /coach/programs/folders creates folder | Integration | Backend route test |
| PROG-05 | POST /coach/programs/:id/duplicate creates copy | Integration | Backend route test |
| PROG-06 | POST /coach/programs/:id/assign creates fork per client | Integration | Backend route test |
| PROG-07 | PUT /coach/programs/:id edits assigned program not template | Integration | Backend route test |
| PROG-08 | Seed templates visible in GET /coach/programs | Integration | Backend route test |
| PROG-09 | workout_sessions with source_program_id filterable by week | Integration | Backend route test |

### Wave 0 Gaps
- [ ] No test infrastructure in `backend/api/` — need vitest setup if tests are planned
- [ ] `packages/coach-sdk` has no test files — Zod schema unit tests would be trivial to add

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | RLS `is_coach_of()` + `workout_programs_coach_read` policy; per-request JWT client |
| V5 Input Validation | yes | Zod ProgramWeekSchema on all POST/PUT to /coach/programs; 500-char limit on shared_note; 100-char limit on folder name |
| V2 Authentication | yes (inherited) | authMiddleware on all coach routes |
| V3 Session Management | no | Stateless JWT — Supabase handles |
| V6 Cryptography | no | No new crypto in Track A |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Coach reads another coach's program templates | Elevation of Privilege | RLS `created_by_coach_id = auth.uid()` filter in query; `is_coach_of()` only grants read on client's assigned programs |
| Coach assigns program to non-linked client | Elevation of Privilege | `POST /assign` must verify `is_coach_of(coachId, clientId)` before forking; do NOT rely on frontend filtering |
| JSONB injection via weeks_data | Tampering | Zod validation at API layer before any DB write; `.strict()` rejects unknown keys |
| Shared note IDOR (coach updates another coach's note) | Tampering | `PUT /coach/clients/:id/shared-note` must join against `coach_client_links WHERE coach_id = auth.uid()` — not just any link row |
| Exercise search returning another user's custom exercises | Information Disclosure | RLS `read_exercises` policy: `is_custom = FALSE OR user_id = auth.uid()` already handles this |

---

## Sources

### Primary (HIGH confidence — verified directly in codebase)
- `supabase/migrations/036_workout_programs_ai_imports.sql` — confirmed existing columns on workout_programs
- `supabase/migrations/035_coach_invitations_links_rls.sql` — confirmed is_coach_of() function, coach_client_links schema, missing workout_programs coach-read policy
- `supabase/migrations/001_initial_schema.sql` — exercises table schema (is_custom, user_id NOT NULL), workout_programs user_id NOT NULL
- `supabase/migrations/016_program_cycles_schema.sql` — cycle_start_date already exists (naming conflict check)
- `backend/api/src/app.ts` — router mount pattern, no existing /exercises route
- `backend/api/src/coach/clients/service.ts` — clientsRouter extension pattern
- `backend/api/src/coach/clients/db.ts` — createUserClient pattern
- `packages/coach-sdk/src/schemas/index.ts` — existing exports, gap confirmed
- `packages/coach-sdk/src/schemas/imported-program.ts` — lighter ExerciseSchema that must not be conflated with new D-04 schemas
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — force-dynamic + createServerSupabase() pattern
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — client detail layout pattern
- `apps/web/src/components/coach/CoachSidebar.tsx` — confirmed "Programmes" disabled: true
- `apps/web/src/components/coach/ClientTabStrip.tsx` — confirmed 7 tabs, no programs tab
- `apps/web/src/components/coach/SpecialtyTagInput.tsx` — debounce/keyboard pattern for ExerciseTypeahead clone
- `apps/web/src/components/coach/ClientsTable.tsx` — IndeterminateCheckbox pattern
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` — backdrop + focus trap pattern
- `.planning/phases/27-coaching-programs-mobile-mon-coach-full/27-CONTEXT.md` — all locked decisions
- `.planning/phases/27-coaching-programs-mobile-mon-coach-full/27-UI-SPEC.md` — component specs, animation, copywriting

### Secondary (MEDIUM confidence — documented in planning files)
- `.planning/REQUIREMENTS.md` — PROG-01..09 requirement IDs and descriptions
- `.planning/ROADMAP.md` — Phase 27 success criteria and dependency chain

---

## Metadata

**Confidence breakdown:**
- DB migration gap analysis: HIGH — every column verified against actual migration files
- Backend route pattern: HIGH — existing modules read and confirmed
- coach-sdk schema gap: HIGH — schemas/index.ts read directly
- Web page structure: HIGH — directory listing confirmed
- Component reuse: HIGH — all named components verified in `apps/web/src/components/coach/`
- Seed template strategy: MEDIUM — user_id NOT NULL constraint confirmed but solution approach has two valid options requiring a decision

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable stack — Next.js App Router, Hono, Supabase patterns are not fast-moving here)
