# Phase 28: AI File Imports — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Milestone:** v1.5 — Coach Platform & CRM
**Depends on:** Phase 27 (complete)

<domain>
## Phase Boundary

Phase 28 delivers **AI-powered file import** for workout programs: any authenticated user uploads a PDF/image/Excel/Word file, the backend parses it with Claude into a structured `ImportedProgramSchema`, and the user reviews/edits the result before committing as a program.

**Two modes:**
- **Athlete mode** — mobile screen inside `plugins/ai-programs`; commits a `workout_programs` row owned by the athlete
- **Coach template mode** — web at `/coach/imports`; commits a template (`is_template=TRUE`) ready to assign

**In scope (IMPORT-01 through IMPORT-10):**
- File upload via Supabase Storage signed URL (PDF/PNG/JPEG/XLSX/XLS/DOCX, up to 25 MB)
- Async parse pipeline: upload → parse → ready/failed → committed
- Claude haiku parsing with `generateObject` producing `ImportedProgramSchema`
- Preview UI with confidence scores (< 70% → yellow highlight) + deep structural editing
- Credit deduction per-page for PDFs (1/page, max 10), flat 1 credit for other formats
- Re-upload diff with inline +/- coloring vs previous import version
- Coach web section `/coach/imports` with CoachSidebar entry
- Mobile athlete import screen in `plugins/ai-programs` using `expo-document-picker`

**Out of scope:**
- Phase 29: AI coach orchestrator chat tools
- Athlete import on web (athlete flow is mobile-only in Phase 28)
- Sonnet model (Haiku for all parse paths)
- Real-time parse streaming (polling-based async only)

</domain>

<decisions>
## Implementation Decisions

### Credit Pricing (IMPORT-02, ROADMAP AD #3)

- **D-01 — Per-page pricing for PDFs.** 1 credit per page, capped at 10 credits.
  - 1-page PDF = 1 credit; 10-page PDF = 10 credits; 30-page PDF = 10 credits (capped).
  - `page_count` from `ai_imports` table drives the calculation.
  - Credit calculation happens server-side BEFORE parse starts; deducted only on success.
- **D-02 — Flat 1 credit for non-paged formats.** JPEG/PNG/DOCX/XLSX = always 1 credit.
  - Rule: only PDFs incur per-page cost. Simpler to communicate in UI.
- **D-03 — Failed parses do NOT deduct credits.** If Zod validation fails or file is unreadable,
  `ai_imports.status = 'failed'` and `credit_transaction_id` stays null.

### Athlete Entry Point (IMPORT-01, IMPORT-04)

- **D-04 — Mobile only for athletes.** Athlete import lives inside the `plugins/ai-programs`
  plugin — an "Import from file" button on the existing dashboard screen.
- **D-05 — `expo-document-picker` for file selection.** Managed Expo compatible, supports
  PDF/image/Office formats. No native rebuild needed.
- **D-06 — Upload flow on mobile.** `expo-document-picker` → get signed URL from backend →
  upload directly to Supabase Storage → poll `GET /coach/imports/:id` every 2s while parsing.
  Same signed URL pattern established in Phase 14.

### Coach Entry Point (IMPORT-01, IMPORT-04)

- **D-07 — Dedicated `/coach/imports` section on web.** New CoachSidebar entry "Imports".
  - `/coach/imports` — list page with all past imports + status chips (pending/parsing/ready/failed/committed)
  - `/coach/imports/[id]` — parse preview + commit page
- **D-08 — Coach upload UX.** Drag-and-drop zone (web standard) with fallback file picker button.
  Upload via signed URL same as mobile.

### File Parsing Strategy (IMPORT-02, IMPORT-07)

- **D-09 — PDF path: rasterize pages → batch Claude haiku vision.**
  - Node.js library (e.g. `pdf2pic` or `pdfjs-dist` + `canvas`) rasterizes each page to a PNG.
  - All pages sent as base64 image blocks in a single Claude haiku vision call.
  - Handles tables/grids in workout PDFs better than text extraction.
  - Max 30 pages enforced (ROADMAP SC3); `page_count` stored in `ai_imports`.
- **D-10 — Excel path: `xlsx` lib → structured text → Claude haiku text model.**
  - `xlsx` (SheetJS) extracts cell data as JSON/CSV string.
  - Passed as text prompt with `ImportedProgramSchema` output instruction.
  - No vision tokens needed for tabular data.
- **D-11 — Word path: `mammoth.js` → markdown → Claude haiku text model.**
  - `mammoth.js` converts `.docx` to clean markdown.
  - Same text model prompt as Excel path.
- **D-12 — Image path (PNG/JPEG): Claude haiku vision directly.**
  - Single image sent as base64 vision block. 1 credit.
- **D-13 — Model for all paths: `claude-haiku-4-5-20251001`** (from `backend/api/src/config/models.ts`).
  Consistent with v1.4 Haiku migration (COST-01 decision). No Sonnet fallback in Phase 28.
