---
status: partial
phase: 25-invitations-mobile-mon-coach-minimal
source: [25-VERIFICATION.md]
started: 2026-05-17T16:00:33Z
updated: 2026-05-17T16:00:33Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Pixel-perfect visual UAT — Phase 25 surfaces (Ziko-Screens.html)
expected: /fr/coach/invitations + /fr/redeem (States A/B/C) + revoke modal render pixel-for-pixel matching the canonical mockup at .planning/mockups/Ziko-Screens.html
result: [pending]

### 2. Pixel-perfect visual UAT — Phase 24 refonte surfaces (Ziko-Onboarding.html)
expected: /fr/login + 3-step onboarding wizard (Role/Profile/KYC) + /fr/coach/dashboard + /fr/coach/settings render pixel-for-pixel matching .planning/mockups/Ziko-Onboarding.html
result: [pending]

### 3. Clipboard copy buttons in InvitationCodeCard work in real browsers
expected: "Copier le code" and "Copier le lien" both copy correct values across Chrome/Firefox/Safari (Clipboard API requires user-gesture + secure context)
result: [pending]

### 4. Revoke confirm modal — focus trap + Escape key dismissal
expected: Tab cycle stays inside modal; Escape closes; backdrop click closes; first input receives focus on open
result: [pending]

### 5. Deep-link unauthenticated round-trip
expected: Logged-out browser hitting /fr/r/ABC234 → /fr/login?next=%2Fr%2FABC234 → after login, lands back at /fr/r/ABC234 with code prefilled and preview auto-runs
result: [pending]

### 6. Coach photo signed-URL renders and expires after TTL
expected: Preview card shows coach photo; URL works at t=0 and 4min; URL fails at t=6min+ (5-min TTL from coach-kyc bucket)
result: [pending]

### 7. Full 10-step browser smoke for /coach/invitations
expected: Coach can generate code → InvitationCodeCard appears → table updates → filter chips work → revoke modal flow completes end-to-end
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
