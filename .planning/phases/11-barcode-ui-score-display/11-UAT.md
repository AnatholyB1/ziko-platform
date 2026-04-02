---
status: complete
phase: 11-barcode-ui-score-display
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md]
started: "2026-04-02T12:45:00.000Z"
updated: "2026-04-02T15:30:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Barcode Tab Visible
expected: Open the Nutrition plugin → tap "+" to log a meal. The tab bar shows 4 tabs: Search | Scan | Barcode | Custom. The Barcode tab has a barcode icon next to its label.
result: pass

### 2. Camera Launches on Barcode Tab
expected: Tap the Barcode tab. Camera viewfinder opens with a semi-transparent dark overlay and a white rectangular reticle (approx 260×120px) centered on screen. Below the reticle: "Alignez le code-barres pour scanner" (FR) or "Align barcode to scan" (EN).
result: pass

### 3. Camera Permission Request
expected: First time tapping the Barcode tab (fresh install or permission not yet granted): OS permission dialog appears asking for camera access.
result: pass

### 4. Camera Permission Denied State
expected: If camera permission is denied: viewfinder is replaced by a camera icon + text "Accès à la caméra refusé. Activez-le dans Réglages > Ziko." (FR) or equivalent EN text.
result: pass

### 5. Scan a Barcode — Product Card Appears
expected: Point camera at an EAN-13 barcode (any food product). After auto-detection, the camera is replaced by a product card showing: product photo (or placeholder icon if no image), product name, brand, Nutri-Score badge pill (e.g. "NS B"), Eco-Score badge pill (e.g. "ES C"), macros per 100g grid (kcal, P, C, F).
result: pass

### 6. Serving Size Adjuster + Real-Time Macros
expected: On the product card, serving size section shows quick-select chips [50, 100, 150, 200g] and a stepper row ([-5] input [+5]). Tapping a chip or changing the value updates the "scaled macros" row at the bottom of the card in real time (e.g. changing from 100g to 200g doubles all values).
result: pass

### 7. Log This Meal from Barcode
expected: Tap "Enregistrer ce repas" / "Log this meal". Entry is saved and the log meal screen closes (or returns to the nutrition journal). The new entry appears in today's journal.
result: pass

### 8. Enter Manually from Product Card
expected: Tap "Saisir manuellement" / "Enter manually" on the product card. The Custom tab opens pre-filled with the product's values at the current serving size.
result: pass

### 9. Product Not Found State
expected: Scan a barcode that is NOT in the Open Food Facts database (or use a non-food barcode). Screen shows: barcode icon, "Produit introuvable" / "Product not found", the scanned barcode number, and two buttons: primary "Enter manually" + secondary "Scan again".
result: pass

### 10. Scan Again
expected: From product card or not-found state, tap "Scanner à nouveau" / "Scan again". Camera viewfinder returns and a new scan can be performed.
result: pass

### 11. Score Badges on Journal Rows (Barcode Entries)
expected: After logging a meal via barcode (Test 7), go to the Nutrition dashboard. The journal entry for that meal shows two small colored pill badges between the food name and the calorie count: one for Nutri-Score (e.g. "NS B" in green/yellow) and one for Eco-Score (e.g. "ES C" in orange).
result: pass

### 12. Manual Entries — No Badges
expected: A meal logged manually (via Search, Scan AI, or Custom tabs) shows no badge pills — just the food name and calorie count as before. No visual regression.
result: pass

### 13. Daily Average Nutri-Score Widget
expected: On the Nutrition dashboard, after logging at least one barcode meal today: a new card appears between the macros row and the TDEE Calculator link. It shows a medium Nutri-Score badge + "Nutri-Score moyen" / "Average Nutri-Score" title + "sur X repas scannés" / "from X scanned meals" subtitle.
result: pass

### 14. Widget Hidden When No Barcode Meals
expected: On a day with zero barcode-scanned meals (all manual entries), the daily average Nutri-Score widget does NOT appear on the dashboard — the macros row flows directly into the TDEE Calculator link with no gap or empty card.
result: pass

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
