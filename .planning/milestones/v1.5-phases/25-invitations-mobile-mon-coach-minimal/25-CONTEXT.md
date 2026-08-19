# Phase 25: Invitations & Mobile "Mon coach" Minimal — Context

**Gathered:** 2026-05-17
**Status:** Ready for `/gsd-ui-phase 25` (then `/gsd-plan-phase 25`)
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 24 (complete 2026-05-16)

<domain>
## Phase Boundary

Phase 25 ships the **first cross-user link primitive** — a coach issues a 6-character
invitation code; an athlete redeems it to create a revocable `coach_client_links` row.
The DB schema and constant-time redemption RPC already exist (Phase 22 migrations 035 +
`redeem_invitation_code`). Phase 25 ships the **service layer + UI**.

**Scope shift recorded during discussion:**

- **In Phase 25 (v1.5):** backend modules + web UI for both coach (generate/list/revoke)
  and athlete (redeem/preview/revoke via browser).
- **Deferred to v1.6 seed:** mobile "Mon coach" plugin (full redemption + preview + revoke
  flows) — see `<deferred>` below for the seed contract.

**Five success criteria (re-mapped to web-only loop):**

1. A coach can generate a 6-char `[A-Z2-9]` invitation code from `/coach/invitations`,
   set its expiration via preset chips (7d / **14d default** / 30d / Never), see it in a
   list with status (active / used / expired / revoked), and revoke any active code.
2. An athlete (logged in or redirected to log in) lands on `/r/[code]` (deep-link from
   shared URL) or `/redeem` (manual entry) and — on a valid code — sees a coach preview
   card.
3. Before confirming, the athlete sees a preview of the coach (photo, display_name,
   specialties chips, bio, KYC badge); expired or already-used codes return a clear error
   without creating a link.
4. Code redemption is rate-limited (5 attempts / 15min per IP, 10 / hour per user) on top
   of the constant-time SQL RPC. Errors return constant-time responses regardless of
   failure reason.
5. The athlete can revoke an active coach link from the same `/redeem` page (now state-aware:
   "no code" / "preview" / "linked-with-revoke-CTA") via a typed-confirmation modal; the
   coach loses read access on the next RLS-gated read (already guaranteed by Phase 22 D-01
   timestamp predicate).

**Out of phase (explicitly deferred):**

- Mobile "Mon coach" plugin — v1.6 seed (full design + plugin packaging + tab-bar entry)
- Bulk invitations / pre-fill email / invitation analytics — post-v1.5
- Coach revoking an *active link* (vs. an *issued code*) from the dashboard — Phase 26
  (CRM Client Management roadmap SC5)
- Admin/back-office views of any invitation data — post-v1.5

</domain>

<decisions>
## Implementation Decisions

### Scope & Delivery Model

- **D-01 — Mobile work fully deferred.** All mobile-side Phase 25 work (MOBILE-01,
  MOBILE-05, INVITE-03/05/06/07 athlete UI) moves out of v1.5 and is captured as a v1.6
  seed (see `<deferred>`). Phase 25 ships **zero lines of mobile code**. The link
  primitive is exercised end-to-end via web only.
- **D-02 — Redemption loop closed on web.** Phase 25 ships a web `/redeem` (manual entry)
  page + `/r/[code]` deep-link short route so athletes can redeem from any browser. The
  page is state-aware: empty (no code) → preview (valid code, not yet linked) → linked
  (already has active coach, shows revoke CTA).
- **D-03 — UI-design-first gate (HARD).** `/gsd-ui-phase 25` MUST run before
  `/gsd-plan-phase 25`. The UI-SPEC.md output must include the Claude Design / Figma
  prompt for: (a) `/coach/invitations` page (coach side), (b) `/r/[code]` + `/redeem`
  page in all three states (athlete side), (c) the deferred v1.6 mobile "Mon coach"
  plugin (so the seed inherits a baked design contract). Planner cannot proceed without
  UI-SPEC.md.

### Backend (bounded modules)

