---
status: partial
phase: 02-upload-ux-pipeline
source: [02-VERIFICATION.md]
started: 2026-05-30T13:50:00Z
updated: 2026-05-30T13:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. IA bubble visual rendering
expected: Orange "IA" avatar with notched speech bubble renders on Step 4 load with greeting text

result: approved

### 2. Drag-over visual state
expected: Orange border + tinted background on drag-over, reverts on drag-leave

result: [pending]

### 3. 4-file cap visual
expected: Drop zone dims, label changes to cap message, browse button disabled at 4 files

result: [pending]

### 4. Status pill progression
expected: Blue "Envoi…" → orange "Analyse…" → green "✓ Prêt" or red "Erreur" with spinner during live pipeline

result: [pending]

### 5. File removal mid-pipeline
expected: File disappears, no console errors, interval cleaned up, drop zone re-enables

result: [pending]

## Summary

total: 5
passed: 1
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
