# Phase 03: Coach Form Builder (Web) — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The coach can build and manage conditional forms entirely from the web CRM. This phase delivers:
- A top-level "Formulaires" CRM section with a form list and builder
- Form builder with title, questions (4 types), and trigger configuration
- Question reorder (↑↓ buttons) and delete
- Publish modal to target one client or all
- Read-only view + archive action for active forms

All DB tables and Hono API routes already exist (Phase 01). This phase is purely web UI.

</domain>

<decisions>
## Implementation Decisions

### CRM Navigation
- **D-01:** "Formulaires" is a **top-level section** in the coach CRM sidebar, alongside Programmes, Clients, etc.
- **D-02:** Routes follow the existing programs pattern:
  - `/coach/forms` — form list page
  - `/coach/forms/new` — builder for new forms
  - `/coach/forms/[id]` — builder for editing existing forms
- **D-03:** Each form row in the list shows: **title + status badge + trigger type**. No sent-count (avoids extra join).

### Question Editor UX
- **D-04:** Questions are displayed as **stacked cards**. Each card shows its type chip (Texte libre / Échelle 1-10 / Oui/Non / Choix unique), label text, and ↑↓⋯ action row.
- **D-05:** Clicking a card expands it **inline** with a type dropdown + label text field. Save/Cancel buttons confirm or discard the edit.
- **D-06:** For **"Choix unique"** questions, the expanded editor shows a dynamic list of text inputs (one per choice), a "+" button to add rows, and a trash icon to remove rows. Minimum 2 choices enforced.
- **D-07:** A "+ Ajouter une question" button appears at the bottom of the question list to add a new (blank) card.

### Reorder Mechanic
- **D-08:** Reordering uses **↑↓ arrow buttons** on each card. No drag-and-drop library — zero new dependencies.

### Trigger Configuration
- **D-09:** Trigger config lives in a **"Déclencheur" section below the question list** on the same builder page (not a separate tab). Single scrollable page: Title → Questions → Déclencheur → Publication.
- **D-10:** Trigger type is a dropdown (Premier contact / Après N séances / Date fixe / Envoi manuel). **Conditional inline fields** appear based on selection:
  - "Après N séances" → number input for N
  - "Date fixe" → date picker
  - "Premier contact" / "Envoi manuel" → no additional field

### Publish Flow
- **D-11:** Coach clicks **"Publier"** at the bottom of the builder. A **modal opens** with two options: "Un client" (with a client search/select) or "Tous mes clients". Confirming publishes and sets status → `active`.
- **D-12:** Once a form is **active (published)**, the builder shows it as **read-only**. The only action available is **"Archiver"** (status → archived). No editing of active forms — prevents confusion with in-flight instances.
- **D-13:** Draft forms show both "Sauvegarder" (saves as draft) and "Publier" buttons.

### Claude's Discretion
- Visual styling of status badges (draft / active / archived) — standard color convention (grey / green / red) or any approach that's clear.
- Client search implementation in the publish modal — typeahead against the coach's linked clients.
- Auto-save behavior for drafts (optional).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workstream Requirements & Roadmap
- `.planning/workstreams/formulaire-condi/REQUIREMENTS.md` — All 17 requirements; Phase 03 covers FORM-01 through FORM-06
- `.planning/workstreams/formulaire-condi/ROADMAP.md` — Phase 03 goal, success criteria, and UI hint

### Existing Web App Structure
- `apps/web/src/app/[locale]/(coach)/coach/programs/new/page.tsx` — Pattern for new-item creation page (server wrapper → client component)
- `apps/web/src/app/[locale]/(coach)/coach/programs/[id]/ProgramEditorClient.tsx` — Pattern for client-side editor component
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — Tab strip layout pattern (ClientDetailHeader + ClientTabStrip)
- `apps/web/src/components/coach/ClientTabStrip.tsx` — Tab navigation component (will need "Formulaires" tab added in Phase 05)

