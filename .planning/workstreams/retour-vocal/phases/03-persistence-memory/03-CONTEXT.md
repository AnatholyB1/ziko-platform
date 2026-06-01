# Phase 03: Persistence & Memory - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect the fake save from Phase 02 to a real DB table (`coach_vocal_feedbacks`), persist the structured card + transcript when the coach presses [Sauvegarder], inject the N=3 most recent feedbacks for that athlete into future Claude structuring calls, and render a scrollable history list below the idle panel in the existing "Retour vocal" tab.

Phase begins when [Sauvegarder] is pressed (Phase 02 `card-saving` state) and ends when:
1. Feedback is persisted in DB
2. Next `/structure` call picks up real history
3. Coach can browse past feedbacks inline in the same tab

No new client-sheet tab. No athlete-facing access. No PDF export. No sharing.

</domain>

<decisions>
## Implementation Decisions

### Save Endpoint

- **D-01:** New route `POST /coach/voice/save` — separate from `/structure`. Clean separation: `/structure` returns the card, `/save` persists it. Only called when coach explicitly presses [Sauvegarder], not on every structuring call.
- **D-02:** Payload: `{ athlete_id, transcript, card }` (card is the full `StructuredCard` JSON including tags). Returns `{ id }` of the new row.

### DB Schema — `coach_vocal_feedbacks`

- **D-03:** Table stores: `id` (uuid PK), `coach_id` (uuid FK → auth.users), `athlete_id` (uuid FK → auth.users), `transcript` (text), `card` (jsonb), `created_at` (timestamptz default now()). No separate tags column — tags live inside `card.tags`.
- **D-04:** RLS — coach-only read/write. Policy: `auth.uid() = coach_id`. Athlete never sees this table. Consistent with `coach_client_notes` which is also coach-private.

### Memory Injection (MEM-02)

- **D-05:** N = **3** prior feedbacks injected into Claude context. Fetched from `coach_vocal_feedbacks` where `coach_id = auth.uid()` AND `athlete_id = ?`, ordered by `created_at DESC`, limit 3.
- **D-06:** Format in the Claude prompt: compact JSON summary matching the existing placeholder in `buildStructuringPrompt`. Each entry: `"YYYY-MM-DD: {context: '...', strengths: '...', corrections: '...', next_steps: '...', tags: [...]}"`. Slots directly into `vocal_history` array in `athleteContext` (currently `[]` at line 248 of `service.ts`).

### History View (MEM-03)

- **D-07:** History appears **below** the `VocalRetourPanel` in the same "Retour vocal" tab — not a new sub-tab. Section header: "Feedbacks précédents". Shown only when at least 1 saved feedback exists; otherwise hidden (no empty state needed — idle state already covers new-user experience).
- **D-08:** Each history row shows: date (formatted `DD MMM YYYY`), tag chips (read-only, same `TagChip` component from Phase 02), and first ~100 chars of `card.context` as preview text.
- **D-09:** Click on a row → inline expand showing the full 5-section card in read-only mode. Same `CardSection` component from Phase 02, no edit affordance. Click again to collapse. Only one row expanded at a time.
- **D-10:** History list is fetched client-side on page load (or on `card-saved` → idle reset), sorted by `created_at DESC`. Pagination not needed for v1.9 — load all records (coaches typically have <50 feedbacks per athlete).

### Claude's Discretion

- Exact heading style for "Feedbacks précédents" section (divider line, font size, margin)
- Loading skeleton for history list while fetching
- Collapse animation for inline-expanded card rows

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Contexts
- `.planning/workstreams/retour-vocal/phases/01-transcription-pipeline/01-CONTEXT.md` — Entry point, tab structure, machine états, route pattern
- `.planning/workstreams/retour-vocal/phases/02-claude-structuring/02-UI-SPEC.md` — Full design spec for `card-saving` / `card-saved` states, `StructuredCard` type, component tree, GSAP animations

### Backend — Existing Voice Module
- `backend/api/src/coach/voice/service.ts` — Add `POST /voice/save` to `voiceRouter`. Line 248: `vocal_history: []` placeholder to populate with real DB data.
- `backend/api/src/coach/clients/db.ts` — `createUserClient(jwt)` pattern used throughout coach backend

### DB Patterns
- `supabase/migrations/` — Latest migration is `20260527_coach_exercise_id_program_exercises.sql`. New migration file for `coach_vocal_feedbacks` table + RLS must follow the same naming convention.
- `.planning/workstreams/retour-vocal/REQUIREMENTS.md` — MEM-01, MEM-02, MEM-03 requirements with acceptance criteria

### Roadmap & Success Criteria
- `.planning/workstreams/retour-vocal/ROADMAP.md` — Phase 03 success criteria (3 items)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/coach/vocal/TagChip.tsx` — Already built in Phase 02. Reuse directly in history row (read-only mode — no toggle needed, just `isSelected` display).
- `apps/web/src/components/coach/vocal/CardSection.tsx` — Already built in Phase 02. Reuse in the inline-expanded history card (read-only only — no `onClick` to enter edit mode).
- `apps/web/src/components/coach/vocal/FeedbackCard.tsx` — Full card component. Reuse inside the expanded history row.
- `backend/api/src/coach/voice/service.ts` → `voiceRouter` — Add `/save` route here. `buildStructuringPrompt` at line 133 already accepts `vocal_history: any[]` — just populate it from DB instead of empty array.

### Established Patterns
- Coach module pattern: `coach/{feature}/service.ts` exports Hono router mounted in `app.ts`. `voiceRouter` already exists — just add a new `.post('/save', ...)` handler.
- Supabase RLS pattern: `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + `CREATE POLICY … USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id)`. Same as every other coach table.
- Client-side DB fetch: `createBrowserClient` pattern used across Next.js coach pages (existing pattern in `apps/web/src/`).

### Integration Points
- `backend/api/src/coach/voice/service.ts` line 248 — `vocal_history: []` → replace with real DB query for last 3 feedbacks
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/vocal/page.tsx` — Add history list below `VocalRetourPanel`
- `apps/web/src/components/coach/vocal/VocalCardReady.tsx` — The [Sauvegarder] button currently calls a stub; wire it to `POST /coach/voice/save`

</code_context>

<specifics>
## Specific Ideas

- History mockup agreed during discussion:
  ```
  [ Nouveau retour ]   (idle state)

  ─── Feedbacks précédents ───

    2026-05-27  [force] [technique]
    Contexte: Joaquim a bien travaillé...
    ▾ Voir le détail

    2026-05-20  [mental]
    Contexte: Séance difficile...
    ▾ Voir le détail
  ```
- Inline expand on click — one row at a time, collapse on second click
- History rows use the same design tokens as Phase 02 (border `#E2E0DA`, bg `#FFFFFF`, section labels `#6B6963`)

</specifics>

<deferred>
## Deferred Ideas

- Sharing vocal feedback with athlete (email / push) — explicitly in REQUIREMENTS.md §Deferred (post-v1.9)
- PDF export — explicitly in REQUIREMENTS.md §Deferred (post-v1.9)
- Monthly synthesis per athlete — post-v1.9
- Editing a saved feedback after the fact — not in scope for v1.9
- Pagination or infinite scroll in history — not needed at current data scale

</deferred>

---

*Phase: 03-Persistence Memory*
*Context gathered: 2026-05-27*
