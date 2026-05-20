---
phase: 31
slug: ai-tools-coach
workstream: milestone-mobile
status: ready-for-planning
created: 2026-05-20
context_updated: 2026-05-20
depends_on:
  - Phase 29 (Plugin "Mon coach" — Full Implementation) ✓
requirements:
  - COACH-15
---

# Phase 31: AI Tools — coach_get_link + coach_revoke_link — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add two AI tools — `coach_get_link` and `coach_revoke_link` — to the backend tool registry so the Claude orchestrator can check and revoke an athlete's coach link on their behalf. This phase also updates the coach plugin manifest to declare these tools and adds an `aiSystemPromptAddition` hint.

**No new backend routes.** All HTTP calls reuse existing Phase 25 routes:
- `GET /coach/clients/links/me` (via `getActiveLink` in `backend/api/src/coach/clients/db.ts`)
- `DELETE /coach/clients/links/:id` (via `revokeLink`)

**Not in scope:** AI-initiated re-linking, coach-side AI tools, real-time link state push.

</domain>

<decisions>
## Implementation Decisions

### coach_revoke_link — Safety Gate (D-01 through D-04)

- **D-01:** `coach_revoke_link` requires a `confirmed: boolean` parameter. If `confirmed` is missing or `false`, the tool returns `{ ok: false, error: 'confirmation_required', message: 'Call again with confirmed: true after the user explicitly agrees to unlink their coach.' }` — no deletion occurs.
- **D-02:** When `confirmed: true`, the tool executes `DELETE /coach/clients/links/:id` directly (no further guard).
- **D-03:** `coach_revoke_link` takes **no link_id parameter** — it is self-contained. Internally it calls `GET /coach/clients/links/me` to fetch the active link UUID, then executes the DELETE. There is only ever one active link per athlete.
- **D-04:** Tool parameters: `{ confirmed: boolean }` where `confirmed` is required. JSON Schema: `{ type: 'object', properties: { confirmed: { type: 'boolean', description: 'Must be true — set only after the user has explicitly agreed to unlink their coach' } }, required: ['confirmed'] }`.

### coach_get_link — Return Data (D-05 through D-07)

- **D-05:** When a coach is linked, `coach_get_link` returns the **structured** shape:
  ```
  {
    linked: true,
    link_id: string,       // UUID of coach_client_links row
    coach_name: string,    // display_name from coach_profiles
    linked_at: string,     // ISO timestamp (created_at)
    kyc_verified: boolean, // kyc_status === 'approved'
    bio: string | null,
    specialties: string[]
  }
  ```
  This lets the orchestrator answer "Who is my coach?", "Is my coach verified?", "What are my coach's specialties?" without an additional tool call. `photo_url` is excluded — signed URLs expire in 5 min and are not useful for text-based AI responses.

- **D-06:** When no coach is linked (State A), `coach_get_link` returns:
  ```
  {
    linked: false,
    message: 'No coach is currently linked. Enter a 6-character invitation code in the Mon coach plugin to connect.'
  }
  ```
  The message gives the orchestrator useful prose for its reply without requiring it to compose the instruction from scratch.

- **D-07:** `coach_get_link` takes **no parameters**. JSON Schema: `{ type: 'object', properties: {} }`.

### System Prompt Hint (D-08 through D-09)

- **D-08:** The coach manifest declares a **single static `aiSystemPromptAddition`** string injected whenever the plugin is installed:
  `'User has a Mon coach plugin installed. Use coach_get_link to check their current coach link status. To unlink their coach, use coach_revoke_link with { confirmed: true } — but only after the user explicitly agrees.'`

- **D-09:** The hint is static (not conditional on link state). The orchestrator calls `coach_get_link` to discover state dynamically. No runtime branching needed in the manifest or `fetchUserContext()`.

### Claude's Discretion

- New tool implementation file: `backend/api/src/tools/coach.ts` — follows the same pattern as `habits.ts`, `sleep.ts`, etc. (exported named functions, Supabase user client via JWT).
- The manifest `aiTools` array shape: populate with `AITool` objects matching the backend schema (same `name`, `description`, `parameters`). The mobile SDK can surface these to the plugin catalog even though backend registry is the source of truth for execution.
- Tool function signatures follow the `ToolExecutor.execute` contract: `(params, userId, userToken) => Promise<unknown>` — `userToken` (JWT) is needed for both `getActiveLink` and `revokeLink` calls.
- `aiSkills` in the manifest can remain `[]` for Phase 31 — the `aiSystemPromptAddition` and tool list are sufficient for orchestrator discovery without explicit keyword triggers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Tool Registry Pattern
- `backend/api/src/tools/registry.ts` — Source of truth for all AI tool schemas and executor map. **New coach tool schemas and executor entries go here.** Read the full file to match the established pattern.
- `backend/api/src/tools/habits.ts` — Gold standard for a tool implementation file (exported named functions, user client pattern, error handling).

