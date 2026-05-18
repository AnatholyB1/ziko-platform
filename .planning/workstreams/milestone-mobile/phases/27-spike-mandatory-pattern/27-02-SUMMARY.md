---
phase: 27-spike-mandatory-pattern
plan: "02"
subsystem: mobile-plugin-system
tags: [spike, mandatory-plugin, PluginManifest, PluginLoader, store]
dependency_graph:
  requires: [27-01]
  provides: [mandatory-field, mandatory-loader, mandatory-trash-gate]
  affects: [27-03]
tech_stack:
  added: []
  patterns: [mandatory-manifest-field, bypass-user-plugins-for-mandatory, ternary-gate-trash-button]
key_files:
  created: []
  modified:
    - packages/plugin-sdk/src/types.ts
    - apps/mobile/src/lib/PluginLoader.tsx
    - apps/mobile/app/(app)/store/[id].tsx
decisions:
  - "mandatory?: boolean inserted after aiSystemPromptAddition — optional, backward compatible"
  - "Mandatory loop runs before user_plugins query — loadedRef guards against double-registration"
  - "Trash button ternary: View (opacity 0.5) for mandatory, TouchableOpacity for regular"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-18"
  tasks_completed: 3
  files_created: 0
  files_modified: 3
---

# Phase 27 Plan 02: Spike Code Proof — Registry-Driven Mandatory Plugin Pattern Summary

**One-liner:** Trois changements ciblés prouvent que le pattern mandatory est faisable : champ optionnel dans PluginManifest, pré-chargement bypass-DB dans PluginLoader, et gate visuel (opacity) sur le bouton trash du store.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add `mandatory?: boolean` to PluginManifest | f3133c9 | `packages/plugin-sdk/src/types.ts` |
| 2 | PluginLoader pre-load mandatory plugins | f3133c9 | `apps/mobile/src/lib/PluginLoader.tsx` |
| 3 | Gate trash button in store/[id].tsx | f3133c9 | `apps/mobile/app/(app)/store/[id].tsx` |

## What Was Built

### Tâche 1 — Champ `mandatory?: boolean` dans PluginManifest

Insertion d'un champ optionnel après `aiSystemPromptAddition` dans `packages/plugin-sdk/src/types.ts`. Aucun manifest existant n'est cassé — le champ est `undefined` par défaut, ce qui est falsy pour les gardes `=== true`.

### Tâche 2 — Pré-chargement mandatory dans PluginLoader

Boucle insérée **avant** la requête `user_plugins` dans `loadInstalledPlugins`. Elle itère sur `PLUGIN_LOADERS`, charge chaque manifest, et si `mod.default.mandatory === true`, enregistre le plugin sans passer par Supabase. Le `loadedRef` protège contre la double-registration si le plugin est aussi dans `user_plugins`.

### Tâche 3 — Gate visuel du bouton trash

Remplacement du `<TouchableOpacity>` par un ternaire JSX : pour `manifest.mandatory === true`, un `<View>` opacifié (0.5) affiche l'icône trash en lecture seule. Pour les plugins normaux, le `<TouchableOpacity onPress={uninstall}>` original est conservé. Aucun import ajouté — `View` était déjà importé depuis `react-native`.

## TypeScript Verification

- `packages/plugin-sdk/tsconfig.json` : 0 erreurs
- `apps/mobile/tsconfig.json` : 1 erreur pre-existante dans `apps/mobile/app/(app)/ai/chat.tsx` (L357 — `textAlign` sur un `View`, non liée à ce plan)

## Deviations from Plan

None — plan executé exactement tel qu'écrit. L'erreur TypeScript dans `chat.tsx` est pre-existante et hors scope.

## Self-Check: PASSED

- `packages/plugin-sdk/src/types.ts` contient `mandatory?: boolean` — FOUND
- `apps/mobile/src/lib/PluginLoader.tsx` contient `mod.default.mandatory === true` — FOUND
- `apps/mobile/app/(app)/store/[id].tsx` contient `manifest.mandatory` — FOUND
- Commit `f3133c9` — FOUND
