# Phase 46 - Design Contract (progressive feature unlock)

Surfaces: (A) `PluginsDrawer` with a separate "À débloquer" section; (B) locked-tap `showAlert`; (C) unlock toast after a level-up. Reqs GATE-01..04.
Prototypes: `*.html` + `tokens.css` here, PNGs 390x844 DPR2 (see `MOCKUPS.md`). Measurement: `measure.js`, `measure-results.json`. Fully light theme (no dark exception here).

## 1. Principles
1. Unlocked grid is unchanged (D-04): 5 columns (`width: '20%'`), 56x56 radius-16 tiles, tint `color+18`, 1px `theme.border`, 10/600 muted label, gap 16, sheet radius 24, padding 20, `maxHeight: 75%`.
2. Locked = visibly different but calm, never alarming: grey tile, dimmed glyph, small lock chip, level pill. No red, no padlock overlays covering the icon, no shake.
3. Tell the athlete what to do: pill states the level, the section header states current level, alert states the requirement.
4. Locked tiles are always tappable (explain, never dead).

## 2. Tokens (`tokens.css`, shared with 45)
| Token | Value | Use |
|---|---|---|
| surface / bg / border / text / muted | #FFFFFF / #F7F6F3 / #E2E0DA / #1C1A17 / #6B6963 | sheet, dividers, labels |
| `--locked-bg` | #EFEEEA | locked tile fill, level pill (later levels) |
| `--locked-icon` | #858279 | plugin glyph on locked tile (3.84:1 vs tile, non-text >= 3) |
| `--primary-ink` | #B8400D | "Niv." pill text for the NEXT level and "Niveau N" header (>= 4.5 on tint/white) |
| primary-light / primary-border | #FF5C1A15 / #FF5C1A33 | next-level pill fill/border, toast and alert icon bg |
Typography: sheet title 18/800 (unchanged); section title 14/700; section helper 14/400; tile labels 10/600 (unchanged, inherited); "Niv. N" 11/700; toast title 15/700, toast detail 14/400; alert as `CustomAlert` (18/700, 14/400, button 15/700). Spacing multiples of 4 (section margin-top 24, padding-top 16, helper margin 4, tile gap 6).

## 3. Drawer anatomy (top to bottom inside the scroll area)
1. Unlocked grid (unchanged, order = registry order).
2. `border-top` 1px divider, `margin-top 24`, `padding-top 16`.
3. Section header row: Ionicons `lock-closed` 16 muted + "À débloquer" (14/700) + right-aligned "Niveau {n}" (14/700, `--primary-ink`).
4. Helper: "Ces modules s'ouvrent au fil de ta progression avec Ziko." (14/400 muted, <= 2 lines).
5. Locked grid, same 5-column geometry. Locked cell = tile (56x56, `--locked-bg`, glyph `--locked-icon`, lock chip 22x22 white circle with 1px border at top -5/-5 containing `lock-closed` 12 muted) + name (10/600 muted, 2 lines max) + pill "Niv. N" (20 high, radius 10, 11/700). Pill for `minLevel == currentLevel + 1` uses primary tint (`next`), others grey. Sorted by `minLevel` asc, then registry order.
6. The scroll content ends with the sheet's `paddingBottom 36` (the drawer is a Modal sheet; screen-root `paddingBottom: 100` rule does not apply).
Data: needs the static `id -> {name, shortName, icon, color, minLevel}` source (D-04). `shortName` recommended (labels truncate at 2 lines x ~12 chars; e.g. "Sommeil & Récupération" must not rely on the long manifest name). Icons in the prototypes are indicative; real glyph = manifest icon.

## 4. States
| State | File | Content |
|---|---|---|
| Level 1, locked section | `level1-locked.html` | 7 unlocked (coach, habits, nutrition, timer, hydration, stretching, rpe), 12 locked in 3 rows (6 at Niv. 2 highlighted, 4 at Niv. 3, 2 at Niv. 4 below the fold; sheet scrolls) |
| Level-up unlock toast | `unlock-toast.html` | pill over the tab screen: lock-open icon in primary-light circle, "Niveau 2 atteint", "Journal, Sommeil et 4 autres modules débloqués" |
| All unlocked (level >= highest minLevel) | `all-unlocked.html` | no "À débloquer" header and no empty grid; a closing row "Tout est débloqué / Tu as accès à tous les modules." (checkmark-circle, success tint on icon only) |
| Locked tap | `locked-alert.html` | `showAlert` (CustomAlert look): lock icon in 56 circle, "Niveau 3 requis", "Cardio se débloque au niveau 3. Continue tes semaines avec Ziko : ton niveau monte avec tes points.", single button "Compris" |
Re-locked installed plugin (D-05): appears in the locked section (data kept); alert variant adds "Tes données sont conservées." Deep link to a locked route: same alert, then `router.back()`/redirect to the main tab (guard in `(plugins)/_layout.tsx`).
Edge cases: level 5 with nothing locked = all-unlocked state; level read failing/no row = level 1 (GATE-03), drawer shows full locked section; long plugin names: 2 lines then ellipsis; 3+ unlocked rows: only the scroll area grows.

