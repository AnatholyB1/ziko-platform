# Phase 46 - Design Contract (progressive feature unlock)

Revision 2 (design refinement pass after viewing the renders). Surfaces: (A) `PluginsDrawer` with a separate "À débloquer" section; (B) locked-tap `showAlert`; (C) unlock toast after a level-up. Reqs GATE-01..04.
Prototypes: `*.html` + `tokens.css` here, PNGs 390x844 DPR2 (see `MOCKUPS.md`). Measurement: `measure.js`, `measure-results.json`. Critique: `46-DESIGN-CRITIQUE.md`. Fully light theme (no dark surface).

## 0. Locked decisions (user)
- L1: locked-tap alert is `showAlert('Niveau N requis')` text only, no custom icon. Consequence verified in `CustomAlert.tsx`: with no message and no buttons the real alert renders its default `information-circle` icon, the title (margin-bottom 20) and a default "OK" button. The prototype shows exactly that; we add nothing.
- L2: unlock toast stays visible 4000ms and is queued after the weekly-review overlay (never over it).
- L3: all locked tiles are shown, in one separate "À débloquer" section below the unlocked grid.

## 1. Principles
1. Unlocked grid is unchanged (D-04): tile 56x56 radius 16, tint `color+18`, 1px `theme.border`, 10/600 muted label, `gap 16`, cell `width: '20%'`, sheet radius 24, padding 20, `maxHeight: 75%`.
2. Geometry correction: a `flexWrap` row with `gap: 16` and `width: '20%'` cells fits 4 per row, not 5 (5 x 70 + 4 x 16 = 414 > 350 content width). The v1 prototypes drew 5 columns with no horizontal gap; revision 2 draws the real 4 columns (cell 70, gap 16, 22px free at the right). Same container for the locked grid.
3. Locked = visibly different but calm: grey tile, dimmed glyph, small lock chip, level pill. No red, no overlay over the icon, no shake.
4. Tell the athlete what to do: pill states the level, section header states the current level, alert states the requirement.
5. Locked tiles are always tappable (explain, never dead).

## 2. Tokens (`tokens.css`, shared with 45)
| Token | Value | Use |
|---|---|---|
| surface / bg / border / text / muted | #FFFFFF / #F7F6F3 / #E2E0DA / #1C1A17 / #6B6963 | sheet, dividers, labels |
| `--locked-bg` | #EFEEEA | locked tile fill, pill (later levels) |
| `--locked-icon` | #858279 | glyph on locked tile (3.84:1, non-text >= 3) |
| `--primary-ink` | #B8400D | next-level pill text and "Niveau N" header (>= 4.5 on tint/white) |
| primary-light / primary-border | #FF5C1A15 / #FF5C1A33 | next-level pill fill/border, alert icon bg |
Typography: sheet title 18/800 (unchanged); section title 14/700; helper 14/400; tile label 10/600 (inherited); pill "Niv. N" 14/700 (was 11, raised to the 14 floor; pill height 24, radius 12, still fits the 70px cell); toast title 15/700, detail 14/400; alert = real `CustomAlert` (18/700, button 15/700). Spacing multiples of 4 (section margin-top 24, padding-top 16, tile gap 6).

## 3. Drawer anatomy (inside the scroll area)
1. Unlocked grid, registry order, 4 per row.
2. Divider `border-top` 1px, `margin-top 24`, `padding-top 16`.
3. Header row: Ionicons `lock-closed` 16 muted + "À débloquer" (14/700) + right "Niveau {n}" (14/700 `--primary-ink`).
4. Helper "Ces modules s'ouvrent au fil de ta progression avec Ziko." (14/400 muted).
5. Locked grid, same geometry. Cell = tile (grey, lock chip 22x22 at -5/-5 with `lock-closed` 12) + name (10/600, 2 lines max) + pill. Pill for `minLevel == current + 1` uses the primary tint, others grey. Sorted by `minLevel` then registry order.
6. Scroll ends with the sheet `paddingBottom` (Modal sheet; the screen-root `paddingBottom: 100` rule does not apply). Locked rows beyond the first two are reached by scrolling.
Data: static `id -> {name, shortName, icon, color, minLevel}` (D-04). `shortName` recommended because labels wrap at hyphens ("Garde-manger") or truncate after 2 lines.

## 4. States
| State | File | Content |
|---|---|---|
| Level 1 | `level1-locked.html` | 7 unlocked (2 rows), divider, header "Niveau 1", 12 locked (3 rows, 2 visible, rest scroll) |
| Level-up toast | `unlock-toast.html` | pill at `bottom` above the tab bar: bare `lock-open` 18 primary, "Niveau 2 atteint", "6 modules débloqués" |
| All unlocked | `all-unlocked.html` | 19 tiles (5 rows), then one muted line with `checkmark-circle` 20 and "Tout est débloqué" (no card, no second sentence) |
| Locked tap | `locked-alert.html` | `showAlert('Niveau 3 requis')`: default info icon, title, "OK" |
Edge cases: re-locked installed plugin (D-05) appears in the locked section, same alert; deep link to a locked route: same alert then redirect to the main tab (guard in `(plugins)/_layout.tsx`); level read failing/no row = level 1 (GATE-03); level 5 with nothing locked = all-unlocked; long names wrap 2 lines then ellipsis.

