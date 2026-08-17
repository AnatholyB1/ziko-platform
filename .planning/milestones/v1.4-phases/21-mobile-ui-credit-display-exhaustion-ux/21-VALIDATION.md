---
phase: 21
slug: mobile-ui-credit-display-exhaustion-ux
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — React Native/Expo project with no unit test framework configured |
| **Config file** | none — TypeScript checking serves as automated gate |
| **Quick run command** | `npm run type-check` |
| **Full suite command** | `npm run type-check` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run type-check`
- **After every plan wave:** Run `npm run type-check` + manual smoke on Expo dev server
- **Before `/gsd-verify-work`:** Full type-check must be green + all manual smoke tests pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | CRED-05, EARN-09 | T-21-03 | earned_today query scoped to user_id + today's date | grep | `grep -n "earned_today" backend/api/src/middleware/creditGate.ts` | N/A | pending |
| 21-01-01 | 01 | 1 | CRED-04 | — | N/A | grep | `grep "chat: 4" apps/mobile/src/lib/creditCosts.ts` | N/A | pending |
| 21-01-02 | 01 | 1 | CRED-01 | T-21-01 | Balance display-only, no server-side effect | grep | `grep "useCreditStore" apps/mobile/src/stores/creditStore.ts` | N/A | pending |
| 21-01-02 | 01 | 1 | EARN-08 | T-21-05 | Toast is visual only, no balance mutation | grep | `grep "toastVisible" apps/mobile/src/components/CreditEarnToast.tsx` | N/A | pending |
| 21-01-02 | 01 | 1 | CRED-05 | T-21-02 | earned_today contains only source strings, no PII | grep | `grep "EARN_ACTIVITIES" apps/mobile/src/components/CreditExhaustionSheet.tsx` | N/A | pending |
| 21-02-01 | 02 | 2 | CRED-01 | — | N/A | grep | `grep "useCreditStore" apps/mobile/app/\(app\)/ai/index.tsx` | N/A | pending |
| 21-02-01 | 02 | 2 | CRED-04 | T-21-04 | Cost labels are display-only | grep | `grep "CREDIT_COSTS" apps/mobile/app/\(app\)/ai/index.tsx` | N/A | pending |
| 21-02-01 | 02 | 2 | CRED-05 | T-21-06 | 402 parsed locally, no cross-user data | grep | `grep "showExhaustionSheet" apps/mobile/app/\(app\)/ai/index.tsx` | N/A | pending |
| 21-02-02 | 02 | 2 | CRED-01 | — | N/A | grep | `grep "credits IA" plugins/gamification/src/screens/GamificationDashboard.tsx` | N/A | pending |
| 21-02-02 | 02 | 2 | CRED-04 | T-21-04 | Inline constants, display-only | grep | `grep "CREDIT_COSTS" plugins/ai-programs/src/screens/GenerateProgram.tsx` | N/A | pending |
| 21-02-02 | 02 | 2 | EARN-08 | T-21-05 | Toast triggered only when credited=true | grep | `grep -c "showEarnToast" plugins/*/src/screens/*.tsx apps/mobile/src/stores/workoutStore.ts` | N/A | pending |
| 21-02-02 | 02 | 2 | EARN-09 | — | N/A | grep | `grep "dailyEarned" plugins/gamification/src/screens/GamificationDashboard.tsx` | N/A | pending |

*Status: pending -- waiting for execution*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework needed.

- [x] TypeScript type-check (`npm run type-check`) already configured in project
- [x] `apps/mobile/src/lib/creditCosts.ts` must export typed const matching backend `CREDIT_COSTS` — type-check catches mismatches

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Balance chip visible in AI chat header | CRED-01 | Visual rendering requires runtime | `npx expo start` -> navigate to AI tab -> verify gold flash icon + number in header row |
| Dual-balance card on gamification dashboard | CRED-01 | Visual rendering requires runtime | Navigate to gamification -> verify coins and credits side-by-side with distinct icons |
| Cost labels on 3 buttons | CRED-04 | Visual rendering requires runtime | Check AI chat send (4 lightning), AI Programs generate (4 lightning), Nutrition scan (3 lightning) |
| Exhaustion sheet on 402 | CRED-05 | Requires zero-balance test account | Set balance to 0 -> send AI message -> verify bottom sheet with activity checklist |
| Earn toast after activity | EARN-08 | Requires end-to-end activity log | Log a meal -> verify "+1 AI credit earned!" toast appears and auto-dismisses |
| Daily earn progress display | EARN-09 | Visual rendering requires runtime | Check gamification dashboard -> verify "X / 4 bonus credits earned today" text |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