## 5. Microcopy (fr)
- Section: "À débloquer"; "Niveau {n}"; helper above; pill "Niv. {n}".
- Alert title `Niveau {n} requis`; message `{short name} se débloque au niveau {n}. Continue tes semaines avec Ziko : ton niveau monte avec tes points.`; re-locked add-on "Tes données sont conservées."; button "Compris". Use `showAlert(title, message, [{text:'Compris'}])` (no custom icon API assumed: if `showAlert` has no icon, the lock icon is the default-style slot, see Q3).
- Toast: title `Niveau {n} atteint`; detail `{A}, {B} et {k} autres modules débloqués` (k = count-2; 1 module: `{A} est débloqué`; 2: `{A} et {B} sont débloqués`).
- a11y labels: `{name}, verrouillé, se débloque au niveau {n}`.
Never say "bloqué" as a penalty or "accès refusé"; copy is about progression, not restriction.

## 6. Motion and reduced motion
- Drawer: unchanged `animationType="slide"`. Locked tiles: no animation on open. Tap: `activeOpacity 0.75` (same as unlocked), no shake or bounce.
- Toast: CreditEarnToast pattern (MotiView `opacity 0->1`, `translateY 20->0`, timing 300ms, bottom 80, `pointerEvents="none"`, zIndex 999). Delta: visible 4000ms (two lines of text need reading time) instead of 2500ms; queue rule: show after the weekly-review overlay is dismissed (D-06), never over the overlay.
- Newly unlocked tile highlight in the drawer: none (see Q4).
- Reduced motion: toast uses opacity only (no translateY), 150ms.

## 7. Accessibility
- Locked cell: `accessibilityRole="button"`, label above, `accessibilityState={{disabled:false}}` (it is actionable), hint "Affiche le niveau requis".
- Section is an `accessibilityRole="header"` row; lock glyph decorative (`importantForAccessibility="no"`).
- Toast: `accessibilityLiveRegion="polite"` (Android) and `AccessibilityInfo.announceForAccessibility` (iOS) with the full sentence, since it is `pointerEvents="none"` and auto-dismisses.
- Level conveyed by text pill and label, not color; next-level tint is an extra cue only.
- Tile label size 10px and pill 11px are inherited/density-bound exceptions (W-2); full information is repeated at 14-15px in the alert. See Q2.
- Alert "Compris" button white on `#FF5C1A` 3.09:1 is the inherited CustomAlert waiver (W-1, same as Phase 45).

## 8. Measurable acceptance checks (`node measure.js <dir>`)
| ID | Check | Threshold | Result |
|---|---|---|---|
| B-01 | No horizontal overflow at 390 | scrollWidth <= 390 | pass, 4/4 |
| B-02 | Text >= 14px except tile label (10, inherited) and level pill (11) | allowlist only those two | pass |
| B-03 | Each tile cell hit area >= 44x44 | w,h >= 44 | pass (cell 70x~86 unlocked, ~110 locked) |
| B-04 | Text contrast >= 4.5 (3 for large), incl. locked label, pills, helper | composite | pass except alert button 3.09 (W-1) |
| B-05 | Non-text contrast: locked glyph on tile, lock glyph on chip | >= 3:1 | 3.84 / 4.73 pass |
| B-06 | Drawer columns | exactly 5 per row (`width: 20%`) | pass |
| B-07 | Unlocked grid markup/geometry identical to current `PluginsDrawer` | RNTL snapshot unchanged for level >= max | to verify in build |
| B-08 | Locked section absent when no locked plugin | no header, no empty grid | pass (`all-unlocked`) |
| B-09 | Locked tile tap calls `showAlert` and never navigates | RNTL | to verify in build |
| B-10 | Toast visible 4000ms, `pointerEvents none`, one at a time | RNTL fake timers | to verify in build |
| B-11 | No emoji; Ionicons names only (`lock-closed`, `lock-open`, `checkmark-circle`) | grep = 0 | pass |
| B-12 | Locked list order = minLevel asc; level 1 (no state row) shows 12 locked per D-03 map | unit test | to verify in build |
| B-13 | Reduced motion removes translateY on toast | RNTL mock | to verify in build |

## 9. Requirement -> screen -> check
| Req | Screen(s) | Checks |
|---|---|---|
| GATE-01 (manifest `minLevel`) | pills "Niv. N" source of truth, locked list | B-12 |
| GATE-02 (loader hides above level) | level1-locked (7 unlocked vs 12 locked), toast after level-up registers new plugins | B-06, B-07, B-10 |
| GATE-03 (no state row = minimum level, never zero access) | level1-locked is the floor state, all core Niv. 1 tiles present | B-12 |
| GATE-04 (drawer shows locked + how to unlock) | level1-locked, locked-alert, all-unlocked | B-02..B-05, B-08, B-09 |