### Backend API (Phase 01 — already implemented)
- `backend/api/src/routes/forms.ts` — All 6 Hono routes: `GET /forms/coach/forms`, `POST /forms/coach/forms`, `PATCH /forms/coach/forms/:id`, `POST /forms/coach/forms/:id/publish`, `POST /forms/coach/forms/:id/send`

### DB Schema (Phase 01 — already implemented)
- `supabase/migrations/` (migration 054 or nearby) — `coach_forms` table: `id`, `coach_id`, `title`, `questions JSONB`, `trigger_config JSONB`, `status` (draft/active/archived)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`createClientSupabase()`** (`apps/web/src/lib/supabase/client.ts`) — Client-side Supabase for auth token retrieval; used to call Hono API with Bearer token (same pattern as programs)
- **`getCachedCoachUser()`** (`apps/web/src/lib/coach/auth.ts`) — Server-side coach auth guard; used in layout and server pages
- **`QueryProvider`** (`apps/web/src/components/coach/QueryProvider.tsx`) — Wraps client components needing TanStack Query
- **Existing modal pattern** — Check `apps/web/src/components/coach/` for any existing dialog/modal component to reuse for the publish modal

### Established Patterns
- **Server page + Client component split**: All builder pages follow `page.tsx` (server, auth guard, data fetch) → `*Client.tsx` (client, interactive state). Phase 03 builder must follow the same pattern.
- **API calls via fetch + Bearer token**: No direct Supabase from client pages; always call Hono API with the session token (see programs pattern).
- **`[locale]` routing**: All pages live under `app/[locale]/(coach)/coach/`. The locale param must be extracted via `useParams()` or passed down for navigation.
- **No drag-and-drop library**: dnd-kit is NOT in the project. Reorder uses ↑↓ buttons only.

### Integration Points
- **Sidebar navigation**: The coach CRM sidebar (find the sidebar component) needs a new "Formulaires" entry pointing to `/coach/forms`.
- **ClientTabStrip**: Will need a "Formulaires" tab added in **Phase 05** (not this phase — Phase 03 is the standalone builder only).
- **`form_instances` trigger**: Publish calls `POST /forms/coach/forms/:id/publish` which sets status; trigger creation happens via the trigger engine (Phase 02).

</code_context>

<specifics>
## Specific Ideas

- **Builder page layout**: Three labelled sections on one scrollable page — "Questions", "Déclencheur", "Publication". Clean vertical flow.
- **Card actions**: Each question card shows type chip + label + ↑↓ + ⋯ menu (Edit / Delete). Collapsed state is compact; expanded state shows the full inline editor.
- **Publish modal wireframe**:
  ```
  ┏━━ Publier le formulaire ━━┓
  ┃                           ┃
  ┃  ◉ Un client              ┃
  ┃    [ Rechercher...    ]   ┃
  ┃  ◯ Tous mes clients       ┃
  ┃                           ┃
  ┃  [Annuler] [Confirmer]    ┃
  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ```
- **Active form view**: Shows all questions read-only with an "Archiver" button at the bottom. Trigger config visible but not editable.

</specifics>

<deferred>
## Deferred Ideas

- **"Formulaires" tab in client detail sheet** — Adding a tab to `ClientTabStrip` for per-client form view is Phase 05 (Response Viewer), not Phase 03.
- **Manual send from builder** — `POST /forms/coach/forms/:id/send` route exists but Phase 03 only covers publishing. Manual send UI (sending to specific clients post-publish) is considered Phase 05 scope or a follow-on.
- **Form duplication / templates** — Copying an existing form as a starting point. Future phase.
- **Conditional branching** — Question logic based on answers. Explicitly out of scope for v1.14 (per REQUIREMENTS.md).

</deferred>

---

*Phase: 03 — Coach Form Builder (Web)*
*Context gathered: 2026-05-27*
