---
phase: 05-notification-preferences-ui
verified: 2026-05-28T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Toggle master switch OFF — observe category rows become visually dimmed and non-interactive"
    expected: "Category rows show at 0.4 opacity and cannot be tapped; quiet hours section disappears from view"
    why_human: "opacity + pointerEvents visual behavior cannot be verified by static grep; requires device/simulator render"
  - test: "Tap 'De' or 'À' quiet hours row while master switch is ON — InlinePicker bottom sheet opens"
    expected: "Bottom sheet slides up with 24 hour items formatted '0h00'–'23h00'; selected hour is bold with orange checkmark"
    why_human: "Modal display and interaction requires runtime to verify"
  - test: "Toggle any preference — wait 600ms — verify row is persisted in Supabase notification_preferences"
    expected: "After ~600ms, the changed column value appears in the database row for the test user"
    why_human: "Debounced async UPSERT requires live Supabase connection and timing verification"
  - test: "Revoke push permission in OS settings, return to app, navigate to Notifications screen"
    expected: "'Réactiver les notifications' card appears at top of screen; tapping it opens OS Settings"
    why_human: "Requires real device + OS permission state manipulation"
---

# Phase 5: Notification Preferences UI — Verification Report

**Phase Goal:** Complete Notification Preferences UI — NotifSubScreen in settings.tsx fully replaces the old user_profiles data layer with notification_preferences, providing master switch, 5 category toggles, quiet hours pickers, and 600ms debounced auto-save.
**Verified:** 2026-05-28
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On mount, a row always exists in notification_preferences for the user (UPSERT defaults with ignoreDuplicates=true runs before the first toggle) | VERIFIED | `ignoreDuplicates: true` confirmed at line 84; mount UPSERT with all 8 default column values at lines 70–85 |
| 2 | All preference changes are persisted to notification_preferences via 600ms debounced UPSERT — no Save button exists, no change is lost on navigation | VERIFIED | `handleChange` at lines 110–134: `clearTimeout(saveRef.current)` + `setTimeout(..., 600)` with full UPSERT; no Save button in file |
| 3 | The push_enabled master switch state reflects the real value from notification_preferences.push_enabled | VERIFIED | State loaded from SELECT at lines 86–101: `push_enabled: data.push_enabled ?? true`; bound to STRow `toggleValue={s.push_enabled}` at line 192 |
| 4 | Each UPSERT includes timezone_offset auto-detected via Math.round(-new Date().getTimezoneOffset() / 60) | VERIFIED | Two occurrences confirmed: line 68 (mount UPSERT) and line 114 (handleChange save UPSERT) |
| 5 | User can toggle push_enabled (master switch) and category rows are immediately disabled (opacity 0.4 + pointerEvents none) while quiet hours section is hidden | VERIFIED (code) | Line 197: `style={{ opacity: s.push_enabled ? 1 : 0.4 }} pointerEvents={s.push_enabled ? 'auto' : 'none'}` on category wrapper; line 237: `{s.push_enabled && (` wraps quiet hours group — runtime behavior requires human |
| 6 | User can independently toggle 5 category rows: Coach, Workout, Gamification, Santé & Habitudes, App | VERIFIED | Lines 199–234: all 5 STRow items with toggleValue and onToggle wired to handleChange with correct column keys |
| 7 | User can set quiet hours start and end via InlinePicker bottom sheets showing 24 items formatted as '0h00' through '23h00' | VERIFIED (code) | Lines 136–139: HOUR_ITEMS defined inside function, `Array.from({ length: 24 }` producing `${i}h00` labels; two InlinePicker instances at lines 257–278 with correct handlers |
| 8 | No Save button exists; all changes persist via the 600ms debounce inherited from Plan 01's handleChange | VERIFIED | No Save button component or text in NotifSubScreen; all toggles and pickers call handleChange only |

