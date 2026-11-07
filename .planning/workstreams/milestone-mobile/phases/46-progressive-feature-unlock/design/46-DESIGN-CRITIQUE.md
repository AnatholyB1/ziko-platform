# Phase 46 - Design Critique, revision 2 (after viewing all 4 renders)

Method: opened every PNG before and after; read the real `PluginsDrawer.tsx`, `CustomAlert.tsx`, `alert.ts`, `CreditEarnToast.tsx` and the tab bar style; ran `critique` and `audit` on the output. Skills applied: impeccable, shape, high-end-visual-design, design-taste-frontend, frontend-design, layout, typeset, adapt, critique, audit.

## Defects seen in the v1 renders
1. Drawer drew 5 columns with no horizontal gap. The real drawer (`width: '20%'`, `gap: 16`, `flexWrap`) fits 4 per row (5 x 70 + 4 x 16 > 350). The mock was not exact-match and understated how long the locked section is.
2. Locked alert showed a custom lock icon and a two-sentence body; the real `showAlert` with a title only renders the default info icon and an "OK" button. Contradicted the locked decision (text only).
3. Level pills at 11px and a "Tout est débloqué" card whose second line was clipped by the sheet at the bottom (all-unlocked).
4. Unlock toast: two-line detail inside a fully rounded 24px pill; icon in an extra circle that the real toast pattern does not have; the pill touched or overlapped the tab bar (real tab bar is `70 + insets.bottom`, toast `bottom: 80`).
5. Home screen behind the drawer/toast was three blank white boxes that read as an unfinished wireframe.
6. Level 1 peek of a third locked row was a cut-off pair of circles at the bottom edge (looked like a rendering glitch).

## Changes made
- Real 4-column geometry (cell 70, gap 16).
- Alert = `showAlert('Niveau 3 requis')` exactly: default icon, title, "OK". No invented copy.
- Pill 14/700, height 24; all new text >= 14 (only the inherited 10px tile names remain).
- All-unlocked closing: single muted line with check icon (no card, no second sentence), fully visible.
- Toast: CreditEarnToast geometry (gap 8, bare 18px icon, radius 24, padding 20/12), one-line detail "6 modules débloqués", offset above a 104px tab bar, 4000ms, queued after the overlay.
- Skeleton lines inside the background cards so the context reads as a real Home.
- `measure.js` aligned with phase 45 (forbidden-word/emoji scan, CTA font check, allowlist reduced to tile names).

## What works
- The unlocked grid is untouched, so the locked section reads as additive.
- Hierarchy: divider, small header with current level, helper, grey tiles; the primary-tint pill answers "what comes next" without a progress widget.
- Locked tiles stay tappable and explain themselves.

## Remaining (not fixed)
- 12 locked tiles at level 1 outweigh 7 unlocked ones; mitigated by grey low-contrast tiles. Decision L3 locks the full list.
- Tile names stay 10px (inherited from the unlocked grid); pills carry the key info at 14px.
- Alert "OK" contrast 3.09:1 (shared `CustomAlert`, 15/700 is not large text).
- The toast is `pointerEvents: none`, so it cannot link to the drawer.

## Open questions (max 3)
1. `CustomAlert` always renders an info icon when no destructive button exists. Accept the default info icon (current), or add an opt-out prop in a shared-component change? Recommended: accept for v1.18.
2. `CreditEarnToast` has the same `bottom: 80` overlap on notch devices. Fix the shared offset to `70 + insets.bottom + 12` for both toasts? Recommended: yes, one small change shared by both.
3. Raise the tile names of both grids from 10px to 12px (shared component change)? Recommended: no for v1.18, revisit with the 5-to-4 column fix.
