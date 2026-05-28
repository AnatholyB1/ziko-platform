# Research Summary - v1.15 Custom Widget Dashboards

**Project:** Ziko Coach CRM - Custom Widget Dashboard Builder
**Researched:** 2026-05-25
**Confidence:** HIGH

---

## Executive Summary

This milestone adds a per-athlete customizable dashboard tab to the existing coach CRM. The core mechanic is a split-screen editing mode: the coach types a natural-language instruction, Claude calls a typed tool, and a widget appears in the preview panel in real time. One click saves.

The architecture extends what already exists: one new Supabase table (dashboard_configs), a new bounded context (coach/dashboards/) in Hono, and a new tab in the existing ClientTabStrip. No new routing infrastructure is required because the existing Next.js catch-all proxy already forwards all /coach/* paths.

The recommended approach centers on 7 fixed, closed-set widget types stored as a flat JSONB array. A Zod discriminated union schema keeps Claude output validated and the renderer unambiguous. The single new dependency is react-grid-layout@2.2.1 (only if drag-to-reorder is confirmed in scope); Recharts (already at v3.8.1) handles charting. Initial config loads via Server Component direct Supabase query (Hono bypass); AI-edit SSE stream emits widget_update events that drive live preview.

The primary risk is scope creep: once split-screen preview works for 7 widgets, every stakeholder sees a path to an infinite builder. Prevention is technical - the Zod schema is a hard enum, the dashboard tool registry is isolated from the main coach AI tools, and the system prompt prohibits inventing widget types. The secondary risk is silent AI SDK bugs: forgetting to append response.messages after tool-call steps breaks multi-turn conversation without any visible error.

---

## Stack Additions

| Dependency | Install | Purpose |
|------------|---------|----------|
| react-grid-layout@2.2.1 | npm install react-grid-layout (from apps/web) | Drag-to-reorder grid. Defer if chat-only reorder is sufficient. |
| CSS for grid | Import in dashboard layout file | react-grid-layout/css/styles.css + react-resizable/css/styles.css |

Already in codebase (no new install needed): Recharts v3.8.1, Zod, Vercel AI SDK v6.

---

## Feature Table Stakes

Required for the 30-second criterion. Missing any means the feature does not ship.

| Feature | Why Required |
|---------|-------------|
| Chat to widget in preview in under 5s | The WOW criterion; without live preview it is just a form |
| Named widget with visible title | Coaches scan by label; unlabeled widgets are meaningless |
| At least 2 widget types rendered (chart + KPI tile) | Minimum useful dashboard |
| Persist on explicit Save click | Config must survive page refresh and session change |
| Empty state with concrete action examples | Primes the 30s flow, prevents blank-slate paralysis |
| Delete a widget via chat | No dead-end state |
| Dashboard collapses to full-screen after save | Split-screen is an editing mode, not a permanent sidebar |
| Threshold coloring on KPI tiles | Red/amber/green is a universal coaching signal |

Defer entirely from v1.15: drag-and-drop pixel positioning, color picker UI, undo/redo stack, dashboard versioning, widget resize handles, import/export JSON.

---

## Architecture Decisions

### DB Schema

**Table dashboard_configs** - migration 054 (next after 053_referral_schema.sql)
- (coach_id, client_id) UNIQUE constraint: one dashboard per coach+athlete pair
- widgets JSONB NOT NULL DEFAULT empty array
- RLS: auth.uid() = coach_id (standard Ziko pattern)
- schema_version: 1 in root JSON object - mandatory from day 1

**Table coach_memory** - migration 054 or 055
- preferences JSONB, templates JSONB, per-coach UNIQUE, same RLS pattern

### Widget Types (closed set, hard enum)

sessions_summary | sleep_chart | mood_trend | weight_progression | nutrition_macros | cardio_stats | habits_streak

Encoded as Zod discriminatedUnion. The model cannot hallucinate an 8th type.

### API Routes (Hono - new bounded context coach/dashboards/)

| Method | Route | Description |
|--------|-------|--------------|
| GET | /coach/dashboards/:clientId | Fetch current widgets |
| PUT | /coach/dashboards/:clientId | Save full config (upsert, replaces whole array) |
| POST | /coach/dashboards/:clientId/ai-edit | SSE stream with Claude dashboard tools |
| GET | /coach/dashboards/memory | Fetch coach preferences and templates |
| PUT | /coach/dashboards/memory | Save coach preferences and templates |
| GET | /coach/clients/:clientId/widget-data | Per-widget data fetch (new endpoint in existing clients service) |

Route order critical: /memory must be registered before /:clientId in Hono.

### Claude Tools (isolated in coach/dashboards/tools.ts)

add_widget | update_widget | remove_widget | reorder_widgets | read_dashboard

Never merged into coach/ai/tools.ts. Dashboard editing session uses stopWhen: stepCountIs(2), not the global stepCountIs(5).

### Key Implementation Patterns

- State: pendingWidgets ref holds in-progress AI changes; Save commits; Cancel discards. No auto-save.
- Preview: ONLY updates on part.state === output-available (never from raw streamed text mid-generation)
- Widget data: TanStack Query per widget, staleTime 5min, cache key includes type + period + config
- Initial load: Server Component reads dashboard_configs directly from Supabase (Hono bypass)
- SSE: Adds widget_update event type to existing SSE format
- Credit gate: POST /coach/dashboards/:clientId/ai-edit applies creditCheck(coach_chat)

### Files Modified (existing, touch-minimal)

- backend/api/src/app.ts: +1 line to mount dashboardsRouter
- apps/web/src/components/coach/ClientTabStrip.tsx: add Dashboard entry to TABS array

---

## Watch Out For (ranked by project risk)

**1. Forgetting response.messages after tool-call steps - CRITICAL**
Multi-turn conversation silently breaks. Always append response.messages in onStepFinish regardless of step type. Write a two-turn integration test before marking Phase 3 done.

**2. Scope creep: the 8th widget type - HIGH**
The moment 7-widget preview works, stakeholders ask for an 8th. Zod hard enum rejects unknown types at the schema level. Document the closed set in STATE.md on day 1 of Phase 1.

**3. Using streamText for the config tool call - HIGH**
Streaming partial JSON renders invalid intermediate states. Config tool must be atomic. Preview ONLY updates from part.state === output-available, never from raw streamed text.

**4. Stale closure capturing old widget config in async tool handler - MEDIUM**
Store currentConfig in a useRef, not React state, inside all async tool callbacks.

**5. Missing schema_version in stored configs - MEDIUM**
Add schema_version: 1 to root JSONB from day 1 and write a migrateConfig(rawConfig) normalization function. Retrofitting after production data exists is days of debugging.

---

## Implications for Roadmap

### Suggested Phase Structure (4 phases)

**Phase 1 - DB + API Foundation**
Rationale: Zero ambiguity. Nothing else can build without it.
Delivers: Migration 054, 5 Hono CRUD routes, widget data endpoint, TypeScript types, schema_version baked in.
Research flag: Standard patterns - skip research-phase.

**Phase 2 - Widget Renderers + Static Dashboard**
Rationale: Validates data shapes and component layout independently from AI complexity.
Delivers: DashboardShell, DashboardGrid, 7 widget components, TanStack Query per widget, Dashboard tab, page.tsx + loading.tsx.
Research flag: Standard patterns - skip research-phase.

**Phase 3 - AI Edit Session (chat to live preview to save)**
Rationale: Builds on validated static dashboard. The 30-second criterion lives here. Highest risk.
Delivers: DashboardEditor split-screen, SSE reading widget_update events, 4 Claude tools, buildDashboardEditSystemPrompt, credit gate.
Research flag: No research-phase needed. Use PITFALLS.md red-flag checklist as code-review gate before marking complete.

**Phase 4 - Polish + Coach Memory**
Rationale: Deferred until core flow is validated.
Delivers: coach_memory wired up, template save/apply, previousConfig one-tap undo, concrete opening message, discoverable Customize button.
Research flag: Standard patterns - skip research-phase.

### Phase Ordering Rationale

- Phase 1 before 2: Cannot render widget data without the endpoint returning it.
- Phase 2 before 3: Isolates AI complexity from rendering; validates dataKey shapes early.
- Phase 4 last: Coach memory has zero value until the core edit loop is proven trustworthy.
- react-grid-layout gates Phase 2: if drag reorder confirmed add in Phase 2; else deferred.

---

## Open Questions (RESOLVED — see 01-CONTEXT.md for locked decisions)

1. **Drag-to-reorder in scope for v1.15?** → **RESOLVED (L-09):** Yes, in scope. `react-grid-layout@2.2.1` installed in Phase 02.

2. **Widget layout: array order or integer position field?** → **RESOLVED (L-04):** Array order determines layout; no integer `position` field. `reorder_widgets` tool shuffles the array.

3. **Credit deduction rate for /ai-edit?** → **RESOLVED (L-08, deferred to Phase 03):** Same rate as `coach_chat` for now — no separate `dashboard_edit` credit type.

4. **coach_memory in migration 054 or 055?** → **RESOLVED (L-01):** Both `dashboard_configs` and `coach_memory` in single migration 054.

5. **Default dashboard config for new coaches?** → **RESOLVED (D-03/D-04):** Server-side computed defaults (3–4 widgets) returned by GET when no row exists; lazy persistence — no DB write until first PUT.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Recharts already installed; react-grid-layout v2 TS rewrite verified; AI SDK v6 patterns verified against official docs |
| Features | HIGH | 7 widget types fully specified with field schemas; data keys mapped to source plugins |
| Architecture | HIGH | Direct codebase inspection: coach/ai bounded module, migrations 001-053, Hono app.ts, Next.js proxy route |
| Pitfalls | HIGH | All pitfalls verified against Vercel AI SDK docs, Supabase docs, generative UI production patterns |

**Overall confidence: HIGH**

### Gaps to Address

- Widget position vs. array order: Must resolve before Phase 1 schema is written (Open Question 2).
- react-grid-layout necessity: Defer install decision to Phase 2 planning, pending drag-reorder scope confirmation.
- coach_memory launch shape: preferences and templates JSONB shapes are illustrative; product decision needed before migration is written.

---

*Research completed: 2026-05-25*
*Ready for roadmap: yes*