- **D-04 — Two bounded modules.** Create `backend/api/src/coach/invitations/` (issuing,
  listing, revoking codes — coach-owned) AND `backend/api/src/coach/clients/` (link
  primitives: redeem, list links, revoke link — athlete-or-coach scope). Both follow the
  Phase 24 pattern (`service.ts` is the only public entry; `db.ts` per-request JWT only;
  `types.ts` module-internal). ARCH-01 / ARCH-02 / ARCH-03 satisfied; CI grep for
  `SERVICE_ROLE` under `coach/` already configured.
- **D-05 — Routes (coach side, `coach/invitations`):**
  - `POST   /coach/invitations` — generate code; body `{ expires_at: ISOString | null }`;
    returns `{ id, code, expires_at, created_at }`.
  - `GET    /coach/invitations` — list own codes; supports `?status=active|used|expired|revoked|all`;
    default = `active`. Returns array of invitations + computed `status`.
  - `DELETE /coach/invitations/:id` — revoke (sets `revoked_at = now()` in
    `coach_invitations`); idempotent if already revoked/used.
- **D-06 — Routes (athlete/link side, `coach/clients`):**
  - `GET    /coach/clients/links/me` — current active coach for the requester, including
    coach preview payload (display_name, bio, specialties, photo_url signed URL, kyc_status).
    Returns 200 with `{ link: null }` when unlinked; never 404.
  - `POST   /coach/clients/links/preview` — body `{ code }`; validates code without
    creating a link; returns preview payload (same shape as `links/me`) OR a constant-time
    error envelope `{ ok: false, error_code }`. Driven by the Phase 22 `redeem_invitation_code`
    pattern with a `dry_run = true` flag OR a thin SQL companion `peek_invitation(code)` —
    research decides.
  - `POST   /coach/clients/links/redeem` — body `{ code }`; calls the existing
    `redeem_invitation_code(code)` RPC; on success returns the new link + same preview
    payload; on failure returns the constant-time envelope.
  - `DELETE /coach/clients/links/:id` — revoke (sets `coach_client_links.revoked_at = now()`).
    Authorization: requester must be `client_id` (athlete revokes their own link); coach-side
    link revocation is Phase 26.
- **D-07 — Rate limiting via Upstash.** Add a shared middleware
  `backend/api/src/middleware/rateLimit.ts` (NEW) using Upstash Redis +
  `@upstash/ratelimit`. Two buckets composed on `/coach/clients/links/preview` and
  `/coach/clients/links/redeem`:
  - IP bucket: 5 / 15min (sliding window)
  - User bucket: 10 / hour (sliding window) — keyed on `auth.uid()` after auth middleware
  
  On limit hit: 429 with `Retry-After` header + the same constant-time error envelope
  shape (no leak about which bucket fired). Required env vars: `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN` — verify Vercel env config in planning.
- **D-08 — `nanoid` selection.** Per ROADMAP open decision #5: check `backend/api/package.json`
  `"type"` field. If `type: "module"` → use nanoid v5 (ESM-only). If absent / `"commonjs"`
  → use nanoid v4 (CJS-compatible). Code generator uses `customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789', 6)`
  for the `[A-Z2-9]{6}` charset (matches DB CHECK from Phase 22 D-06). Collisions on insert
  are caught by the UNIQUE constraint and retried up to 3× server-side.
- **D-09 — GDPR retention on link revocation.** Per ROADMAP open decision #4: `SET NULL`.
  Migration 035 already sets `workout_programs.assigned_to_user_id` ON DELETE behavior;
  no new migration needed in Phase 25. Phase 26 (CRM) revisits if legal review requires
  hard purge.

### Web (coach side — `/coach/invitations`)

- **D-10 — Dedicated `/coach/invitations` route.** Unlock the sidebar "Invitations" entry
  (currently `disabled` "Bientôt" per Phase 24 D-09) — flip `disabled: false`. Route path:
  `apps/web/src/app/[locale]/(coach)/coach/invitations/page.tsx`. `force-dynamic` +
  `revalidate = 0` + `cache: 'no-store'` (Phase 23 D-15).
