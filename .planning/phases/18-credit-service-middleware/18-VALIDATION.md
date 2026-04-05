---
phase: 18
slug: credit-service-middleware
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already in monorepo) |
| **Config file** | backend/api/vitest.config.ts (may need creation — Wave 0) |
| **Quick run command** | `rtk vitest run --reporter=verbose backend/api/src/services/__tests__/creditService.test.ts` |
| **Full suite command** | `rtk vitest run --reporter=verbose backend/api/src/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command (creditService tests)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | CRED-02, CRED-03 | unit | `rtk vitest run backend/api/src/config/__tests__/credits.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | EARN-07, EARN-10 | unit | `rtk vitest run backend/api/src/services/__tests__/creditService.test.ts` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | PREM-02 | unit | `rtk vitest run backend/api/src/middleware/__tests__/creditGate.test.ts` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 2 | SC4, SC5 | integration | `rtk vitest run backend/api/src/middleware/__tests__/creditGate.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/api/vitest.config.ts` — vitest config if not present
- [ ] `backend/api/src/services/__tests__/creditService.test.ts` — stubs for getBalance, earnCredits, getDailyUsage
- [ ] `backend/api/src/middleware/__tests__/creditGate.test.ts` — stubs for creditCheck 402, creditDeduct on-success
- [ ] `backend/api/src/config/__tests__/credits.test.ts` — stubs for CREDIT_COSTS and DAILY_QUOTAS constants

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concurrent deduct under load | SC4+SC5 | Requires multiple simultaneous Supabase RPC calls against real DB | Deploy to staging, fire 10 concurrent scan requests with 1 credit balance, verify exactly 1 succeeds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
