# Phase 1: Infrastructure & Configuration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 1-infrastructure-configuration
**Areas discussed:** Pre-permission screen, Hook entry point, notificationService.ts scope, Android FCM setup

---

## Pre-permission Screen

### Q1: Screen structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single headline + 3 examples | Headline + 3 notification example cards (Coach, Streak, Level-up). Sport card style. | ✓ |
| Value list (4 bullet lines) | Short paragraph + 4 bullet benefits. Text-heavy, no visual cards. | |

**User's choice:** Single headline + 3 examples (Recommended)
**Notes:** Layout matches app's card-based visual style with `#FF5C1A` theme.

### Q2: Skip ("Plus tard") behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Deferred — ask next launch | MMKV `notification_perm_skipped`, resets on restart, screen reappears next time. | ✓ |
| Permanent — goes to Settings CTA | Once skipped, pre-perm screen never shown again. Settings CTA instead. | |

**User's choice:** Deferred — ask next launch (Recommended)

### Q3: Max skip count

| Option | Description | Selected |
|--------|-------------|----------|
| Stop after 3 skips | `notification_skip_count` int in MMKV. After 3: show Settings CTA only. | ✓ |
| Always show until granted or OS-denied | Show every launch until permission granted or `canAskAgain = false`. | |

**User's choice:** Stop after 3 skips (Recommended)

---

## Hook Entry Point

### Q1: Where useNotificationSetup mounts

| Option | Description | Selected |
|--------|-------------|----------|
| Root auth layout — app/(app)/_layout.tsx | Hook fires every authenticated start. Standard location alongside authStore. | ✓ |
| Dedicated onboarding step (step-5) | Only first-time users prompted. Returning users never see it unless they visit Settings. | |

**User's choice:** Root auth layout (Recommended)

### Q2: Pre-permission screen presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen modal overlay | RN Modal over app layout. Immediate, no navigation transition, no back-nav edge cases. | ✓ |
| Expo Router push to /notifications/permission | Dedicated route. Adds back-navigation edge case, needs extra guard logic. | |

**User's choice:** Full-screen modal overlay (Recommended)

---

## notificationService.ts Scope

### Q1: Completeness in Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Full production service | Prefs check + token fetch + chunking ≤100 + idempotency + notification_log write. Phase 2 calls directly. | ✓ |
| Minimal skeleton | Just send path. No prefs/chunking/log. Phase 2 adds the rest. | |

**User's choice:** Full production service (Recommended)

### Q2: Quiet hours enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — quiet hours check inline | Reads `quiet_hours_start/end` from prefs, suppresses send if in window. Phase 5 sets UI. | ✓ |
| No — defer to Phase 5 | Phase 1 ignores quiet hours. Phase 5 adds it. | |

**User's choice:** Yes — quiet hours check inline (Recommended)

---

## Android FCM Setup

### Q1: google-services.json location

| Option | Description | Selected |
|--------|-------------|----------|
| EAS secret — not in the repo | `eas secret:create --type file`. Injected at EAS build time. Never in git. | ✓ |
| Committed to repo | Public config file, no private keys. Simpler for local builds. Many projects do this. | |

**User's choice:** EAS secret — not in the repo (Recommended)

### Q2: iOS APNs key status

| Option | Description | Selected |
|--------|-------------|----------|
| Already configured — EAS handles it | APNs key in App Store Connect. EAS auto-manages. No action needed. | ✓ |
| Not yet configured — needs setup | APNs key generation and EAS upload needed before first build. | |

**User's choice:** Already configured — EAS handles it

---

## Claude's Discretion

None — all areas had clear user direction.

## Deferred Ideas

None — discussion stayed within phase scope.