- **D-14 — `generateObject` with `ImportedProgramSchema`.** Zod schema from
  `packages/coach-sdk/src/schemas/imported-program.ts`. Output stored in `ai_imports.parsed_data`.
  Confidence scores stored in `ai_imports.confidence_scores`.

### Preview & Edit UI (IMPORT-03, IMPORT-05, IMPORT-06)

- **D-15 — Deep structural editing in preview.** Users can:
  - Edit any field value (exercise name, sets, reps, RPE, rest, notes)
  - Add/remove exercises within a session
  - Add/remove sessions within a week
  - Add/remove weeks
  Full structural editing before commit. This is the ROADMAP SC3 scope.
- **D-16 — Confidence highlighting.** Fields with `confidence < 0.70` shown with yellow
  background. `overall_confidence` shown as a banner. Users can clear highlights by editing.
- **D-17 — Re-upload diff: inline +/- coloring.**
  - New rows: green background
  - Removed rows: red + strikethrough
  - Changed values: strikethrough old value + new value inline
  - Computed client-side by diffing `re_upload_source_id`'s `parsed_data` vs new `parsed_data`.
- **D-18 — Commit behavior.**
  - Athlete mode: creates `workout_programs` row (`is_template=FALSE`, `assigned_to_user_id = null`,
    `created_by_coach_id = null`). Program appears in athlete's ai-programs screen.
  - Coach template mode: creates `workout_programs` row (`is_template=TRUE`,
    `created_by_coach_id = auth.uid()`). Appears in `/coach/programs` template list.
  - `ai_imports.committed_program_id` set on commit; status → `committed`.

### Backend Route (IMPORT-05, IMPORT-06)

- **D-19 — New bounded module `backend/api/src/coach/imports/`.** Pattern: `service.ts` public
  entry, `db.ts` internal, `types.ts` internal. Routes mounted at `/coach/imports`.
  - `POST /coach/imports` — create import record + get signed upload URL
  - `PUT /coach/imports/:id/status` — update to `uploaded` once client upload completes
  - `POST /coach/imports/:id/parse` — trigger async parse (returns 202, `maxDuration = 60`)
  - `GET /coach/imports/:id` — poll status + parsed_data
  - `PUT /coach/imports/:id/commit` — commit parsed + edited program
  - `GET /coach/imports` — list user's imports
- **D-20 — Route accessible by both athletes and coaches.** Despite the `coach/imports` path,
  athletes reach it too (with their JWT). RLS on `ai_imports` is owner-only (`auth.uid() = user_id`).
  The `mode` field controls what kind of program gets committed.
- **D-21 — Supabase Storage bucket for imports.** New bucket `ai-imports` (private).
  Signed URL upload pattern from Phase 14. Path: `{user_id}/{import_id}/{original_filename}`.

### Claude's Discretion

- Exact UI component structure for the preview editor (accordion vs flat list for weeks/sessions)
- Mobile poll UI (spinner states, skeleton loader vs progress bar during parse)
- Error message copy for specific parse failures
- Whether the coach imports list shows a preview thumbnail of the file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema (already shipped)
- `supabase/migrations/036_workout_programs_ai_imports.sql` — `ai_imports` table (16 columns,
  statuses, MIME CHECK, RLS). Phase 28 does NOT re-create this table — only adds the storage
  bucket and wires `credit_transaction_id` FK.
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of()` function
  (not used by ai_imports, but referenced for RLS pattern consistency)

### Zod Schemas
- `packages/coach-sdk/src/schemas/imported-program.ts` — `ImportedProgramSchema` (the exact
  Zod shape Claude must produce; `ExerciseSchema` has per-field `confidence` field)
- `packages/coach-sdk/src/schemas/program-week.ts`, `program-session.ts`, `program-exercise.ts`
  — Phase 27 schemas; `ImportedProgramSchema` must stay compatible for commit-to-programs

### Upload Pattern (Phase 14)
- `.planning/phases/14-supabase-storage/14-CONTEXT.md` — D-03 (signed URL upload flow,
  bypasses Vercel 4.5 MB limit), D-04 (private bucket pattern), D-05 (storage path convention)
- `backend/api/src/routes/storage.ts` — existing signed URL route to reference

### Credit System (Phase 17/18)
- `.planning/phases/18-credit-service-middleware/18-CONTEXT.md` — `creditCheck` / `creditDeduct`
  middleware pattern; `deduct_ai_credits` SECURITY DEFINER RPC
- `backend/api/src/middleware/credit.ts` — existing middleware (Phase 28 extends with variable cost)

### Model Config
- `backend/api/src/config/models.ts` — centralized model constants; Phase 28 uses
  `claude-haiku-4-5-20251001` for all parse paths

### Web Architecture (Phase 23)
- `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md` — D-15
  (`force-dynamic` + `revalidate=0` + `cache:'no-store'` mandatory), D-11 (ESLint ban)
- `apps/web/src/lib/supabase/server.ts` — `createServerSupabase()` factory

### Bounded Module Pattern (Phase 24)
- `.planning/phases/24-coach-identity-onboarding/24-CONTEXT.md` — D-08 (service.ts public
  entry, db.ts internal, types.ts internal)
- `backend/api/src/coach/identity/service.ts` — reference shape

### Coach Web Layout
- `apps/web/src/components/coach/CoachSidebar.tsx` — add "Imports" nav entry (disabled: false)
- `apps/web/src/app/[locale]/(coach)/coach/dashboard/page.tsx` — Server Component pattern clone

### Mobile (Athlete)
- `plugins/ai-programs/src/` — athlete import screen added here
- `apps/mobile/app/(app)/(plugins)/ai-programs/` — thin route wrapper needed for new import screen
- CLAUDE.md §Plugin System Conventions — manifest route pattern, `showInTabBar`, Ionicons names

### Project
- `.planning/ROADMAP.md` §Phase 28 — 5 success criteria, Plans TBD
- `.planning/PROJECT.md` — bounded-contexts architecture, v1.5 key decisions log

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/api/src/routes/storage.ts` — signed URL generation; clone for `ai-imports` bucket
- `backend/api/src/middleware/credit.ts` — `creditCheck` / `creditDeduct`; extend with
  variable cost parameter (D-01/D-02 per-page calculation happens before deduction)