- **D-11 — Page layout:**
  - Page header: "Invitations" + primary CTA "Générer un code"
  - Generate flow: button opens a small panel (NOT a full modal — stays in-page). Panel
    contents: expiration chip group (7d / 14d default / 30d / Never) + "Générer" button.
    On submit → Server Action calls `POST /coach/invitations`, response renders an inline
    "code card" (see D-12) at the top of the list.
  - Table below: columns = Code (mono, copyable) / Created / Expires / Status chip / Actions.
    Default filter chips: "Actives" (default) / "Toutes". "Toutes" shows used + expired +
    revoked with greyed-out chips. No pagination needed for v1.5 (10s of codes per coach).
- **D-12 — Generated code card.** Large monospaced display of the code (e.g. `ZK4F2A9B`
  rendered with `tabular-nums` font), "Copier" button (clipboard API), and a copyable
  share URL `https://ziko-app.com/r/{code}` with its own "Copier le lien" button. Card
  shows the expiration date below ("Expire le 31 mai 2026" or "Sans expiration"). One-shot
  display — re-rendering the page collapses to the table row (no persistent "freshly-generated"
  banner).
- **D-13 — Revoke confirmation pattern (coach side).** Click "Révoquer" in the actions
  column → opens a modal with title "Révoquer cette invitation ?" + body explaining the
  code becomes unusable + "Tapez COACH pour confirmer" text input + red "Révoquer" button
  (disabled until input matches `COACH` case-sensitive). Cancel button closes. Symmetric
  with athlete revoke (D-16) for design consistency.

### Web (athlete side — `/redeem` + `/r/[code]`)

- **D-14 — URL shapes:**
  - `/[locale]/r/[code]` — short deep-link, auto-prefills the code and runs preview on
    mount (after auth). Coach shares this URL with their athlete.
  - `/[locale]/redeem` — manual-entry surface (single `<input maxLength={6}>`,
    auto-uppercase via `onChange={e => e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '')}`,
    submit enabled when 6 chars present).
  
  Both routes resolve to the same React tree (one Server Component reading either
  `params.code` or `searchParams.code`); the state machine below applies to both.
- **D-15 — Auth gate before preview.** Page server-checks `supabase.auth.getUser()` first.
  Unauthenticated → `redirect('/{locale}/login?next=' + encodeURIComponent(currentPath))`.
  After login the user lands back on the same redeem URL (existing Phase 24 safeNext
  allowlist already supports `/r/*` and `/redeem` — verify and extend the allowlist if
  needed). Prevents enumeration of coach previews by anonymous traffic.
- **D-16 — State machine for `/redeem`:**
  - **State A — no code / unlinked:** Manual-entry input + submit. On submit → calls
    `POST /coach/clients/links/preview`. On success transitions to State B. On error,
    inline message (red text below the input): "Ce code n'est pas valide ou a expiré."
    (constant-time envelope — single error copy regardless of underlying cause).
  - **State B — preview / unlinked:** Coach preview card shown (D-17). CTA "Lier mon
    compte" + secondary "Annuler" link that returns to State A (or `/redeem`). On confirm
    → `POST /coach/clients/links/redeem`. Success transitions to State C. Failure shows
    the constant-time error in a toast and returns to State A.
  - **State C — linked:** No-code variant of the page becomes "Vous êtes lié à [Coach
    Name] depuis [date]" + coach preview card (read-only) + "Retirer ce coach" button.
    Loaded by reading `GET /coach/clients/links/me` on server-side. If a user with an
    active link types a NEW code (still in State A entry), the preview can show; redeem
    is rejected by DB constraint (one active link per client per coach pair). Future:
    Phase 26 may support multiple coaches per client — Phase 25 keeps single-active.
- **D-17 — Coach preview card contents.** Photo (signed URL from `coach-kyc` bucket,
  generated server-side) + `display_name` (h2) + `specialties[]` rendered as chip group
  + `bio` (truncated to ~200 chars with "Voir plus" disclosure) + KYC badge
  ("Vérifié" green / "En attente" grey / hide if NULL). CTA "Lier mon compte" (Ziko orange
  `#FF5C1A`) + "Annuler" text link.
- **D-18 — Revoke confirmation pattern (athlete side).** Click "Retirer ce coach" →
  same typed-confirmation modal as D-13 with copy adapted: title "Retirer ce coach ?" +
  body "[Coach] perdra immédiatement l'accès en lecture à vos données." + input "Tapez
  COACH pour confirmer" + red "Retirer" button. On confirm → `DELETE /coach/clients/links/:id`.
  State transitions back to State A.

