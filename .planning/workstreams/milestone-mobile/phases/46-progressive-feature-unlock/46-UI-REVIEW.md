# Phase 46 - UI review + goal-backward verdict (GATE-04, PluginsDrawer, UnlockToast, overlayGateStore)

Branch audited: `milestone/v1.18` (tip "feat(46): overlay publishes visibility so unlock toast queues behind it"). Read-only audit of source.
Scope: `packages/ui/src/components/PluginsDrawer.tsx`, `apps/mobile/src/components/UnlockToast.tsx`, `apps/mobile/src/stores/overlayGateStore.ts`, `packages/plugin-sdk/src/unlockUi.ts`, `plugins.locked/unlocked.*` i18n, wiring in `app/(app)/index.tsx` and `_layout.tsx`.

## Verdict
GATE-04 (drawer shows locked plugins and how to unlock): PASS on rendered output. 12 locked tiles at level 1, sorted by minLevel, pill "Niv. N", header "Niveau 1", tap shows "Niveau N requis", and "Tout est debloque" at level 5. Two mediums remain (toast queue edge case, alert inside a Modal on iOS).

## Evidence
- Gate: `tsc --noEmit` clean for apps/mobile, packages/ui, packages/plugin-sdk; root `vitest run` 234/234 green.
- Visual: react-native-web harness on port 3148, 390x844 DPR2, real `PluginsDrawer`, `UnlockToast` and `CustomAlert`. Compared with level1-locked, unlock-toast, locked-alert and all-unlocked PNGs. 4 columns, cell 70, gap 16, divider, header, helper, lock chip, pills (next = primary tint, later = grey) and toast position (bottom 116 on a 34 px inset) all match. The default `information-circle` alert with the "Niveau 3 requis" title and "OK" button matches L1. A 2 px vertical drift in the locked section comes from the unlocked tile label having no `lineHeight`; that code is inherited and the contract does not specify it. The icon glyph differences in my render come from the harness icon set, not the app.
- B-01..B-05, B-08, B-11, B-12, B-14, B-15 hold. B-09 holds by code (`showAlert(t('plugins.locked.required'))` only, no navigation). B-13 holds by `unlockToastMotion` (unit tested).
- Regression: with `lockedSection` undefined both new blocks are guarded by `?.`, and the diff against main only adds code. The unlocked grid (56x56, radius 16, `width: '20%'`, gap 16) is untouched, and the all-unlocked render shows 19 tiles in 4 columns.
- Copy: fr and en are non-punitive ("se debloque", "Niveau N requis", "N modules debloques"). No negative or luck words. i18n parity is 47/47 with identical placeholders.
- CLAUDE.md: no `StyleSheet.create`, no emoji, Ionicons only (`lock-closed`, `lock-open`, `checkmark-circle`), `showAlert` used, theme tokens from `useThemeStore`, no dark mode.
- Accessibility: tile `accessibilityRole="button"` with label and hint, header role on the section row, 44 px minimum hit area, toast live region plus announcement.
- Queue behaviour: `overlayGateStore` is published from `isVisible`, with unmount cleanup that resets it to false, so an unmounted overlay cannot leave the toast blocked. A level-up that arrives while the overlay is open waits correctly. `dismiss()` sets `dismissed`, which publishes false, then `refreshLevel()` resolves later and the toast shows. Level reads are user-bound and sequence-guarded.

## Findings
| Sev | Where | Problem | Fix |
|---|---|---|---|
| MEDIUM | UnlockToast.tsx:52-65 and :67 | The queue is only checked when the toast starts. If the overlay becomes visible during the 4 s display (the review query or seen marker resolves late), the toast is hidden (`return null`) but the timer keeps running and calls `clearLevelUp()`. The unlock announcement is consumed without being seen. | Put `overlayOpen` in the timer effect: cancel the timer and reset `shown` to null while the overlay is open, without clearing the store, so the toast restarts after the overlay closes. |
| MEDIUM | PluginsDrawer.tsx:178 | The locked-tap alert is `showAlert`, whose `CustomAlert` is a root-level `Modal` while the drawer is itself a presented `Modal` that stays open. On iOS a second Modal that is not a child of the first often does not present. The tap would then do nothing visible. Not verifiable here (the web harness cannot show it). | Verify on an iOS device. If it fails, close the drawer before `showAlert`, or render the alert inside the drawer Modal. |
| LOW | tests (B-07, B-09, B-10) | These checks are listed as RNTL in the contract but only the pure helpers are tested (`unlockUi.test.ts`). The component wiring is unverified; this review's render evidence stands in for it. | Add RNTL tests, or record the render evidence. |
| LOW | UnlockToast.tsx:54,99 | The toast has `accessibilityLiveRegion` and also calls `announceForAccessibility`, so it is announced twice on Android. | Keep one. |
| LOW | index.tsx:269 | `lockedSection` uses `effectiveLevel` without `levelLoaded`. Before the first read a high-level athlete briefly sees 12 locked tiles and a wrong "Niveau 2 requis". | Skip the locked section until `levelLoaded`. |
| LOW | i18n / unlockUi.ts | `plugins.unlocked.title` and `plugins.unlocked.message` are unused. `lockedTapAlertArgs` is unused (the drawer calls `t()` directly). | Remove them. |
| LOW | PluginsDrawer.tsx:254, UnlockToast.tsx:106 | Hard-coded `#2E9E5B` and `#000` instead of tokens. `LOCKED_SHORT_NAMES` is French only. | Use tokens; accepted by CLAUDE.md for names. |
| LOW | PluginsDrawer.tsx:119 | The unlocked tile label has no `lineHeight`, which causes the 2 px drift against the mockup. | Add `lineHeight: 13`, as on the locked label. |
| LOW | UnlockToast.tsx | The toast stays mounted behind other Modals (drawer, mood sheet) and its 4 s timer runs unseen. | Gate on any open Modal, or accept. |

Counts: critical 0, high 0, medium 2, low 7.