- `apps/web/src/components/coach/CoachSidebar.tsx` — add "Imports" entry
- `apps/web/src/components/coach/RevokeConfirmModal.tsx` — modal pattern reference
- `apps/web/src/app/[locale]/(coach)/coach/programs/ProgramsClient.tsx` — client component
  pattern with API calls; reference for the preview editor client component
- `plugins/ai-programs/src/screens/` — existing ai-programs screens; add import screen here

### Established Patterns
- **Signed URL upload:** client gets URL from backend → uploads directly to Supabase Storage →
  notifies backend of completion. Never through Vercel (4.5 MB limit).
- **Async polling:** client polls `GET /coach/imports/:id` every 2s; backend updates status
  as parse progresses. `maxDuration = 60` on parse route (Phase 23 D-15).
- **`generateObject`:** Vercel AI SDK v6 pattern used in Phase 7 (recipe suggestions) —
  researcher should check `backend/api/src/tools/` for prior `generateObject` usage.
- **Bounded module:** `backend/api/src/coach/{module}/{service,db,types}.ts`.
- **Credit deduction:** server-side only, SECURITY DEFINER RPC `deduct_ai_credits`.

### Integration Points
- **New migration ~048:** wire `credit_transaction_id` FK on `ai_imports` to
  `ai_credit_transactions(id)`. Migration 036 left this as a comment (`-- FK wired in Phase 28`).
- **New Supabase Storage bucket:** `ai-imports` (private). Update lifecycle cron (Phase 15)
  to clean up orphaned import files (suggested: delete files for `status = failed` after 7 days).
- **`plugins/ai-programs/src/manifest.ts`:** add import route + `showInTabBar: false` (modal/sheet
  flow, not a tab). Researcher should verify current manifest shape.
- **CoachSidebar:** flip `disabled: false` on new "Imports" entry — same pattern as Phase 26
  ("Clients") and Phase 27 ("Programmes").

</code_context>

<specifics>
## Specific Ideas

- Credit tiers shown in UI before upload: "1–5 pages: 1 credit · 6–10 pages: X credits" (derived
  from D-01 per-page formula). User must see cost before committing to parse.
- Confidence badge on import list: color-coded chip (green ≥ 0.8, orange 0.5–0.8, red < 0.5).
- Re-upload diff triggered when user uploads a new file from the `/coach/imports/[id]` page
  (same import record, `re_upload_source_id` points to prior import).
- Mobile parse polling UX: show animated progress bar during `parsing` status; show error card
  on `failed` with "Try again" button (re-triggers parse, no new upload needed if file is good).

</specifics>

<deferred>
## Deferred Ideas

- **Athlete import on web** — athlete flow is mobile-only in Phase 28. Web-based athlete import
  (e.g. `/import` public route) deferred to v1.6.
- **Sonnet fallback on low confidence** — auto-retry with claude-sonnet when `overall_confidence < 0.5`.
  Cost unpredictability deferred; Haiku-only in Phase 28.
- **Lifecycle cron for ai-imports bucket** — cleaning up failed/orphaned import files is a
  Phase 15 extension; researcher should flag for Phase 28 plan or a follow-up task.
- **Google Sheets import** — explicitly deferred in PROJECT.md (v1.5 deferrals).
- **Garmin `.fit` file import** — explicitly deferred in PROJECT.md (v1.5 deferrals).

</deferred>

---

*Phase: 28-ai-file-imports*
*Context gathered: 2026-05-21*
