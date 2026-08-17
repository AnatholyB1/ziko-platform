---
status: complete
phase: 03-marketing-content
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-03-26T21:30:00Z
updated: 2026-03-26T21:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Homepage loads in dev
expected: Run `npx next dev` from C:/ziko-web. Dev server starts and http://localhost:3000 loads without errors. Page is not blank.
result: pass

### 2. Sticky Header visible
expected: At the top of the page, a white sticky bar (56px tall) is visible with: "Ziko" in orange on the left, "FR | EN" locale switcher in the middle-right area, and an orange "Télécharger l'app" button on the far right.
result: pass

### 3. Header stays sticky on scroll
expected: When you scroll down the page, the Header remains fixed at the top of the viewport — content scrolls beneath it.
result: pass

### 4. FR↔EN language switch
expected: Clicking "EN" in the header navigates to /en/ and all page copy switches to English (headline: "Everything you need to level up", CTA: "Download the app"). Clicking "FR" returns to / with French copy.
result: pass

### 5. Hero section renders
expected: Below the header, a two-column section appears: LEFT column has the headline ("Tout ce dont vous avez besoin pour progresser"), a subline, and two orange buttons (App Store + Play Store). RIGHT column has a CSS phone frame (rounded rectangle with orange gradient inside, pill notch at top).
result: pass

### 6. Plugin Showcase — 5 categories, 17 plugins
expected: Below the hero, a section titled "Nos 17 plugins" (FR) / "Our 17 plugins" (EN) shows 5 category groups: Entraînement (5 plugins), Santé (4 plugins), Nutrition (2 plugins), Coaching & IA (5 plugins), Communauté (1 plugin). Each plugin card shows an icon, the plugin name, and a one-sentence description.
result: pass

### 7. Plugin descriptions match active locale
expected: In FR mode, plugin descriptions are in French (e.g., "Créez des séances Tabata, HIIT..."). In EN mode (/en/), descriptions switch to English (e.g., "Build Tabata, HIIT, EMOM..."). All 17 plugins show a description — no empty or missing text.
result: pass

### 8. Pricing section — free tier card
expected: Below the Plugin Showcase, a card displays with "Gratuit pour toujours" heading (FR) / "Free forever" (EN), the price "0€" in orange, 3 value props with orange checkmarks, and an orange "Télécharger gratuitement" / "Download for free" CTA button.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
