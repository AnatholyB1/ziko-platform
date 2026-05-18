# Phase 27: Spike — Mandatory Plugin Pattern - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate the mandatory plugin enforcement pattern and produce a decision record + minimal working proof before any implementation in Phase 29. The spike must: (1) document the chosen pattern, (2) apply minimal code changes proving button suppression, and (3) visually confirm end-to-end in a dev build.

</domain>

<decisions>
## Implementation Decisions

### Enforcement Pattern

- **D-01:** **Registry-driven** is the chosen approach. Add `mandatory?: boolean` to `PluginManifest` type in `packages/plugin-sdk`. Setting `mandatory: true` on the coach manifest is the single source of truth.
- **D-02:** `PluginLoader.tsx` **bypasses `user_plugins` entirely** for mandatory plugins — loads them unconditionally on every sign-in, regardless of what's in the `user_plugins` table. No DB migration required.
- **D-03:** The uninstall button in `apps/mobile/app/(app)/store/[id].tsx` checks `manifest.mandatory === true` to render a grayed-out non-interactive badge instead of the trash icon.
- **D-04:** **Rollback plan**: if registry-driven fails during Phase 29, fallback is data-driven — add `is_mandatory boolean` column to `user_plugins` and enforce at the DB layer. Spike doc must document this as the deferred alternative.

### Spike Deliverables

- **D-05:** Spike produces **SPIKE.md** (decision record + comparison table + files-to-touch list) **plus** the minimal code changes proving the pattern works:
  - `mandatory?: boolean` added to `PluginManifest` in `packages/plugin-sdk`
  - `PluginLoader.tsx` updated to load mandatory plugins unconditionally
  - `store/[id].tsx` trash button gated on `manifest.mandatory`
- **D-06:** End-to-end confirmation = **dev build visual confirmation** — run `expo start`, navigate to the coach plugin detail screen, trash icon is grayed out and non-tappable. TypeScript compiles cleanly across all 18 existing plugin manifests (none break — `mandatory` is optional with `undefined = false`).

### Auto-Install Strategy

- **D-07:** Mandatory plugins are loaded for **all authenticated users** unconditionally — no role check in `PluginLoader`. A coach-role user simply sees the coach plugin (which shows State A — no coach linked). Simpler: no `user_profiles.role` query in `PluginLoader`.
- **D-08:** No `user_plugins` row is needed for mandatory plugins. PluginLoader registers them via `registerPlugin(manifest)` directly, skipping the Supabase query for those IDs.

### Claude's Discretion

- SPIKE.md comparison table format — Claude chooses the table structure. Must cover: enforcement layer, DB migration required, code files touched, rollback path, pros/cons.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workstream Planning
- `.planning/workstreams/milestone-mobile/ROADMAP.md` — Phase 27 success criteria, phase dependencies, coverage map
- `.planning/workstreams/milestone-mobile/REQUIREMENTS.md` — COACH-05 (spike requirement), COACH-01–COACH-04 (mandatory enforcement reqs for Phase 29)
- `.planning/workstreams/milestone-mobile/STATE.md` — Accumulated decisions, zero-new-backend constraint

### Key Code Files (spike must touch)
- `packages/plugin-sdk/src/types.ts` (or equivalent) — `PluginManifest` type definition; add `mandatory?: boolean`
- `apps/mobile/src/lib/PluginLoader.tsx` — Plugin loading logic; update to load mandatory plugins unconditionally
- `apps/mobile/app/(app)/store/[id].tsx` — Plugin detail screen; gray out uninstall button when `manifest.mandatory === true`

### Existing Plugin Manifests (spike must verify none break)
- `plugins/*/src/manifest.ts` — All 18 existing manifests must compile cleanly after type change (mandatory defaults to undefined/false)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/app/(app)/store/[id].tsx` uninstall button (line 257–262): existing trash icon TouchableOpacity — spike wraps this in a `manifest.mandatory` conditional
- `apps/mobile/src/lib/PluginLoader.tsx` PLUGIN_LOADERS map: static import map; mandatory plugins need to be identifiable from this map (e.g., filter by loaded manifest's `mandatory` field after load)

### Established Patterns
- `PluginManifest` optional fields pattern: existing fields like `aiSkills`, `aiTools` are optional arrays — `mandatory?: boolean` follows the same pattern
- `showAlert` from `@ziko/plugin-sdk` used for all confirmations — any mandatory tooltip should use the same system
- All 18 existing manifests use `export default manifest` — the type change must not require them to add `mandatory: false` explicitly

### Integration Points
- `usePluginRegistry` + `registerPlugin` in `@ziko/plugin-sdk` — mandatory plugins call `registerPlugin(manifest)` via `aiBridge.registerPlugin(manifest)` just like regular plugins, but without the `user_plugins` guard
- `PluginLoader` `loadedRef` Set: mandatory plugins should still be added to `loadedRef` to prevent double-registration on re-renders

</code_context>

<specifics>
## Specific Ideas

- Grayed-out button: opacity 50% + non-interactive (no `onPress`) is the standard pattern; a tooltip explaining "Ce plugin est obligatoire" is required per COACH-04 (Phase 29 scope, but spike should stub the UI shape)
- The spike code changes are minimal proof-of-concept — full screen scaffolding, 3-state UX, and i18n are Phase 29 scope

</specifics>

<deferred>
## Deferred Ideas

- Data-driven enforcement (`user_plugins.is_mandatory` column) — documented in SPIKE.md as the rollback alternative, not implemented
- Role-gated loading (coach-role users don't get the plugin) — deferred; all authenticated users load mandatory plugins; State A handles no-coach scenarios cleanly
- Granular per-domain permissions — already deferred to post-v1.5 per REQUIREMENTS.md out-of-scope

</deferred>

---

*Phase: 27-Spike — Mandatory Plugin Pattern*
*Context gathered: 2026-05-18*
