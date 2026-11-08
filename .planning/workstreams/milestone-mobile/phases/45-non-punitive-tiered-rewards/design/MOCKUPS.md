# Phase 45 mockups index

Static HTML + `tokens.css`, rendered with headless Chromium, 390x844 viewport, DPR2 (780x1688 PNG), reduced-motion on for capture. Glyphs are Ionicons 7 SVGs inlined from the `ionicons` package.

| State | HTML | PNG |
|---|---|---|
| Objectif atteint | `met.html` | `met.png` |
| Objectif dépassé | `exceeded.html` | `exceeded.png` |
| Semaine d'ajustement (missed) | `missed.html` | `missed.png` |
| Palier atteint, step 2 (reward follows) | `tier-up.html` | `tier-up.png` |
| Récompense, step 3 | `reward.html` | `reward.png` |
| Palier atteint sans récompense | `no-reward.html` | `no-reward.png` |

Also: `45-DESIGN-CONTRACT.md`, `45-DESIGN-CRITIQUE.md`, `measure.js` (re-render + checks), `measure-results.json`.
Re-render: `node measure.js <this dir>` with `playwright-core` installed and `CHROMIUM_PATH` set if the default path differs.
Gallery covering 45 and 46: `../../design-gallery-45-46.html`.
