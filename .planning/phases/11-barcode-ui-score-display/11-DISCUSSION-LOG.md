# Phase 11: Barcode UI + Score Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 11-barcode-ui-score-display
**Areas discussed:** Tab structure, Scanner UX, Serving size adjuster, Score badge style

---

## Tab Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 4th tab: add Barcode tab | Keep all 3 existing tabs, add Barcode as 4th. Layout: search \| AI Scan \| Barcode \| Custom | ✓ |
| Replace: rename Scan → Barcode | Remove AI photo scan tab, replace with Barcode. 3-tab layout. | |
| Replace + keep Photo as separate flow | Rename scan tab to Barcode, move photo AI into Custom tab as option. | |

**User's choice:** 4th tab — keep existing tabs unchanged, add Barcode as the 4th option.
**Notes:** None.

---

## Scanner UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen camera with overlay | CameraView fills tab, reticle overlay, auto-detects on scan. Product card appears below. | ✓ |
| Tap-to-scan button opens modal | Tab shows a button; tap opens full-screen camera modal; modal closes after scan. | |

**User's choice:** Full-screen camera with overlay — auto-detect, no tap required.
**Notes:** None.

---

## Serving Size Adjuster

| Option | Description | Selected |
|--------|-------------|----------|
| ± stepper with preset chips | Chips [50g][100g][150g][200g] + [-5][input][+5] stepper. Real-time macro rescale. | ✓ |
| Plain text input only | Single TextInput prefilled with serving_size_g. | |
| Slider | Horizontal slider 10–500g. | |

**User's choice:** ± stepper with preset chips.
**Notes:** None.

---

## Score Badge Style

| Option | Description | Selected |
|--------|-------------|----------|
| Compact colored pill | [NS A] / [ES B] pill, grade-colored background, consistent across all surfaces. | ✓ |
| French NutriScore scale graphic | Full 5-letter scale with selected letter highlighted. Product card only — needs fallback elsewhere. | |

**User's choice:** Compact colored pill — used everywhere at different sizes.
**Notes:** None.

---

## Claude's Discretion

- Exact reticle overlay implementation
- i18n key naming
- Camera aspect ratio / fill mode
- Loading skeleton during API fetch
- Exact padding/border-radius values

## Deferred Ideas

None.