### Cross-Cutting

- **D-19 — i18n keys.** All new strings ship in fr + en. Web uses `next-intl` with new
  namespaces `coach.invitations.*` (coach side) and `coach.redeem.*` (athlete side).
  Error envelope copy is centralized in `coach.redeem.errors.*` so the constant-time
  guarantee survives translation (all error codes map to the same single key).
- **D-20 — `coach-sdk` schema additions.** Add `CoachInvitationSchema` to
  `packages/coach-sdk/src/schemas/` with fields matching Phase 22 D-07 column set; export
  from `index.ts`. Add `CoachLinkPreviewSchema` for the preview payload (includes
  `coach_profile` subset). Consumed by web Server Actions + backend routes for validation.

### Claude's Discretion

- Exact Tailwind class structure for `/coach/invitations` + `/redeem` — match Phase 24
  `apps/web` styling patterns (light sport theme, orange `#FF5C1A` CTAs).
- Whether the generate panel is an in-page collapsible region or a small slide-over —
  Claude Design / Figma prompt (D-03) will lock this.
- Exact filter chip group component — reuse anything that exists in `apps/web` from
  Phase 24, otherwise build a thin one.
- Whether to use Server Actions for revoke + generate, or `useFormState` + REST — match
  the predominant pattern in Phase 24's onboarding wizard.
- Error envelope wire format (`{ ok: false, error_code: 'INVALID_OR_EXPIRED' }` vs
  HTTP status + body) — researcher decides based on Phase 22 RPC return shape.
- Whether `peek_invitation` is a new SQL function or driven by a `dry_run` flag on the
  existing `redeem_invitation_code` RPC — research decides; both satisfy D-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — vision, key decisions log, v1.5 bounded-contexts architecture
- `.planning/REQUIREMENTS.md` — §INVITE-01..07, §MOBILE-01, §MOBILE-05 (note: MOBILE-01/05
  are now scoped to the v1.6 mobile-plugin seed — see `<deferred>`)
- `.planning/ROADMAP.md` — §Phase 25 success criteria, §Open Decisions table (rows 4 + 5)
- `.planning/STATE.md` — v1.5 completion record for Phases 22–24, current blockers
- `.planning/config.json` — `workflow.ui_phase` + `workflow.ui_safety_gate` (verify
  enforcement for D-03)

### Phase 22 (DB foundation — the keystone for everything in Phase 25)
- `.planning/phases/22-schema-foundation-rls-keystone/22-CONTEXT.md` — D-01 (timestamp
  predicate, no `status` column), D-02 (`is_coach_of()` shape), D-06 (code charset +
  CHECK), D-07 (`coach_invitations` full column set), D-08 (constant-time
  `redeem_invitation_code` RPC), D-09 (GDPR SET NULL on revoke)
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `coach_invitations`,
  `coach_client_links`, `is_coach_of()`, `redeem_invitation_code(code)` RPC; column shape
  Phase 25 backend must match
- `supabase/migrations/034_coach_role_profiles.sql` — `coach_profiles` shape (read by
  preview payload)

