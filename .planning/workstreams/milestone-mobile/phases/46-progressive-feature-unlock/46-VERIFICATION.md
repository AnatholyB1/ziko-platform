# Phase 46 Verification (goal-backward, logic part)

Goal: athletes see and load only the plugins their level unlocks, safely, never with zero access.

| Req | Status | Evidence |
|---|---|---|
| GATE-01 minLevel per manifest, level from tier, D-03 map | PASS | `PluginManifest.minLevel?`; 19/19 manifests match D-03 (unit test reads manifest sources); `getEffectiveLevel` ignores stored level, clamps 1-5, no row -> 1; counts 7/13/17/19 at L1-4. |
| GATE-02 PluginLoader gating mandatory -> minLevel -> is_enabled; live level-up; re-lock keeps data | PASS with caveats | Loader code applies the order and re-evaluates on `[user.id, effectiveLevel, levelLoaded]`; re-lock unregisters registry + aiBridge, rows untouched; foreground + weekly-review-dismiss refetch present (D-06). Caveats: store install bypass of registry (MEDIUM), stale-level-across-user (MEDIUM), out-of-order read can lower level (LOW). |
| GATE-03 deep-link route guard | PASS with caveats | Shared guard in `(plugins)/_layout.tsx` covers notification, ai-chat and typed links; fail-closed while level unknown; redirect + alert for locked. Caveat: stale level after account switch lets guard pass; plugin logic imported outside `(plugins)` is unguarded (LOW). |
| GATE-04 drawer "A debloquer" UI + unlock toast | NOT VERIFIED (pending design) | Data layer ready: `getLockedPlugins`, `getNewlyUnlockedPlugins`, `levelUp` store field, i18n keys fr/en. No UI consumer of `levelUp`/`clearLevelUp` yet. |

## What was run
- `npm install --no-save --ignore-scripts` OK (1759 packages).
- `vitest run packages/plugin-sdk/src/gating.test.ts` (root config): 37/37 pass.
- Throwaway harness (not committed) importing the REAL `apps/mobile/src/stores/authStore.ts` with mocked react-native, supabase and queryClient: confirmed first-load no toast, level-up payload (6 plugins L1->L2), no row -> L1, first-read error -> L1 + loaded, later error keeps level; reproduced out-of-order stale read lowering level (3 -> 2) and sign-out race leaking prior level (`levelLoaded` true after sign-out).

## What could not be exercised
- PluginLoader effect and `_layout.tsx` guard at runtime: they depend on React Native, expo-router, the zustand plugin registry and Supabase; no Expo web run was attempted (Metro bundling of 19 workspace plugins not feasible in this session, port 3144 not used). Verified by code reading and by testing the pure helpers they call.
- Real device AppState foreground event, push-notification deep link, and real Supabase RLS/DB reads.
- tsc / lint of mobile app not run.