### Backend — Coach Routes (Phase 25, no changes needed)
- `backend/api/src/coach/clients/service.ts` — `GET /links/me` and `DELETE /links/:id` routes. No changes in Phase 31 — tool calls these routes internally.
- `backend/api/src/coach/clients/db.ts` — `getActiveLink(jwt, clientId)` and `revokeLink(jwt, userId, id)` functions. **Tool implementation calls these directly** (not via HTTP — same process). Confirm function signatures before implementing.

### Plugin Manifest
- `plugins/coach/src/manifest.ts` — Currently `aiTools: [], aiSkills: [], aiSystemPromptAddition: undefined`. Phase 31 populates `aiTools` and adds `aiSystemPromptAddition`.
- `plugins/habits/src/manifest.ts` — Gold standard for manifest with aiTools + aiSystemPromptAddition populated.

### Requirements
- `.planning/workstreams/milestone-mobile/REQUIREMENTS.md` — COACH-15 (the one requirement for this phase).
- `.planning/workstreams/milestone-mobile/ROADMAP.md` — Phase 31 success criteria (3 items: manifest declares tools + appear in GET /ai/tools + AI triggers work end-to-end).

### App Registration
- `backend/api/src/app.ts` — Confirms coach routes are already mounted at `/coach/clients`. No route changes needed.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getActiveLink(jwt, clientId)` in `backend/api/src/coach/clients/db.ts` — Returns `{ link: LinkRow | null, preview: CoachPreviewPayload | null }`. Use this to get `link.id`, `link.created_at`, and `preview.display_name`, `preview.bio`, `preview.specialties`, `preview.kyc_status` for `coach_get_link`.
- `revokeLink(jwt, userId, id)` in `backend/api/src/coach/clients/db.ts` — Revokes link by UUID. Used by `coach_revoke_link` after fetching the link ID from `getActiveLink`.
- `createUserClient(jwt)` in `backend/api/src/coach/clients/db.ts` — Exported helper. Tool functions use this pattern to create a scoped Supabase client.
- `ToolExecutor` interface in `backend/api/src/tools/registry.ts` — Defines `execute: (params, userId, userToken?) => Promise<unknown>`. Coach tools need `userToken` for JWT-authenticated Supabase calls.

### Established Patterns
- All tool implementations: exported named functions, accept `(params, userId, userToken?)`, return plain objects (not HTTP responses).
- Registry: tool schemas defined inline as `const coachToolSchemas: AITool[]`; executor entries added to the `executors` map; schemas spread into `allToolSchemas`.
- `nutrition_delete_entry` description pattern: "Ask for confirmation first" — **coach_revoke_link diverges from this** by requiring `confirmed: true` as a hard parameter (D-01).

### Integration Points
- `backend/api/src/tools/registry.ts` lines 1-13 (imports) + line 132 (executors map) + line 548 (allToolSchemas spread) — Three insertion points for coach tools.
- `plugins/coach/src/manifest.ts` — `aiTools: []` → populate; `aiSystemPromptAddition` → add string (D-08).
- `backend/api/src/app.ts` — **No changes needed.** Coach routes already mounted.

</code_context>

<specifics>
## Specific Ideas

- **`confirmed: true` gate wording:** Tool description should say "IMPORTANT: Always ask the user for explicit confirmation before calling this tool with confirmed: true. This action is irreversible." — mimics the pattern other tools use in description text but adds the schema-level guard.
- **`coach_get_link` `kyc_verified` field:** Map from `preview.kyc_status === 'approved'` → `boolean`. Don't expose the raw `kyc_status` string — it's an internal value.
- **`coach_revoke_link` when no link exists:** If `getActiveLink` returns `{ link: null }`, return `{ ok: false, error: 'no_active_link', message: 'No coach is currently linked.' }` — graceful, no crash.

</specifics>

<deferred>
## Deferred Ideas

- **aiSkills trigger keywords** (`coach_info`, `coach_revoke`) — COACH-15 only requires aiTools; keyword-based context injection can be added in a future enhancement phase.
- **Real-time link state push** — If a coach revokes from the web while the athlete app is open, the AI might have stale data until the next `coach_get_link` call. TanStack Query refetch-on-focus handles the mobile screen; AI tool staleness is acceptable for Phase 31.
- **Coach-initiated messaging tools** — Deferred to a future milestone (MOBILE-06 area).

</deferred>

---

*Phase: 31-ai-tools-coach*
*Context gathered: 2026-05-20*
