# Phase 46 Review Fixes (branch fix/phase-46-audit)

Drawer locked-section UI and unlock toast UI are intentionally NOT touched (design pending validation).

| Finding | Disposition | Commit |
|---|---|---|
| MEDIUM authStore level not tied to user | FIXED. `levelResetPatch()` resets level/levelLoaded/levelUp (and athleteOnboardingComplete) on any user-id change (listener, getSession, setSession) and in signOut. Reads capture uid before the await and are dropped if the user changed (`shouldDiscardLevelRead`). `refreshProfile` also bails if the user changed. | 2138215f (helpers+tests), f30b30a9 (store) |
| LOW out-of-order reads lower level | FIXED. Monotonic request sequence (`levelSeq`/`levelAppliedSeq`) plus `reduceLevelRead` never lowers the level for the same user. | 2138215f, f30b30a9 |
| MEDIUM store install bypass (store/index.tsx, store/[id].tsx) | FIXED. Both install handlers check `isPluginUnlocked` before the confirm/upsert/`registerPlugin`; locked shows `showAlert` with `plugins.locked.title/message/cta`. PluginLoader re-lock now walks `usePluginRegistry` installedPlugins plus `loadedRef` (falls back to `isPluginIdUnlocked` when no manifest). The button itself is not restyled (UI pending). | 5b31ef67 |
| LOW first-read hang | FIXED. 5 s timeout (`FIRST_LEVEL_READ_TIMEOUT_MS`) sets `levelLoaded=true` at level 1 with a fallback flag; the first real read afterwards is accepted without a spurious level-up. A read error before the first success sets the same fallback. | f30b30a9 |
| LOW unknown plugin ids fail open | DOCUMENTED, not changed. Fail-closed would redirect with a nameless alert (guard needs a PLUGIN_LEVEL_MAP entry for the name). Coverage enforced by CI: existing plugins/ dir test plus new test that every `apps/mobile/app/(app)/(plugins)/*` dir is in the map. | 2138215f |
| LOW unused `filterUnlockedPlugins` | DOCUMENTED only (kept, tested; loader relies on level-1 plugins + mandatory coach). |  |
| LOW cross-imports outside (plugins) (ai/index.tsx community, workout/session.tsx gamification) | DOCUMENTED only. Data paths reachable at level 1; not a screen bypass. |  |
| LOW user_plugins fetch error not retried | Not in requested scope; unchanged. |  |
| LOW mojibake-padded names in PLUGIN_LEVEL_MAP | Not changed (sync test pins manifests to the exact literals; editing needs both files via file tools). |  |
| Server-side enforcement | DOCUMENTED, deferred to a future phase (46-SECURITY.md inventory). Deploy checklist note: level gating is client-only; `/plugins/:id/install|toggle`, AI tools (`buildSDKTools`/`getToolExecutor`), `/ai/programs/generate` and plugin tables do not check tier. Do not treat levels as authoritative for monetization or AI cost until enforced server-side. |  |
| Release copy: existing athletes re-locked to tier 1 (D-05) | DOCUMENTED, product decision. Existing installs above their tier are unregistered on upgrade (rows and data kept). Needs release notes / in-app copy before shipping. |  |

## Tests
- `packages/plugin-sdk/src/gating.test.ts`: `shouldDiscardLevelRead`, `reduceLevelRead` (first read, raise, no-lowering, post-fallback), timeout constant, (plugins) route dir coverage.
- The real zustand store is not unit-tested: it needs mocks for supabase, react-native AppState, MMKV and queryClient; the logic that decides behaviour was extracted to pure helpers instead.
