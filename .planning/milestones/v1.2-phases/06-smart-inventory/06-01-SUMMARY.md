---
phase: 06-smart-inventory
plan: "01"
subsystem: pantry-plugin
tags: [plugin, supabase, migration, zustand, expo-router, camera]
dependency_graph:
  requires: []
  provides: [pantry_items_table, pantry_plugin_package, pantry_registration]
  affects: [apps/mobile, plugins/pantry, supabase/migrations]
tech_stack:
  added: [expo-camera, "@react-native-community/datetimepicker"]
  patterns: [plugin-package-scaffold, expo-router-wrapper, zustand-store, supabase-rls]
key_files:
  created:
    - supabase/migrations/022_pantry_schema.sql
    - plugins/pantry/package.json
    - plugins/pantry/tsconfig.json
    - plugins/pantry/src/manifest.ts
    - plugins/pantry/src/store.ts
    - plugins/pantry/src/index.ts
    - plugins/pantry/src/screens/.gitkeep
    - apps/mobile/app/(app)/(plugins)/pantry/dashboard.tsx
    - apps/mobile/app/(app)/(plugins)/pantry/add.tsx
    - apps/mobile/app/(app)/(plugins)/pantry/edit.tsx
  modified:
    - apps/mobile/src/lib/PluginLoader.tsx
    - apps/mobile/package.json
    - apps/mobile/app.json
decisions:
  - "Used storefront-outline Ionicons icon for pantry (not emoji — manifest.icon passed to <Ionicons name>)"
  - "PantryItemForm screen exported under two paths (PantryDashboard + PantryItemForm) to support both add and edit routes"
  - "Zustand store is screenless store — no async Supabase calls in store; screens will handle data fetching in Plan 02"
metrics:
  duration: "3 minutes"
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 10
  files_modified: 3
---

# Phase 06 Plan 01: Pantry Plugin Infrastructure Summary

**One-liner:** Supabase migration 022 + @ziko/plugin-pantry package scaffold with Zustand store, manifest (default export, AI tools), and Expo Router wrappers registered in PluginLoader.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Supabase migration + plugin package scaffold + i18n strings | 7f8bdfa | supabase/migrations/022_pantry_schema.sql, plugins/pantry/* (7 files) |
| 2 | Registration wiring, dependency install, Expo Router wrappers | 0b043df | PluginLoader.tsx, package.json, app.json, pantry/*.tsx (6 files) |

## What Was Built

### Supabase Migration 022
- `pantry_items` table with all required columns: `id`, `user_id`, `name`, `quantity`, `unit`, `storage_location`, `food_category`, `expiration_date`, `low_stock_threshold`, `created_at`, `updated_at`
- `unit` CHECK constraint: `('g', 'kg', 'ml', 'L', 'pieces', 'can', 'box', 'bag')`
- `storage_location` CHECK constraint: `('fridge', 'freezer', 'pantry')`
- `food_category` CHECK constraint: 10 categories
- RLS policy `pantry_items_own` with `auth.uid() = user_id`
- Indexes on `(user_id)` and `(user_id, storage_location)`
- `plugins_registry` INSERT with full manifest JSON

### Plugin Package (@ziko/plugin-pantry)
- `package.json`: workspace package with exports for manifest, store, PantryDashboard, PantryItemForm
- `tsconfig.json`: extends root config
- `manifest.ts`: default export, `storefront-outline` icon, `pantry_management` AI skill with 7 trigger keywords, `pantry_get_items` and `pantry_update_item` AI tools, 3 routes (dashboard + add + edit)
- `store.ts`: `usePantryStore` with `PantryItem` type, `getItemsByLocation`, `addItem`, `updateItem`, `removeItem`
- `index.ts`: public API re-exports

### App Integration
- `PluginLoader.tsx`: pantry entry added to PLUGIN_LOADERS
- `apps/mobile/package.json`: `@ziko/plugin-pantry: "*"` dependency + `expo-camera: ~17.0.10` + `@react-native-community/datetimepicker: 8.4.4`
- `app.json`: `NSCameraUsageDescription` in iOS infoPlist
- Three Expo Router wrappers: `dashboard.tsx`, `add.tsx`, `edit.tsx`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `plugins/pantry/src/screens/PantryDashboard.tsx` — does NOT exist yet (intentional: created in Plan 02)
- `plugins/pantry/src/screens/PantryItemForm.tsx` — does NOT exist yet (intentional: created in Plan 02)
- Expo Router wrapper files import these screens which don't exist yet — will produce compile error until Plan 02 is complete

These stubs are intentional per plan design: Plan 01 is infrastructure-only, Plan 02 creates the screen components. The app will not compile with pantry routes until Plan 02 completes.

## Self-Check: PASSED

Files verified:
- FOUND: supabase/migrations/022_pantry_schema.sql
- FOUND: plugins/pantry/package.json
- FOUND: plugins/pantry/src/manifest.ts
- FOUND: plugins/pantry/src/store.ts
- FOUND: plugins/pantry/src/index.ts
- FOUND: apps/mobile/app/(app)/(plugins)/pantry/dashboard.tsx
- FOUND: apps/mobile/app/(app)/(plugins)/pantry/add.tsx
- FOUND: apps/mobile/app/(app)/(plugins)/pantry/edit.tsx
- FOUND: apps/mobile/src/lib/PluginLoader.tsx (pantry entry added)

Commits verified:
- FOUND: 7f8bdfa (Task 1)
- FOUND: 0b043df (Task 2)