**Score:** 8/8 truths verified (runtime behavior for truths 5, 6, 7 requires human device testing)

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mobile/app/(app)/profile/settings.tsx` | Rewritten NotifSubScreen with notification_preferences data layer and complete UI | VERIFIED | File exists, 800 lines, contains all required patterns; NotifSubScreen at lines 40–281 |
| `packages/ui/src/components/STGroup.tsx` | STGroup title prop made optional to support untitled master switch group | VERIFIED | `title?: string` (optional) at line 7; `{title !== undefined && (...)}` conditional at line 16 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| NotifSubScreen state (s.push_enabled) | notification_preferences.push_enabled | Supabase direct UPSERT | WIRED | `supabase.from('notification_preferences')` appears 3 times (mount UPSERT, mount SELECT, save UPSERT) |
| STRow toggleValue prop (master switch) | s.push_enabled | `handleChange({ push_enabled: v })` | WIRED | Line 192–193: `toggleValue={s.push_enabled}` + `onToggle={(v) => handleChange({ push_enabled: v })}` |
| InlinePicker onSelect (quiet hours start) | s.quiet_hours_start | `handleChange({ quiet_hours_start: parseInt(id, 10) })` | WIRED | Line 262: `handleChange({ quiet_hours_start: parseInt(id, 10) })` |
| InlinePicker onSelect (quiet hours end) | s.quiet_hours_end | `handleChange({ quiet_hours_end: parseInt(id, 10) })` | WIRED | Line 273: `handleChange({ quiet_hours_end: parseInt(id, 10) })` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| NotifSubScreen | `s` (8 preference keys) | `supabase.from('notification_preferences').select(...)` at lines 86–90 | Yes — SELECT from real DB table; fallback to defaults only if no row | FLOWING |
| handleChange | `next` (merged patch state) | Debounced UPSERT writes merged state back to `notification_preferences` | Yes — full UPSERT with all 8 columns + timezone_offset | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — NotifSubScreen requires a running Expo app and Supabase connection. No headless entry point exists for this React Native component.

---

### Probe Execution

Step 7c: No probe scripts declared or found for this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PREF-01 | 05-01, 05-02 | Master switch to enable/disable all push notifications | SATISFIED | `push_enabled` toggle STRow at line 188–194; bound to notification_preferences column via handleChange |
| PREF-02 | 05-01, 05-02 | Per-category toggles: Coach, Workout, Gamification, Santé & Habitudes, App | SATISFIED | 5 STRow items at lines 199–234 with correct column bindings |
| PREF-03 | 05-02 | Quiet hours (start + end) with InlinePicker | SATISFIED | STGroup "Heures silencieuses" at lines 238–254; two InlinePicker instances; 24-item HOUR_ITEMS array |
| PREF-04 | 05-01 | Auto-save to notification_preferences, no Save button | SATISFIED | handleChange with 600ms debounce at lines 110–134; no Save button anywhere in NotifSubScreen |

All 4 phase requirements confirmed covered by both plans and implemented in the final file.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/mobile/app/(app)/profile/settings.tsx` | 770 | `// TODO: remplacer par l'ID App Store réel` | INFO | Pre-existing marker in `SettingsScreen` function, outside `NotifSubScreen`; not introduced by this phase (present before commit c55fbf6); no phase 5 code path touches line 770 |

The TODO at line 770 is a pre-existing App Store ID placeholder in the `SettingsScreen` function (the main settings list). It was not modified by any phase 5 commit (c55fbf6, 3cefcf8, ba1a1fc). It does not reference a formal issue but is in code that this phase was not responsible for. Not a blocker for phase 5 goal assessment.

---

### Human Verification Required

#### 1. Master switch disabled state (visual + interaction)

**Test:** Open Notifications screen on device/simulator. Toggle "Toutes les notifications" to OFF.
**Expected:** The five category rows (Coach, Workout, Gamification, Santé & Habitudes, App) dim to 40% opacity and become non-interactive. The "Heures silencieuses" section disappears entirely from the scroll view.
**Why human:** `opacity` and `pointerEvents` behaviour cannot be confirmed by static code analysis; rendering requires a native runtime.

#### 2. Quiet hours InlinePicker bottom sheet

**Test:** Ensure master switch is ON. Tap the "De" row (quiet hours start). Repeat for "À" row.
**Expected:** A bottom sheet slides up from the bottom showing 24 items labelled "0h00" through "23h00". The currently selected hour is displayed in bold with an orange checkmark. Selecting an item closes the sheet and updates the row's right text immediately.
**Why human:** Modal animation, item rendering at 24 items, and picker close-on-select require visual runtime verification.

#### 3. Debounced auto-save to Supabase

**Test:** Toggle any category preference. Wait approximately 600–700ms. Query `notification_preferences` in Supabase Dashboard for the test user.
**Expected:** The changed column value is persisted in the database row within 600ms after the last user interaction. No explicit save action was taken.
**Why human:** Requires live Supabase connection, timed inspection of DB row, and no UI feedback exists to confirm save (fire-and-forget pattern by design).

#### 4. OS Settings CTA when permission denied

**Test:** On a real device, deny push notification permission (or set to "denied" in iOS Settings). Navigate to Settings > Notifications.
**Expected:** A white card with "Réactiver les notifications" title and "Les notifications sont bloquées — ouvrir les réglages système" subtitle appears at the top. Tapping the card opens OS Settings.
**Why human:** Requires OS permission state manipulation and real `Notifications.getPermissionsAsync()` behaviour; cannot be mocked in static analysis.

---

### Gaps Summary

No gaps. All 8 must-have truths are verified in the codebase. Both plans' artifacts are fully implemented and wired. All 4 PREF requirements have implementation evidence. Status is `human_needed` because 4 UI/runtime behaviors require device testing to confirm end-to-end correctness — the code evidence is complete, but visual rendering, modal animation, OS permission state, and async persistence cannot be verified without running the app.

---

_Verified: 2026-05-28_
_Verifier: Claude (gsd-verifier)_
