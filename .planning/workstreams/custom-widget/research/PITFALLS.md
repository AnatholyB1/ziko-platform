# Pitfalls: Chat-Driven Widget Dashboard (v1.15)

**Domain:** Chat-driven dashboard customization added to existing B2B coach CRM
**Researched:** 2026-05-25
**Confidence:** HIGH (verified against Vercel AI SDK docs, Supabase docs, generative UI patterns, schema versioning precedents)

---

## Constraint Recap

- 30-second criterion: Guillaume types one message, dashboard reconfigures, saved
- 7 closed widgets — no infinite builder, no widget creation
- Flat JSON schema — not graph/node
- Text chat only, split-screen during editing only
- 2–3 week dev timeline
- Must not slide toward "Voie A" (over-engineered path)

---

## 1. Scope Creep

**Pitfall: Discoverable widget count expands the moment editing works**
When the first 7 widgets render in chat-driven preview, every stakeholder immediately asks "can we add an 8th?" or "can the coach define custom metrics?". The closed set feels arbitrary once the mechanic exists.
_Why it happens here:_ Split-screen live preview makes adding a widget look trivially cheap — one JSON key. The gap between "it works for 7" and "build an infinite builder" collapses visually.
_Prevention:_ Encode the widget set as a hard enum in the Zod schema passed to the AI tool. The model cannot hallucinate an 8th widget type if the enum rejects it. Document the enum choice as a product decision in STATE.md, not a technical constraint.

**Pitfall: "Configure" expands into "create" — coach wants to define new widget content**
After saving a layout, the next ask is "can I write custom text inside a widget?" then "can I link it to a custom Supabase query?" This is the infinite builder arriving through the back door.
_Why it happens here:_ Chat makes everything feel equally possible. The LLM will happily generate JSON for a widget type that doesn't exist in the renderer.
_Prevention:_ Each widget in the schema has a fixed `content_source` field with an enum of allowed data bindings (e.g. `"recent_sessions"`, `"weekly_load"`, `"athlete_notes"`). No free-text content_source. The system prompt for the AI tool explicitly states: "You may only configure existing widgets. You may not define new data sources."

**Pitfall: Undo/history becomes a feature requirement mid-sprint**
Once Guillaume saves a dashboard and decides he doesn't like it, the next request is "can I go back to the previous version?" Implementing history means versioned configs, a history drawer, and diff rendering.
_Why it happens here:_ The 30s criterion implies fast iteration, which implies mistakes, which implies regret.
_Prevention:_ Ship with a single "Reset to default" action backed by a static default config constant. Explicitly defer version history. One save slot per coach per dashboard context.

**Pitfall: The chat starts answering CRM questions, not dashboard questions**
The chat panel is visible during editing. It will receive off-topic questions ("how is Mathieu progressing?") because coaches are already in coach mode.
_Why it happens here:_ Shared chat input with no context boundary. The AI has all tools available.
_Prevention:_ The system prompt for the dashboard editing session must be scoped: "You are a dashboard configuration assistant. Your only capability is modifying the layout and widget selection of this dashboard. For coaching questions, ask the user to close the editor first." The tool registry for this session exposes only `update_dashboard_config`, nothing else.

**Pitfall: Split-screen becomes the default layout (always visible)**
The split-screen editing mode feels useful enough that someone proposes keeping it open permanently as a "sidebar chat" for the dashboard.
_Why it happens here:_ The transition back to full-screen after save feels like a loss if the panel was useful.
_Prevention:_ The panel is a modal-class experience, not a persistent sidebar. After `save_dashboard`, the panel closes and the dashboard renders full-screen. Make exit explicit and fast (one tap). Never store `editorOpen: true` in persisted state.

---

## 2. Tool Calling (Vercel AI SDK v6 + Live Preview)

**Pitfall: Using `streamText` when the tool result only matters after completion**
The `update_dashboard_config` tool will return the full updated JSON config. Streaming partial JSON into the preview causes the dashboard to flicker through invalid intermediate states (e.g., a widget array with 3 items mid-stream when the final has 5).
_Why it happens here:_ Defaulting to streaming because the rest of the app uses it. The dashboard preview needs a complete, valid JSON document — not a token-by-token delta.
_Prevention:_ Use `generateText` (not `streamText`) for the dashboard config tool call. Only the assistant's text reply (e.g., "Done, I've moved the load chart to position 1") streams to the chat bubble. The tool result is atomic. Pattern: `streamText` for chat text, `generateText` for tool execution, or isolate the tool call step so `onStepFinish` fires only once with a complete result.

