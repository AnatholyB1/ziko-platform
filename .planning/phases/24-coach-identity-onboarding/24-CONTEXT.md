# Phase 24: Coach Identity & Onboarding — Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 23 (complete 2026-05-15)

<domain>
## Phase Boundary

Phase 24 ships the **first user-visible coach surface** — the full journey from landing on
`/coach/onboarding` to arriving at a working coach dashboard. Five success criteria define
the boundary:

1. Self-serve role promotion at `/coach/onboarding` → `user_profiles.role = 'coach' | 'both'`
2. Coach profile persisted (`coach_profiles`: display name, bio, specialties, website, photo)
3. Optional KYC doc upload → `kyc_status = 'pending'` visible in `/coach/settings`
4. `role='both'` user: one login → both athlete mobile + coach web CRM
5. `backend/api/src/coach/identity/` bounded module with `service.ts` public entry + CI guard

**First tasks of Phase 24 (housekeeping from Phase 23):**
- Delete `apps/web/src/app/[locale]/(coach)/coach/_smoke/` route group
- Delete `apps/web/src/app/api/_debug/limits/route.ts` and `backend/api/src/routes/_debug.ts`

**Out of phase (explicitly deferred):**
- Invitation code generation → Phase 25
- Client roster at `/coach/clients` → Phase 26
- Program template authoring → Phase 27
- AI file imports → Phase 28
- Admin KYC review / backend moderation → post-v1.5

</domain>

<decisions>
## Implementation Decisions

### Login & Auth Entry Point

