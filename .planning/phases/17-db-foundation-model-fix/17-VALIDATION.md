---
phase: 17
slug: db-foundation-model-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — Phase 17 verification is SQL-based + type-check based |
| **Config file** | none — no test framework needed for this phase |
| **Quick run command** | `rtk tsc` in `backend/api/` |
| **Full suite command** | `rtk tsc` + grep audit + Supabase SQL verification |
| **Estimated runtime** | ~10 seconds (type-check only) |

---

## Sampling Rate

- **After every task commit:** Run `rtk tsc` in `backend/api/` — catches import path errors immediately
- **After every plan wave:** Run `rtk tsc` + grep audit for old model IDs
- **Before `/gsd:verify-work`:** All manual verification SQL queries pass in Supabase SQL Editor
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | COST-01 | unit | `grep -r 'claude-haiku-4-5-20251001' backend/api/src/config/models.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | COST-01 | unit | `grep -rn "anthropic('" backend/api/src/routes backend/api/src/tools` (expect 0 inline) | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | All | smoke | `npm run type-check` in `backend/api/` | ✅ exists | ⬜ pending |
| 17-02-01 | 02 | 1 | CRED-06 | manual-only | Supabase SQL Editor: verify `user_ai_credits` table + RLS | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | CRED-06 | manual-only | Supabase SQL Editor: `deduct_ai_credits` with balance=0 returns error | ❌ W0 | ⬜ pending |
| 17-02-03 | 02 | 1 | CRED-07 | smoke | `npm run type-check` (schema types) | ✅ exists | ⬜ pending |
| 17-02-04 | 02 | 1 | PREM-01 | manual-only | Supabase SQL Editor: `SELECT tier FROM user_profiles LIMIT 5` returns 'free' | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/api/src/config/models.ts` — file does not exist yet (created in this phase)
- [ ] `supabase/migrations/026_ai_credits.sql` — does not exist yet (created in this phase)
- [ ] Vitest not installed — not required for Phase 17 (SQL-based + type-check verification)

*Existing infrastructure (`npm run type-check`) covers automated verification needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `deduct_ai_credits` RPC returns `{ success: false }` when balance = 0 | CRED-06 | Requires live Supabase instance | Run migration → SQL Editor: `SELECT deduct_ai_credits(user_id, 1, 'test', 'test-key')` with 0 balance |
| `CHECK (balance >= 0)` rejects negative | CRED-06 | Requires live Supabase | SQL Editor: `UPDATE user_ai_credits SET balance = -1 WHERE ...` should fail |
| `user_profiles.tier` defaults to 'free' | PREM-01 | Requires live Supabase | SQL Editor: `SELECT tier FROM user_profiles LIMIT 5` all return 'free' |
| Welcome credits for existing users | CRED-07 | Requires live Supabase | SQL Editor: `SELECT count(*) FROM user_ai_credits` matches `SELECT count(*) FROM user_profiles` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