**Pitfall: Forgetting `response.messages` — multi-turn conversation breaks after first tool call**
After the tool returns the new config, if `response.messages` is not appended to conversation history, the model's next turn has no memory of what it just changed. The coach sends "now remove the sleep widget" and the model starts from scratch.
_Why it happens here:_ The SDK v6 `onStepFinish` pattern is easy to implement for text-only turns; tool turns require explicitly calling `appendMessages(conversationId, response.messages)`. Missing this step is the #1 silent failure in multi-turn tool-call flows (confirmed by Vercel AI SDK docs).
_Prevention:_ In the `onStepFinish` callback, always append `response.messages` regardless of whether the step was text-only or a tool call. Write a test that sends two sequential tool-call prompts and asserts the second correctly references the first result.

**Pitfall: Tool UI freeze — coach sees nothing between send and preview update**
When the model calls `update_dashboard_config`, streaming pauses until the tool executes. No visible progress = perceived freeze. For a 30s flow, a 3-second blank state destroys the WOW effect.
_Why it happens here:_ Default `useChat` behavior shows nothing during tool execution. This is documented as the top production UX pitfall with Vercel AI SDK tool calls.
_Prevention:_ Render `toolInvocations` parts with a loading state: when `part.state === 'input-available'`, show "Updating your dashboard..." with a spinner in the preview pane. When `part.state === 'output-available'`, apply the new config. This is a 10-line addition that makes the 30s flow feel instantaneous.

**Pitfall: Optimistic preview update before tool result validation**
To make the preview feel fast, applying the LLM's generated JSON to the preview before the tool call completes (optimistically from the streamed text) looks appealing. But the streamed text and the validated tool output can diverge if the model hallucinates a widget type or position.
_Why it happens here:_ Developers see the JSON forming in the text stream before `onStepFinish` fires and apply it early.
_Prevention:_ Never apply preview state from raw streamed text. The preview ONLY updates on `onStepFinish` when `part.state === 'output-available'`. The tool's Zod schema is the source of truth. Optimistic = stale closures + invalid intermediate states.

**Pitfall: Stale closure capturing old dashboard config in the tool handler**
The tool handler function closes over the `currentConfig` at render time. If the coach sends two messages rapidly (e.g., "move widget A" then "add widget B"), the second handler fires with the config from before the first change was applied.
_Why it happens here:_ React state updates are async. The tool handler captures the value at closure creation, not at execution time. This is the classic streaming stale-state bug.
_Prevention:_ Store `currentConfig` in a `useRef` alongside state. The tool handler reads `configRef.current`, not the state variable. Update both on `onStepFinish`. Never use state directly inside async tool callbacks.

**Pitfall: `stopWhen: stepCountIs(5)` allows 4 unnecessary steps before a simple layout change**
The existing orchestrator is configured with `stepCountIs(5)`. For dashboard editing, a layout change is one tool call. Allowing 5 steps means the model might call the tool, reflect on the result, call it again, etc.
_Why it happens here:_ Inheriting the global agent configuration for a specialized, constrained task.
_Prevention:_ The dashboard editing session uses `stopWhen: stepCountIs(2)` (one tool call + one text confirmation). This also bounds latency, keeping the 30s criterion achievable.

---

## 3. Data Model (Flat JSON Schema Design)

**Pitfall: Schema is too permissive — `additionalProperties: true` lets the model hallucinate fields**
If the widget config schema allows arbitrary keys, the LLM will invent fields like `backgroundColor`, `customQuery`, `showOnlyIfGoalMet`. These fields render silently (ignored by the component) or crash it.
_Why it happens here:_ Early schema drafts use `additionalProperties: true` for flexibility during development. The model exploits this immediately.
_Prevention:_ `additionalProperties: false` on every schema object from day one. Every allowed field is explicitly typed with a description. Use Zod with `.strict()`. The schema is the contract, not a suggestion. Confirmed pattern: OpenAI's Structured Outputs went from <40% compliance to 100% by enforcing strict schemas.

**Pitfall: Widget position/order encoded as a `position` integer field instead of array order**
Representing layout as `{ widgetId: "load_chart", position: 3 }` across multiple widget objects creates ordering conflicts (two widgets at position 3, gaps in sequence, etc.) when the model makes changes.
_Why it happens here:_ Integer position feels explicit. Arrays feel implicit. But the model will frequently produce invalid integer sequences when reordering.
_Prevention:_ Layout is an ordered array. `widgets: [{ id: "load_chart", ... }, { id: "sleep_score", ... }]`. Position = index. Reordering = splicing the array. The model performs array manipulation more reliably than integer arithmetic, and the schema remains unambiguous.

