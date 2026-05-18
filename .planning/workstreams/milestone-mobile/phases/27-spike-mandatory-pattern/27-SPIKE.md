# Phase 27 Spike: Mandatory Plugin Enforcement — Architecture Decision Record

**Date:** 2026-05-18
**Status:** DECIDED

---

## 1. Problem Statement

The coach plugin must be pre-installed and non-removable for all authenticated athletes. Two patterns were considered before writing any Phase 29 code. A spike was required to (a) compare the approaches on migration cost, rollback safety, and code surface, and (b) record the chosen approach as a binding decision so that Phase 29 can implement without relitigating the options.

---

## 2. Comparison Table

| Approach | Enforcement Layer | DB Migration Required | Code Files Touched | Rollback Path | Pros | Cons |
|---|---|---|---|---|---|---|
| Registry-driven (chosen) | manifest field (`manifest.mandatory: true`) | No | `packages/plugin-sdk/src/types.ts`, `apps/mobile/src/lib/PluginLoader.tsx`, `apps/mobile/app/(app)/store/[id].tsx` | Switch to data-driven (see Rollback section) | No migration, single source of truth in manifest, backward compatible (optional field defaults to `undefined`/`false`) | Enforcement lives in client code, not enforced at DB layer |
| Data-driven (rollback) | `user_plugins.is_mandatory boolean` column | Yes — new column + RLS policy update | new Supabase migration, `apps/mobile/src/lib/PluginLoader.tsx`, `apps/mobile/app/(app)/store/[id].tsx` | Remove column (requires another migration) | DB enforces constraint, survives client bugs | Requires migration, backend dependency, harder to change |

---

## 3. Decision

Registry-driven is chosen (per D-01). `mandatory?: boolean` will be added to `PluginManifest` in `packages/plugin-sdk/src/types.ts`. Omitting the field is equivalent to `false`; all 18 existing manifests compile cleanly without modification because the field is optional. No database migration is required to ship the initial enforcement.

---

## 4. Files to Touch

1. `packages/plugin-sdk/src/types.ts` — add `mandatory?: boolean` field to the `PluginManifest` interface, inserted after `aiSystemPromptAddition`.
2. `apps/mobile/src/lib/PluginLoader.tsx` — before the `user_plugins` Supabase query, iterate `PLUGIN_LOADERS` entries, load each whose resolved manifest has `mandatory === true`, call `registerPlugin` + `aiBridge.registerPlugin`, add to `loadedRef.current`. No `user_plugins` row is required for mandatory plugins.
3. `apps/mobile/app/(app)/store/[id].tsx` lines 257–262 — replace the unconditional `<TouchableOpacity onPress={uninstall}>` trash icon with a conditional: if `manifest.mandatory === true` render a `<View>` with `opacity: 0.5` and no `onPress`; otherwise render the existing `TouchableOpacity`.

---

## 5. Auto-Install Strategy

Mandatory plugins are loaded unconditionally for all authenticated users inside `PluginLoader`, before the `user_plugins` Supabase query executes. There is no role check and no `user_plugins` row requirement. The `loadedRef` Set (already present in `PluginLoader`) guards against double-registration if both the mandatory pre-pass and the `user_plugins` loop encounter the same plugin ID.

Pseudocode intent (no fenced block — inline description): for each entry in `PLUGIN_LOADERS`, import the manifest, if `manifest.mandatory === true` and `!loadedRef.current.has(id)`, call `registerPlugin(manifest)` and `aiBridge.registerPlugin(manifest)`, then add `id` to `loadedRef.current`.

---

## 6. Rollback Plan

If registry-driven enforcement fails during Phase 29 (e.g., manifest field is ignored by a bug in PluginLoader or stripped at bundle time), the fallback is data-driven:

1. Add column: `ALTER TABLE public.user_plugins ADD COLUMN is_mandatory boolean NOT NULL DEFAULT false;`
2. Backfill the coach plugin row for all existing users: `UPDATE public.user_plugins SET is_mandatory = true WHERE plugin_id = 'coach';`
3. Update RLS policy to prevent deletion of rows where `is_mandatory = true`.
4. Rewrite `PluginLoader` to read `is_mandatory` from the `user_plugins` query result instead of `manifest.mandatory`.
5. Update `store/[id].tsx` to read the DB flag instead of the manifest field.

This fallback requires one Supabase migration but no manifest changes. The manifest `mandatory` field can remain in `types.ts` for documentation purposes or be removed.

---

## 7. End-to-End Verification Criteria

Per D-06:

(a) `npx tsc --noEmit` from monorepo root exits 0 across all 18 plugin manifests and all 3 modified files. This confirms the optional `mandatory?: boolean` field is backward-compatible and that `PluginLoader` and `store/[id].tsx` type-check correctly after modification.

(b) Running `expo start` and navigating to the coach plugin detail screen (the store screen for `plugin_id = 'coach'`) shows the trash icon rendered as a `<View>` with `opacity: 0.5` and no `onPress` handler — visually grayed out and non-interactive. All other plugin detail screens continue to show the interactive `TouchableOpacity` trash icon.

---

## 8. Phase 29 Scope Boundary

The following items are NOT in scope for this spike and are deferred to Phase 29 or later:

- Full coach plugin screen scaffolding (UI, routes, dashboard)
- 3-state UX for plugin status (not installed / installed-removable / installed-mandatory)
- i18n strings for any new mandatory-plugin UI labels
- Tooltip or inline explanation text ("Ce plugin est obligatoire")
- Role-gated loading (e.g., only coaches see certain mandatory plugins; athletes always see coach plugin)
- Any `user_plugins` DB migration or backfill
- Backend enforcement or server-side validation of mandatory status
