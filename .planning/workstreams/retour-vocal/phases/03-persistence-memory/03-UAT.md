---
status: complete
phase: 03-persistence-memory
workstream: retour-vocal
source:
  - 03-01-SUMMARY.md
  - 03-02-SUMMARY.md
  - 03-03-SUMMARY.md
started: 2026-05-27T00:00:00Z
updated: 2026-05-27T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running API server. Start it from scratch (`npm run backend` or `npm run dev` from project root). Server boots without errors, `/health` returns 200, and the new migration table `coach_vocal_feedbacks` is accessible (no startup crashes related to the new migration).
result: pass

### 2. Real Save — Feedback Persisted
expected: Complete a voice recording, let Claude structure it, then press [Sauvegarder]. The button shows a loading/saving state, then the card transitions to `card-saved` state (green checkmark / success message). The save is REAL — not a fake 500ms delay. Refreshing the page and coming back should show the saved feedback in history.
result: pass

### 3. Save Error Retry UX
expected: With the API server stopped (or by temporarily using an invalid endpoint), press [Sauvegarder]. The state returns to `card-ready` — the feedback card stays visible and the button is clickable again for retry. No stuck spinner. No blank screen.
result: pass

### 4. History Appears After Save
expected: After a successful save and the panel resets to idle ("Nouveau retour" state), a "Feedbacks précédents" section appears below the idle panel. It shows the just-saved feedback as the first entry. The section is NOT shown for an athlete who has no saved feedbacks yet.
result: pass

### 5. History Row Content
expected: Each row in "Feedbacks précédents" shows: (a) date in French format e.g. "27 mai 2026", (b) tag chips from the card (e.g. [force] [technique]), (c) ~100 chars of the card's context field as a preview text, (d) a "Voir le détail" expand affordance.
result: pass

### 6. Inline Expand — Full Card Read-Only
expected: Clicking "Voir le détail" on a history row opens the full 5-section card inline (Contexte, Points forts, Corrections, Prochaines étapes, Tags). All sections are in READ-ONLY mode — no edit controls, no tag toggles. Clicking again collapses the row.
result: pass

### 7. Single Row Expanded at a Time
expected: With two or more history entries, expand row 1. Then click to expand row 2. Row 1 collapses automatically — only row 2 remains expanded. It's never possible to have two rows expanded simultaneously.
result: pass

### 8. Memory Injection in Next Structure Call
expected: Save a feedback for athlete X. Then record a NEW voice note for the same athlete and press [Structurer]. Open browser DevTools → Network tab → find the `/api/coach/voice/structure` request. The request or server-side processing now includes the prior saved feedback in Claude's context. (Observable as: the structured card may reference prior session data, or you can check network payload.) If dev-tools access is unavailable, skip this test.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