**Pitfall: Enum values too similar — model inconsistently picks between them**
Widget type enums like `"weekly_load_chart"` vs `"session_load_chart"` vs `"load_trend"` cause the model to pick the wrong one. The rendered component is wrong but no error fires.
_Why it happens here:_ Widget naming evolves during dev and subtle names accumulate. The model has no runtime signal that it chose wrong.
_Prevention:_ Widget IDs are short, semantically distinct, and documented in the system prompt with one-line descriptions. Use `"load"`, `"sleep"`, `"readiness"`, `"notes"`, `"goals"`, `"sessions"`, `"athlete_summary"` — not phrase-based names. Test all 7 with a prompt battery before launch.

**Pitfall: No schema version field — first schema evolution breaks all saved dashboards**
Config objects saved in Supabase JSONB have no `schema_version` field. When widget IDs are renamed or new required fields are added in v2, all existing coach dashboards silently render with missing widgets or throw runtime errors.
_Why it happens here:_ "We only have 7 widgets, the schema won't change" — it always does.
_Prevention:_ Include `schema_version: 1` in the root config object from day one. Write a `migrateConfig(rawConfig)` function that normalizes old schemas to current before rendering. Cost: 15 minutes on day 1. Cost of retrofitting: days of debugging corrupted coach configs.

**Pitfall: Storing dashboard config and coach identity in the same JSONB blob**
Tempting to put `{ coach_id, dashboard_layout: [...] }` in one column. Adding per-athlete dashboard overrides later requires restructuring the whole stored object.
_Why it happens here:_ MVP shortcut. One config per coach feels like one object.
_Prevention:_ Store `layout_config JSONB NOT NULL` in its own column beside normalized `user_id`. The JSONB contains only the layout array. Identity is a foreign key, not embedded data. RLS policy: `auth.uid() = user_id` — standard pattern already used across the codebase.

**Pitfall: No default config constant — null configs crash the renderer**
When a coach has never customized their dashboard, `layout_config` is NULL. The renderer crashes attempting to map over null.
_Why it happens here:_ Database default is NULL for JSONB columns unless explicitly set.
_Prevention:_ Set `DEFAULT '[]'::jsonb` or a full default layout as the column default. The renderer always calls `migrateConfig(config ?? DEFAULT_LAYOUT)`. The constant `DEFAULT_LAYOUT` is the source of truth for the out-of-box experience and also powers "Reset to default".

---

## 4. UX ("Building a Builder" Anti-Patterns)

**Pitfall: Showing widget metadata during editing instead of live data**
During split-screen editing, showing "Widget: Load Chart | Position: 2 | Data: recent_sessions" in the preview pane makes it feel like an admin panel, not a coaching tool. The WOW effect evaporates.
_Why it happens here:_ Edit mode feels like it should expose structure. Developers implement a "debug view" that ships.
_Prevention:_ The preview pane always renders the dashboard exactly as the coach will see it — with real data, real styling, real interaction. The chat panel is the configuration surface. The preview is the result surface. No metadata labels, no position badges.

**Pitfall: The chat requires precise syntax — "Add the sleep widget at position 3"**
If the system prompt is poorly written, the model only succeeds when given structured instructions. "Show me the sleep stuff" fails because the model asks clarifying questions instead of acting.
_Why it happens here:_ The tool schema is designed for precision; the system prompt doesn't translate fuzzy intent into tool calls.
_Prevention:_ The system prompt must instruct the model to resolve ambiguity by acting with the best interpretation, then confirming: "I've added the sleep score widget at the top — does that look right?" One tool call per turn, immediate result, confirmation text. Never ask clarifying questions before acting on an unambiguous layout request.

**Pitfall: Confirmation dialog before every change destroys the 30s criterion**
"Are you sure you want to move the load chart?" adds 5+ seconds and 2 taps per interaction. Three changes = 15 seconds of confirmation dialogs.
_Why it happens here:_ Standard CRUD UX instinct applied to a chat-driven flow.
_Prevention:_ No confirmation dialogs during editing. The preview IS the confirmation. The "Save" button is the single commitment point. Before save, all changes are ephemeral (Zustand local state only). After save, a brief toast: "Dashboard saved" with a one-tap Undo that reverts to the previous save — implemented as a single `previousConfig` ref.

