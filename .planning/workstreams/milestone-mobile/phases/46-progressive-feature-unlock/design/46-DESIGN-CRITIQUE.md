# Phase 46 - Design Critique (self critique + audit of the prototypes)

## What works
- The unlocked grid is untouched, so the new section reads as additive and the existing muscle memory survives.
- Hierarchy: divider, small header with current level, helper, then grey tiles. The next-level pill in primary tint answers "what comes next" without a progress widget.
- Locked tiles are still tappable and explain themselves, so nothing feels dead.

## Findings (audit)
| # | Severity | Finding | Action taken / proposed |
|---|---|---|---|
| F1 | Medium | Tile labels at 10px and "Niv." pills at 11px are below the 14px floor. Constrained by the 5-column grid (70px cells) and by the existing unlocked labels. | Waiver W-2; information repeated at 15px in the alert; Q2. |
| F2 | Medium | At level 1, 12 locked tiles (3 rows) outweigh 7 unlocked tiles visually, which may feel like "you have little". | Grey, low-contrast tiles and no per-row badges beyond the pill keep it quiet; Q1 offers grouping/collapse. |
| F3 | Low | Toast is `pointerEvents: none`, so it cannot link to the drawer. Duration extended to 4s to compensate. | Delta documented; Q4. |
| F4 | Low | Long plugin names truncate; manifest names are not designed for 70px cells. | Require `shortName` in the static source. |
| F5 | Low | Alert comes from `showAlert` (no custom icon assumed). The prototype shows the lock icon as CustomAlert's icon slot. | Verify the icon slot in build, else the alert is text-only. |
| F6 | Info | White-on-orange CTA contrast 3.09:1 inherited from CustomAlert (waiver W-1). | Same as Phase 45 Q2. |

Checked and clean: overflow, tap areas, non-text contrast (3.84, 4.73), 5-column geometry, emoji grep, empty-section handling.

## Open questions (max 5)
1. At low levels, show all locked tiles or group by level with only the next level expanded? Recommended: show all (matches D-04, simplest, transparent roadmap). Alternative: expand next level only, others behind "Voir la suite".
2. Raise drawer tile labels from 10px to 11-12px for both grids? Recommended: no, keep the unlocked grid unchanged per D-04 and accept W-2. Alternative: 11px for both (small change to a shared component).
3. Does `showAlert` support an icon, or is the lock glyph out of scope? Recommended: text-only alert if no icon slot (keep the title "Niveau N requis"). Alternative: extend `showAlert` with an optional icon.
4. Highlight newly unlocked tiles in the drawer (small dot until first open)? Recommended: no for v1.18 (toast is enough). Alternative: dot badge stored in MMKV.
5. Toast duration 4000ms instead of 2500ms and queued after the review overlay? Recommended: yes. Alternative: keep 2500ms with a one-line message only ("Niveau 2 : 6 modules débloqués").