## 5. Microcopy (fr)
- Section "À débloquer", "Niveau {n}", helper above, pill "Niv. {n}".
- Alert: `showAlert(t('plugins.locked.title', {n}))` = "Niveau {n} requis"; no message, default button.
- Toast: title `Niveau {n} atteint`; detail `{k} modules débloqués` (1: `1 module débloqué`). Names were dropped: the old two-line "Journal, Sommeil et 4 autres modules débloqués" wrapped to 2 lines in a pill and is repeated in the drawer.
- a11y label `{name}, verrouillé, se débloque au niveau {n}`.
Never "bloqué" as a penalty or "accès refusé".

## 6. Motion and reduced motion
- Drawer: unchanged. Locked tiles: no animation, tap `activeOpacity 0.75`, no shake.
- Toast: `CreditEarnToast` pattern (MotiView opacity 0->1, translateY 20->0, 300ms, `pointerEvents="none"`, zIndex 999). Deltas: 4000ms (was 2500), queued after the weekly overlay, vertical offset `70 + insets.bottom + 12` instead of the hard-coded `bottom: 80`: the tab bar is `70 + insets.bottom` tall (`app/(app)/_layout.tsx`), so on a notch phone (~104px) the existing 80px offset overlaps the tab bar by ~24px. The prototype uses a 104px tab bar and `bottom: 116`.
- Reduced motion: opacity only, 150ms.

## 7. Accessibility
- Locked cell: `accessibilityRole="button"`, label above, hint "Affiche le niveau requis".
- Header `accessibilityRole="header"`; lock glyph decorative.
- Toast: `accessibilityLiveRegion="polite"` and `AccessibilityInfo.announceForAccessibility` with the full sentence.
- Level conveyed by text, not colour.
- W-2 (narrowed): only the tile name 10px (inherited, unchanged grid) is below 14. All new text is >= 14. Waiver W-1: alert "OK" white on `#FF5C1A` 15/700 = 3.09:1 (inherited `CustomAlert`, not large text); not fixable in this phase without touching the shared component.

## 8. Measurable acceptance checks (`node measure.js <dir>`)
| ID | Check | Threshold | Result (rev 2) |
|---|---|---|---|
| B-01 | No horizontal overflow at 390 | scrollWidth <= 390 | pass, 4/4 |
| B-02 | Text >= 14px except tile name (10, inherited) | allowlist `.cell .nm` only | pass (0 small) |
| B-03 | Every tile cell hit area >= 44x44 | w,h >= 44 | pass (cell 70 x >= 86; 19 or 20 targets) |
| B-04 | Text contrast >= 4.5 (3 large) | composite | pass except alert "OK" 3.09 (W-1) |
| B-05 | Non-text: locked glyph on tile, lock glyph on chip | >= 3:1 | 3.84 / 4.73 pass |
| B-06 | Grid geometry: cell 70, gap 16, 4 per row at 350 content width | rendered columns == 4 | pass (renders); verify on device |
| B-07 | Unlocked grid geometry identical to current `PluginsDrawer` | RNTL snapshot unchanged for level >= max | to verify in build |
| B-08 | No locked header or empty grid when nothing is locked | absent | pass (`all-unlocked`) |
| B-09 | Locked tile tap calls `showAlert('Niveau N requis')`, no custom icon prop, never navigates | RNTL | to verify in build |
| B-10 | Toast visible 4000ms, `pointerEvents none`, one at a time, mounts only after the weekly overlay is dismissed | RNTL fake timers | to verify in build |
| B-11 | No emoji, Ionicons only (`lock-closed`, `lock-open`, `checkmark-circle`, `information-circle`) | `forbidden=[]` | pass |
| B-12 | Locked order = minLevel asc; level 1 shows 12 locked (D-03) | unit test | to verify in build |
| B-13 | Reduced motion removes translateY on toast | RNTL mock | to verify in build |
| B-14 | Toast bottom offset clears the tab bar | toast bottom >= tab bar height + 8 on a 34px inset device | pass in prototype (116 vs 104) |
| B-15 | Pill font size | >= 14 | pass (14/700) |

## 9. Requirement -> screen -> check
| Req | Screen(s) | Checks |
|---|---|---|
| GATE-01 (manifest `minLevel`) | pills, locked list | B-12 |
| GATE-02 (loader hides above level) | level1-locked, toast | B-06, B-07, B-10 |
| GATE-03 (no state row = minimum level) | level1-locked | B-12 |
| GATE-04 (drawer shows locked + how to unlock) | level1-locked, locked-alert, all-unlocked | B-02..B-05, B-08, B-09, B-15 |