**Pitfall: Opening the editor via a gear icon deep in settings — the feature is invisible**
If dashboard customization is buried in a settings menu, coaches discover it weeks after launch, if at all. The WOW effect requires immediate discoverability.
_Why it happens here:_ Conservative UI instinct — "we don't want to clutter the dashboard".
_Prevention:_ A single "Customize" button is always visible on the dashboard surface (top-right, secondary styling). It opens the split-screen editor immediately. No settings page, no intermediate modal. The fastest path to the 30s flow is 1 tap.

**Pitfall: The chat asks "what would you like to customize?" as the opening message**
An empty chat with a vague prompt forces the coach to invent the interaction. Most coaches will type "help" or close the panel.
_Why it happens here:_ Generic chatbot onboarding copied into the editor.
_Prevention:_ The opening message is concrete and action-oriented: "Your dashboard currently shows: [widget 1, widget 2, widget 3...]. Tell me what to change. Examples: 'Put the sleep score first', 'Remove the notes widget', 'Show readiness at the top'." This primes the 30s flow and prevents blank-slate paralysis.

**Pitfall: Streaming text in the chat feels slow during tool execution**
The model says "I'll update your dashboard now..." and then pauses 2-3 seconds for the tool to execute. The streamed text stops mid-sentence. Coaches interpret this as a crash.
_Why it happens here:_ Default streaming behavior: text streams, then tool call executes, then stream resumes.
_Prevention:_ The assistant message for a tool-call turn should be short and sent after the tool completes — not before. Pattern: tool executes silently (with spinner in preview pane), then a single confirmation message streams: "Done. I've moved sleep score to the top and removed the notes widget." No mid-sentence pauses.

---

## Red Flags During Dev

Use this checklist during code review and sprint demos. A "yes" to any item means Voie A is creeping in.

- [ ] The widget schema has `additionalProperties: true` or any `any` type
- [ ] A new widget type is being discussed that isn't in the original 7
- [ ] The tool call is using `streamText` for the config update (not atomic)
- [ ] The preview pane shows JSON, IDs, or position numbers visible to the coach
- [ ] A confirmation dialog has been added before any dashboard change
- [ ] The chat panel responds to non-dashboard questions during editing mode
- [ ] A "history" or "undo stack" feature is being scoped mid-sprint
- [ ] `schema_version` is missing from stored configs
- [ ] `response.messages` is not being appended after tool-call steps
- [ ] The tool handler reads from React state (not a ref) inside an async callback
- [ ] The "Customize" entry point requires more than 1 tap to reach
- [ ] The opening chat message is generic ("How can I help you?")
- [ ] `stepCountIs(5)` is inherited from the global agent for the dashboard session
- [ ] The save button is absent and changes auto-save on every tool call
- [ ] Any developer mentions "we could make the widget set extensible later in this sprint"

---

## Sources

- [Vercel AI SDK — Tool Calling docs](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) — tool execution states, `response.messages`, `onStepFinish`
- [Vercel AI SDK — Generative UI docs](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces) — `part.state` lifecycle, input-available / output-available
- [Vercel AI SDK useChat in Production — DEV Community](https://dev.to/whoffagents/vercel-ai-sdk-usechat-in-production-streaming-errors-and-the-patterns-nobody-writes-about-4ecf) — tool freeze UX, persistence timing, stale state patterns
- [Stop Blaming the LLM — Medium](https://medium.com/@Micheal-Lanham/stop-blaming-the-llm-json-schema-is-the-cheapest-fix-for-flaky-ai-agents-00ebcecefff8) — `additionalProperties: false`, schema drift, silent error correction
- [Perses Dashboard Schema Versioning Discussion](https://github.com/perses/perses/discussions/1186) — schema_version field, DashboardSchemaMigrator pattern
- [Supabase JSONB docs](https://supabase.com/docs/guides/database/json) — when to use JSONB, don't over-index on unstructured data
- [Supabase RLS Performance docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — policy pitfalls, user_metadata vs app_metadata
- [Schema Evolution Without Breaking Consumers — DEV](https://dev.to/alexmercedcoder/schema-evolution-without-breaking-consumers-50a9) — additive-only field changes, transition periods
- [Streaming Backends & React — SitePoint](https://www.sitepoint.com/streaming-backends-react-controlling-re-render-chaos-in-high-frequency-data/) — stale closure fixes, useRef for async callbacks
- [Beyond Chat: AI UI Design Patterns — Artium](https://artium.ai/insights/beyond-chat-how-ai-is-transforming-ui-design-patterns) — governor patterns, approval mechanisms, chat as enhancement not replacement