### Phase 23 (web foundation — the auth + routing model Phase 25 builds on)
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md` — D-09
  (`(coach)` route position inside `[locale]`), D-11 (ESLint ban on direct
  `@supabase/supabase-js`), D-12 (ARCH-02 CI grep for `SERVICE_ROLE` under coach/), D-15
  (`force-dynamic` + `revalidate=0` + `cache:'no-store'` on all `(coach)` routes)
- `apps/web/src/lib/supabase/` — 4 factory files (`client.ts`, `server.ts`,
  `middleware.ts`, `admin.ts`); Phase 25 Server Components use `createServerSupabase()`,
  Server Actions use `createServerSupabase()` — no raw `@supabase/supabase-js`
- `packages/coach-sdk/src/schemas/coach-client-link.ts` — `CoachClientLinkSchema` (Phase 25
  must not break)
- `packages/coach-sdk/src/schemas/coach-profile.ts` — `CoachProfileSchema` (preview reads
  from this)

### Phase 24 (coach onboarding — the surfaces Phase 25 extends)
- `.planning/phases/24-coach-identity-onboarding/24-CONTEXT.md` — D-04 (`/fr/login` +
  safeNext allowlist — Phase 25 extends to allow `/r/*` + `/redeem`), D-08 (bounded
  module `coach/identity/service.ts` pattern that `coach/invitations/` + `coach/clients/`
  must mirror), D-09 (sidebar nav with "Bientôt" placeholders — Phase 25 unlocks
  "Invitations")
- `apps/web/src/app/[locale]/(coach)/coach/layout.tsx` — auth guard layout; Phase 25
  routes inherit
- `apps/web/src/app/[locale]/login/page.tsx` — login form + safeNext logic; Phase 25
  must extend the allowlist to `/r/*` + `/redeem`
- `backend/api/src/coach/identity/{service.ts,db.ts,types.ts}` — bounded-module reference
  shape Phase 25 backend modules must follow

### External (research targets — for the researcher agent)
- Upstash Ratelimit: `@upstash/ratelimit` README + `@upstash/redis` REST client patterns
- `nanoid` v4 vs v5 — verify CJS compatibility with `backend/api/package.json`
- `next-intl` namespace + route segment patterns for the new `coach.invitations.*` and
  `coach.redeem.*` namespaces

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `backend/api/src/coach/identity/{service.ts,db.ts,types.ts}` — exact bounded-module
  shape to clone for `coach/invitations/` and `coach/clients/`. Per-request JWT client
  factory in `db.ts` is the canonical pattern.
- `apps/web/src/lib/supabase/server.ts` — `createServerSupabase()` Server Component
  factory. Used by every Phase 25 web page.
- `apps/web/src/components/coach/WelcomeCard.tsx` (Phase 24) — example of a coach-side
  card component matching the design system.
- `packages/coach-sdk/src/schemas/coach-client-link.ts` — schema + `isLinkActive(link)`
  helper (timestamp predicate that Phase 25 must use for the State-C check).
- `apps/web/src/app/[locale]/(marketing)/` route group pattern (Phase 24 GAP) — useful
  if `/redeem` and `/r/[code]` should also live outside the `(coach)` guard.

### Established Patterns

- **Bounded contexts:** `backend/api/src/coach/<module>/{service.ts,db.ts,types.ts}` —
  service.ts is the ONLY public entry; db.ts is module-internal; CI grep already enforces
  no `SERVICE_ROLE` under `coach/`.
- **Per-request JWT:** `createUserClient(jwt)` factory using
  `SUPABASE_PUBLISHABLE_KEY`. Never use service-role on athlete/coach routes.
- **Auth middleware:** `authMiddleware` (Hono) sets `c.get('auth') = { userId, email }`.
  Every Phase 25 route uses it.
- **Server Component data fetching:** all `(coach)` pages are `force-dynamic`,
  `revalidate = 0`, `cache: 'no-store'`. No exceptions.
- **i18n:** `next-intl` namespaces on web, `useTranslation()` on mobile (not used in
  Phase 25 due to D-01).
- **Design system tokens:** Background `#F7F6F3`, Surface `#FFFFFF`, Primary `#FF5C1A`,
  Text `#1C1A17`, Muted `#6B6963`, Border `#E2E0DA`. Light sport theme, no dark mode.

### Integration Points

- **Sidebar nav** (`apps/web/src/components/coach/CoachSidebar.tsx`) — Phase 24 ships
  "Invitations (Bientôt)". Phase 25 flips the disabled flag.
- **`/fr/login` safeNext allowlist** — Phase 24 D-04. Phase 25 extends to `/r/*` +
  `/redeem`.
- **Hono router root** (`backend/api/src/index.ts` or `app.ts`) — mounts modules. Phase
  25 adds `app.route('/coach/invitations', invitationsRouter)` +
  `app.route('/coach/clients', clientsRouter)`.
- **`packages/coach-sdk/src/schemas/index.ts`** — barrel export. Phase 25 adds
  `CoachInvitationSchema` + `CoachLinkPreviewSchema`.

</code_context>

<specifics>
## Specific Ideas

- Share-URL shape: `https://ziko-app.com/r/{code}` (no `?code=` param).
- Generated-code visual: large `tabular-nums` mono font, copyable, with secondary
  copyable share-URL beneath.
- Typed-confirmation modal copy: "Tapez COACH pour confirmer" (case-sensitive).
- Coach preview KYC badge: "Vérifié" (green) / "En attente" (grey) / hidden if NULL.
- Expiration chips: 7j / **14j (défaut)** / 30j / Sans expiration.
- Filter chips on invitations table: "Actives" (default) / "Toutes".
- Athlete revoke CTA copy: "Retirer ce coach". Coach revoke CTA copy: "Révoquer".

</specifics>

<deferred>
## Deferred Ideas

### v1.6 SEED — Mobile "Mon coach" plugin (FULL)

**Trigger to promote:** v1.5 milestone marked complete OR Phase 25 web loop ships.

**Contract:**

- **Plugin id:** TBD when seed is reviewed for promotion (options surfaced: `coach`,
  `mon-coach`, `coach-link`).
- **Pre-installed + non-uninstallable** for all `role='client' | 'both'` users. Plugin
  registry / `user_plugins` table must support a `mandatory: BOOLEAN` flag — research
  whether the existing `is_enabled` column can be repurposed or a new column is needed.
- **Always visible** in the bottom tab bar (`showInTabBar: true`).
- **Route:** `/(plugins)/coach/index.tsx` (or chosen id) — single state-aware screen
  mirroring the web `/redeem` state machine (no-code / preview / linked).
- **Code entry:** single `<TextInput maxLength={6}>` with auto-uppercase + charset filter
  `[A-Z2-9]`. Paste support. Submit enabled at 6 valid chars.
- **Coach preview:** photo + display_name + specialties chips + bio (~200 char truncate
  + "Voir plus") + KYC badge. CTA "Lier mon compte" (orange `#FF5C1A`).
- **Revoke from settings:** new "Mon coach" section in mobile settings with typed-confirmation
  modal ("Tapez COACH").
- **Reuses backend:** `/coach/clients/links/*` routes shipped in Phase 25 — zero new
  backend work for the seed.
- **Design contract baked in:** Phase 25's `/gsd-ui-phase 25` step (D-03) must produce
  the Claude Design / Figma prompt for THIS plugin too, so the v1.6 seed inherits a
  ready-to-execute design spec.

### v1.6 BACKLOG — Retroactive UI design for Phases shipped without `/gsd-ui-phase`

- Phase 24 surfaces shipped without a UI-SPEC.md step:
  - `/coach/onboarding` 3-step wizard
  - `/coach/dashboard` welcome card + sidebar
  - `/coach/settings` profile + KYC sections
  - `/fr/login` form
- Earlier mobile UI surfaces (Phases 1–21) that did not go through a design-first step —
  scope TBD; audit during v1.6 planning.
- Action: open a v1.6 phase "UI Design Catch-Up" that produces a Figma file +
  retroactive UI-SPEC.md for each shipped surface; design QA pass + rework where needed.

### v1.6 CONFIG — Make UI-design-first automatic

- Verify `.planning/config.json` `workflow.ui_phase: true` + `workflow.ui_safety_gate: true`
  actually block `/gsd-plan-phase {N}` when ROADMAP says `UI hint: yes` AND no
  `{N}-UI-SPEC.md` exists. If not enforced, harden in GSD workflow files (likely
  `plan-phase.md` precondition check).
- Manual workaround until verified: every `/gsd-next` for a phase with "UI hint: yes"
  routes to `/gsd-ui-phase {N}` before `/gsd-plan-phase {N}`.

### Future-phase ideas mentioned during discussion (not Phase 25 scope)

- Bulk invitation generation (pre-fill emails, batch CSV) — Phase 26+ or v1.6
- Coach analytics dashboard (codes generated / redeemed / conversion) — v1.6+
- QR code generation for in-person sharing — v1.6+ (requires QR library)
- Coach revoking an *active link* (not just a code) from the dashboard — Phase 26 SC5
- Audit log column on `coach_client_links` (who-revoked-what-when) — Phase 26 or post-v1.5
- Reviewed Todos (not folded): none — no pending todos matched Phase 25 scope.

</deferred>

---

*Phase: 25-invitations-mobile-mon-coach-minimal*
*Context gathered: 2026-05-17*
