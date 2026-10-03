---
phase: 1
slug: oauth-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none configured for `apps/mobile` (no vitest/jest config, no test script, no test files — consistent with the rest of the mobile app per `.planning/codebase/STACK.md`) |
| **Config file** | none |
| **Quick run command** | n/a |
| **Full suite command** | n/a |
| **Estimated runtime** | n/a |

---

## Sampling Rate

- **After every task commit:** N/A — no automated suite exists for `apps/mobile`
- **After every plan wave:** manual EAS build verification (build succeeds on both platforms)
- **Before `/gsd:verify-work`:** all 5 ROADMAP.md success criteria manually confirmed, including a
  live disposable-account linking test (D-05 constraint — no safe staging project, so this cannot be
  faked or skipped)
- **Max feedback latency:** N/A (manual-only phase)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-* | 01 | 1 | OAUTH-08 | — | iOS build embeds `com.apple.developer.applesignin` | manual | inspect EAS build artifact/logs after `eas build --profile production --platform ios` | ❌ manual-only | ⬜ pending |
| 01-01-* | 01 | 1 | OAUTH-09 | Malicious app impersonation (Android) | Android OAuth client registered, SHA-1 wired to the real EAS-managed release keystore | manual | `GoogleSignin.hasPlayServices()` resolves without throwing on a real device/build | ❌ manual-only | ⬜ pending |
| 01-02-* | 01 | 2 | OAUTH-10 | Pre-account takeover via unverified email linking | Supabase providers enabled with correct client IDs; automatic linking verified live | manual (checkpoint) | live test: sign up with email/password using a disposable email, then sign in with Google/Apple sharing that same email, confirm one user record results | ❌ manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — no mobile test framework exists project-wide,
and setting one up is out of scope for this phase (pure infra/config, nothing unit-testable). Flag as
a future-phase candidate if `apps/mobile` ever needs automated coverage; not blocking here since every
requirement in this phase is manual-only by nature (dashboard config + native build config).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS entitlement present in shipped build | OAUTH-08 | Entitlements are only observable in a real signed build artifact, not in source | Run `eas build --profile production --platform ios`, inspect the build's entitlements (via EAS build details or a downloaded `.ipa`) for `com.apple.developer.applesignin` |
| Android OAuth client resolves against real SHA-1 | OAUTH-09 | Requires a real signed Android build hitting Google's servers — cannot be simulated | Run `eas build --profile production --platform android`, install on a device, call `GoogleSignin.hasPlayServices()` / attempt a real sign-in, confirm no `DEVELOPER_ERROR` (SHA-1 mismatch) |
| Supabase provider config + automatic linking | OAUTH-10 | Requires live Supabase Auth dashboard state and a real identity-linking event — no local emulation | Sign up with a disposable email via email/password, then sign in with a Google or Apple account sharing that exact verified email; confirm Supabase shows one linked user (two identities), not two separate users |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — N/A, all manual by nature, documented above
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — N/A, phase has no automatable tasks project-wide
- [x] Wave 0 covers all MISSING references — nothing missing, no test framework needed for this phase's scope
- [x] No watch-mode flags
- [x] Feedback latency < N/A — manual-only phase, EAS build time is the natural feedback loop
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
