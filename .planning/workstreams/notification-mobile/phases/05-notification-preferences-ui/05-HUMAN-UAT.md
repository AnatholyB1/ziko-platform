---
status: partial
phase: 05-notification-preferences-ui
source: [05-VERIFICATION.md]
started: 2026-05-28T00:00:00Z
updated: 2026-05-28T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Master switch disabled state
expected: When `push_enabled` is toggled OFF, category rows render at opacity 0.4 and all touch events are blocked (pointerEvents none). Quiet hours section is not rendered. Toggling back ON restores full opacity and interactivity.
result: [pending]

### 2. Quiet hours InlinePicker bottom sheets
expected: Tapping "De" row opens start InlinePicker with 24 items "0h00"–"23h00". Tapping "À" row opens end InlinePicker. Selected hour is highlighted. Selecting an item closes the sheet and updates the row's right text. Both sheets dismiss on backdrop tap.
result: [pending]

### 3. Debounced auto-save confirmation
expected: Toggling any preference waits ~600ms then UPSERTs to notification_preferences. Rapid toggles only produce one DB write. Navigating away mid-debounce still saves (saveRef fires). Confirmed via Supabase dashboard row inspection.
result: [pending]

### 4. OS Settings CTA card
expected: On a device with notifications permission denied and canAskAgain = false, the "Réactiver les notifications" card appears at the top of the screen. Tapping it calls Linking.openSettings(). Card is absent when notifications are permitted.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
