---
phase: 35
plan: G02
subsystem: mobile-profile
tags: [bugfix, auth, password-change, ux]
dependency_graph:
  requires: [35-G01]
  provides: [reliable-password-change]
  affects: [apps/mobile/app/(app)/profile/security.tsx]
tech_stack:
  added: []
  patterns: [try-catch-finally, client-side-validation]
key_files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/security.tsx
decisions:
  - "Used try/catch/finally to guarantee setSaving(false) runs regardless of Supabase result or thrown error"
  - "Added inline min-length counter inside card (marginHorizontal: 52 aligns with input text column)"
  - "Pre-existing useRef TS2554 error on line 62 is out of scope (introduced by G01 debounceRef)"
metrics:
  duration: 8m
  completed: "2026-05-23"
  tasks_completed: 2
  files_modified: 1
---

# Phase 35 Plan G02: Password Change — Fix Infinite Spinner Summary

**One-liner:** Fixed infinite spinner in password change by wrapping Supabase `updateUser` in try/catch/finally so `setSaving(false)` is guaranteed, plus added client-side length/match validation and an inline character counter.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix savePassword handler with finally block | b0f9f42 | security.tsx |
| 2 | Add inline min-length indicator below password input | b0f9f42 | security.tsx |

## What Changed

### Task 1 — Robust savePassword handler

Replaced `handleSavePassword` (no finally block — spinner stuck on network error) with `savePassword`:

- `finally { setSaving(false) }` guarantees spinner stops on any code path
- `if (error) throw error` converts Supabase result-style error into a thrown exception caught by `catch`
- Client-side validation runs before any network call: length >= 8 check, confirmation match check
- Fields cleared (`setNewPwd('')`, `setConfirmPwd('')`) only on success
- Error catch uses `err.message ?? 'Impossible de modifier le mot de passe.'` fallback

### Task 2 — Inline min-length indicator

Added dynamic hint directly inside the card, between the new password input row and the separator:

```tsx
{newPwd.length > 0 && newPwd.length < 8 && (
  <Text style={{ fontSize: 11, color: '#E94B3C', marginTop: 4, marginHorizontal: 52 }}>
    Minimum 8 caractères ({newPwd.length}/8)
  </Text>
)}
```

`marginHorizontal: 52` aligns the text with the input column (icon width 32 + gap 8 + padding 12 = 52).

## Deviations from Plan

None — plan executed exactly as written. The existing inline `pwdTooShort` and `pwdMismatch` indicators below the card were retained as complementary UX (they appear after the user starts typing in the confirmation field).

## Known Stubs

None.

## Threat Flags

None — no new network surface introduced.

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/security.tsx` — modified, exists
- Commit `b0f9f42` — confirmed in git log
- Pre-existing TS errors (6 total across 5 files) are unrelated to this plan's changes