- **D-01 — Auth method: email + password.** `/fr/login` ships a custom Next.js Server Component
  form using Supabase email/password auth (`supabase.auth.signInWithPassword`). No magic links,
  no OAuth, no Supabase Auth UI component (hard to theme). Form matches Ziko light sport palette
  (orange #FF5C1A CTA, white surface).

- **D-02 — Shared login for all users.** `/fr/login` serves both athletes and coaches — one auth
  entry point for the web. After login, routing logic branches:
  - `role = 'coach' | 'both'` → `/coach/dashboard`
  - `role = 'client'` or no role → redirect to `/coach/onboarding`

- **D-03 — Non-coach post-login redirect.** An authenticated user without coach role who visits
  any `(coach)` route is redirected to `/coach/onboarding` (not a gate/error page). Makes
  the "become a coach" path seamless and avoids dead-end screens.

- **D-04 — `/fr/login` is a new route.** The `(coach)` layout's hard-coded
  `redirect('/fr/login')` from Phase 23 now resolves to a real page. The login page also
  accepts an optional `?next=` parameter (safe: validate against allowlist of internal paths)
  for post-login deep-linking to onboarding.

### Onboarding Journey Shape

- **D-05 — 3-step wizard at `/coach/onboarding`.** Linear flow with a progress indicator:
  1. **Step 1 — Role promotion**: Confirmation screen. If `role=client`, copy reads "Votre
     compte athlète reste actif — vous ajoutez le rôle coach." Calls
     `PATCH /coach/identity/role` → sets `role = 'coach' | 'both'`. Requires auth (see D-06).
  2. **Step 2 — Profile**: `display_name` (required), `bio` (textarea, optional), `specialties`
     (tag input, optional, max 20), `website` (URL, optional), **photo** (optional, file picker,
     stored in `coach-kyc` bucket — see D-10). Server Action PATCH to `coach_profiles`.
  3. **Step 3 — KYC (optional)**: Doc upload (see D-11). Skip button available. Sets
     `kyc_status = 'submitted'` if any docs uploaded; stays `'pending'` if skipped.
  
  Completion redirects to `/coach/dashboard`.

- **D-06 — `/coach/onboarding` is public + auth-gated.** Page is publicly accessible (reachable
  from the landing page CTA without login). Step 1 requires auth — if unauthenticated, redirect
  to `/fr/login?next=/coach/onboarding`. Returning from login resumes at Step 1. No step state
  is persisted server-side between visits (wizard state is client-only via React state / URL
  params); idempotent: re-visiting after completion detects `role = 'coach'` and redirects to
  `/coach/dashboard`.

- **D-07 — Existing athletes use the same flow; role becomes `both`.** Step 1 detects current
  `role`. If `role = 'client'`, copy adapts ("add the coach role") but wizard steps are
  identical. Role is set to `'both'` (not `'coach'`). No separate upgrade path.

- **D-08 — `backend/api/src/coach/identity/service.ts` as the only public entry.** Routes:
  - `PATCH /coach/identity/role` — promotes `user_profiles.role` to `coach | both`
  - `POST /coach/identity/profile` — creates `coach_profiles` row
  - `PATCH /coach/identity/profile` — updates `coach_profiles` row
  - `GET /coach/identity/profile` — reads own `coach_profiles`
  
  All routes use per-request user JWT (never SERVICE_ROLE). All guarded by `creditCheck`
  middleware (no credit cost, just auth gate). ARCH-01 + ARCH-03 satisfied.

### Coach Dashboard Shell

- **D-09 — Sidebar nav skeleton + welcome card.** `/coach/dashboard` renders:
  - **Sidebar**: nav items — Dashboard (active), Clients (disabled, "Bientôt"), Programmes
    (disabled, "Bientôt"), IA (disabled, "Bientôt"), Paramètres (always active).
    Ziko orange accent on active item. `react-icons` icons.
  - **Main area**: Welcome card — `display_name`, KYC status chip (pending/submitted/verified),
    optional Phase 25 CTA ("Inviter un client →" — shown early as a teaser, button is static
    text or a disabled link in Phase 24 since the invite route doesn't exist yet).
  
  The sidebar nav shell is the same component that Phases 26–29 will progressively unlock —
  planner must architect it as a reusable layout so later phases just flip `disabled` props.

- **D-10 — `/coach/settings` ships as full editable form.** SC2 + SC5 require it. Renders:
  - Editable profile form (same fields as onboarding Step 2): display_name, bio, specialties,
    website, photo. Server Action PATCH to `coach/identity/profile`.
  - KYC section: doc list with uploaded docs (filename, type, upload date) + "Add document"
    button. `kyc_status` chip (read-only — moderation decides, coach cannot change).
  - Accessible from sidebar Paramètres nav item.

### KYC & File Uploads

- **D-11 — New private Supabase Storage bucket `coach-kyc`.** Separate from existing
  `scan-photos`, `exports`, `avatars` buckets. Path pattern: `{user_id}/{filename}`.
  RLS: bucket is private, only the owning coach can read/write their own folder
  (path-prefix pattern matches `(storage.foldername(name))[1] = auth.uid()::text`).
  Future admin moderation uses service-role in a Phase 31+ admin back-office.
  
  **New migration required** — planner must create `migration 037_coach_kyc_bucket.sql`
  that provisions the bucket via Supabase Storage API / migration or documents the manual
  Supabase dashboard step (buckets aren't provisioned in SQL migrations — use the
  Supabase MCP `supabase_storage_create_bucket` or dashboard step; document choice in PLAN.md).

- **D-12 — Profile photo in onboarding Step 2, stored in `coach-kyc` bucket.** Optional.
  Path: `{user_id}/photo.{ext}`. Max 5 MB. Accepted formats: JPEG, PNG, WebP.
  Signed URL pattern from v1.3 (direct upload to Supabase Storage, bypasses Vercel 4.5 MB
  limit). `coach_profiles.photo_url` set to the public CDN URL after upload.

- **D-13 — KYC upload UX: button per doc type, native file picker.** No drag-drop (mobile
  browser compat issues, feature is low-traffic). Each doc type (certification, id_document,
  other) has an "Ajouter" button. After selecting a file: shows filename + type chip + "×"
  remove. Max 3 docs total, max 5 MB each. Accepted formats: PDF, JPEG, PNG, WebP.
  `kyc_docs` JSONB updated via Server Action PATCH after each upload.

### Claude's Discretion

- Exact Tailwind/CSS class structure for the sidebar nav and wizard progress bar — match
  Phase 23's established `apps/web` styling patterns.
- Whether wizard step state uses URL search params (`?step=2`) or React client state —
  URL params are resumable but expose step count; client state is simpler.
- Exact shape of the `/fr/login?next=` allowlist validation (prevent open-redirect).
- How to handle the Supabase Storage bucket creation in the migration — research whether
  `create bucket` is possible via SQL migration or requires a separate MCP call / dashboard step.
- Whether `/coach/onboarding` is inside the `(coach)` layout (force-dynamic, auth guard) or
  a separate layout (publicly accessible) — D-06 says it's public, so it likely lives OUTSIDE
  the `(coach)` layout guard, using its own auth check at the step level.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — vision, key decisions log, v1.5 bounded-contexts architecture
- `.planning/REQUIREMENTS.md` — §COACH-01 through §COACH-05, §ARCH-01, §ARCH-03
- `.planning/ROADMAP.md` — §Phase 24 success criteria (5 items), §Phase 25 (depends on coach identity being stable)
- `.planning/STATE.md` — v1.5 blockers, Phase 23 completion record

### Phase 22 (DB foundation)
- `.planning/phases/22-schema-foundation-rls-keystone/22-CONTEXT.md` — D-11 (weeks_data Zod in coach-sdk), D-09 (full ai_imports column set)
- `supabase/migrations/034_coach_role_profiles.sql` — `coach_profiles` table definition + RLS policy; column set Phase 24 must match
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `coach_client_links` RLS (Phase 24 identity doesn't touch this but must not break it)

### Phase 23 (web foundation)
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md` — D-09 (`(coach)` route position inside `[locale]`), D-11 (ESLint ban on `@supabase/supabase-js`), D-12 (ARCH-02 CI grep), D-13 (smoke route to delete), D-15 (_debug routes to delete)
- `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — Phase 23 smoke layout; REPLACE in Phase 24 (delete _smoke contents, keep layout pattern for auth guard)
- `packages/coach-sdk/src/schemas/coach-profile.ts` — `CoachProfileSchema` Zod definition; Phase 24 form fields must exactly match this schema
- `packages/coach-sdk/src/schemas/coach-client-link.ts` — `CoachClientLinkSchema` (do not break in Phase 24)
- `apps/web/src/lib/supabase/` — 4 factory files (`client.ts`, `server.ts`, `middleware.ts`, `admin.ts`); all Phase 24 Server Components use `createServerSupabase()`, Server Actions use `createServerSupabase()`

### Existing upload pattern (v1.3 — reuse)
- `backend/api/src/routes/storage.ts` (or equivalent) — signed URL upload pattern from v1.3; Phase 24 KYC/photo upload reuses this exact pattern
- `supabase/migrations/` (relevant storage bucket migrations) — reference for how existing buckets (`scan-photos`, `exports`, `avatars`) were provisioned

### Backend bounded-context pattern
- `backend/api/src/routes/` + `backend/api/src/middleware/auth.ts` — existing route + auth middleware pattern that `coach/identity/` routes must follow
- `backend/api/src/config/models.ts` — centralized model config (Phase 24 doesn't add AI calls, but should import the pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`apps/web/src/app/[locale]/(coach)/coach/layout.tsx`** — Phase 23 smoke layout shell.
  Phase 24 replaces the contents (delete `_smoke/` directory, upgrade layout to full coach
  chrome with sidebar). Auth guard pattern (`createServerSupabase().auth.getUser()` +
  `redirect()`) stays identical — reuse verbatim.

- **`packages/coach-sdk/src/schemas/coach-profile.ts`** — `CoachProfileSchema` already
  defines all profile fields. Phase 24 form fields are a direct projection of this schema.
  `CoachKycDocSchema` defines the JSONB shape for each uploaded doc.

- **`@upstash/ratelimit` + `@upstash/redis`** — Already in `apps/web`. Phase 24 KYC upload
  endpoint and onboarding role-promotion endpoint should rate-limit (prevents bulk role
  promotions / doc floods).

- **`framer-motion@^12.38`** — Available for wizard step transitions (slide-in between steps).
  Optional — planner decides if animation adds enough value for the complexity.

- **`react-icons@^5.6.0`** — Locked icon library (D-17 from Phase 23). Use for sidebar nav
  icons and status chips.

### Established Patterns

- **Supabase Storage signed URL upload (v1.3)**: Client requests a signed upload URL from
  backend → direct PUT to Supabase Storage → backend records the CDN URL. Bypasses Vercel's
  4.5 MB body limit. Phase 24 KYC + photo uploads MUST follow this exact pattern.

- **`force-dynamic` + `revalidate = 0` + `cache: 'no-store'`** — Mandatory on ALL `(coach)`
  routes (ARCH-06). Planner: every new coach page file must include these exports.

- **Server Action re-check (ARCH-05 layer 3)**: Every Server Action independently calls
  `supabase.auth.getUser()` before mutating data. Phase 23 established this as non-optional.

- **Bounded module entry** (`service.ts` as sole public entry): `backend/api/src/coach/identity/`
  must expose only `service.ts`. Internal files (`db.ts`, `types.ts`) are importable from
  within the module but blocked by ESLint outside (D-12 from Phase 23, activates with Phase 24
  as the first module).

### Integration Points

- **`apps/web/src/app/[locale]/(coach)/coach/`** — Phase 24 replaces `_smoke/` and builds:
  `dashboard/page.tsx`, `settings/page.tsx`, `onboarding/` (likely OUTSIDE `(coach)` layout),
  and the real `layout.tsx` with sidebar chrome.

- **`backend/api/src/coach/identity/`** — New bounded module. Files: `service.ts`, `db.ts`
  (Supabase queries), `types.ts` (internal TS types). Routes registered in `backend/api/src/app.ts`.

- **Migration 037** — New Supabase migration needed for the `coach-kyc` storage bucket
  provisioning. Planner: research if Supabase allows bucket creation via SQL migration or
  only via dashboard/MCP tool.

- **`apps/web/src/app/[locale]/login/page.tsx`** (new) — The real login page. Lives inside
  `[locale]` but OUTSIDE `(coach)` layout (public route). Handles email/password form +
  post-login redirect routing.

- **`apps/web/src/app/[locale]/(coach)/coach/onboarding/`** — New route. Likely OUTSIDE the
  `(coach)` auth-guard layout (D-06: publicly accessible). Either its own layout with step-level
  auth, or a top-level route that handles auth inline.

</code_context>

<specifics>
## Specific Ideas

- **Wizard UI reference**: User selected the multi-step wizard preview showing FR copy
  ("Devenir coach", "Votre compte Ziko existant sera mis à niveau"). All wizard copy ships
  in French first (FR is default locale per PROJECT.md); EN translations added via `next-intl`
  key pattern from existing landing pages.

- **Dashboard sidebar reference**: User selected the sidebar skeleton preview showing
  "Clients [Soon]", "Programmes [Soon]", "IA [Soon]" disabled items. This nav structure
  must be designed to be progressively unlocked — planner should make disabled state a prop,
  not hard-coded absence.

- **Consistent "recommended defaults" pattern**: Same as Phase 22 and 23 — user picked the
  recommended option on every question. Treat this as ratification of conservative
  codebase-pattern-matching choices. Any deviation from existing patterns needs explicit
  justification in PLAN.md.

- **KYC upload stays simple on purpose**: No drag-drop, no preview, no multi-file batch.
  Button + filename + remove. Coaches upload 1-2 docs at most; polish is Phase 31+ admin scope.

</specifics>

<deferred>
## Deferred Ideas

- **Invitation code generation/sharing** from the dashboard — the welcome card shows a static
  "Inviter un client →" teaser CTA, but actual code generation ships in Phase 25.

- **Email notifications on KYC submission** — "We received your documents" email to coach +
  admin notification. Deferred to Phase 31 admin/moderation scope.

- **Google OAuth / social login** — not discussed; email+password is sufficient for v1.5.

- **Manual KYC review back-office** — explicitly deferred to post-v1.5 per PROJECT.md.

- **Granular coach onboarding analytics** (step completion rates, drop-off) — v1.6+ Plausible
  event tracking.

- **Mobile coach login on web** — athletes use the mobile app; the web `/fr/login` is for
  coaches. If an athlete lands on the web login, they're redirected to `/coach/onboarding`.
  A dedicated "Download the mobile app" landing for non-coach athletes is post-v1.5.

- **Playwright E2E for login + onboarding flow** — Phase 24 is the first phase worth E2E
  testing (per Phase 23 D-16 deferral). Planner: decide if E2E tests ship in this phase
  or immediately after as Phase 24+.

</deferred>

---

*Phase: 24-coach-identity-onboarding*
*Context gathered: 2026-05-15*
