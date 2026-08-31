---
phase: 42
slug: decision-system-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.2.4 (`backend/api`) |
| **Config file** | `backend/api/vitest.config.ts` |
| **Quick run command** | `npm run test:rls` (from `backend/api/`) — runs `vitest run test/rls --passWithNoTests` |
| **Full suite command** | `npm test` (from `backend/api/`) — `vitest run --passWithNoTests` |
| **Estimated runtime** | ~10-20 seconds (quick), ~60-90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:rls` (fast — only the 2-4 new spec files; `--passWithNoTests` keeps it safe before the first spec file lands)
- **After every plan wave:** Run `npm test` (full backend suite — ensures no regression to existing RLS specs, e.g. `coach-rls.spec.ts`, `redeem-rpc.spec.ts`)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

**CI caveat:** The RLS suite is `RUN_DB`-gated (per the `waitlist-config-rpc.spec.ts` / `premium-grant-rpc.spec.ts` convention) — it only executes against a real Supabase test project when `SUPABASE_TEST_URL` / `SUPABASE_TEST_PUBLISHABLE_KEY` / `SUPABASE_TEST_SERVICE_ROLE_KEY` are configured as repo secrets. Per `.github/workflows/test-rls.yml`'s header comment, these secrets are not yet configured in this repo — new specs will be present and correct but will silently skip in CI until that lands. Pre-existing repo condition, not something Phase 42 fixes.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-01-TBD | 01 | 0 | FOUND-01 | V4 | `athlete_state` returns single current-state row per athlete, never grows | integration (RLS) | `npx vitest run test/rls/athlete-state.spec.ts -t "reads own"` | ❌ W0 | ⬜ pending |
| 42-01-TBD | 01 | 0 | FOUND-02 | V4/V5 | `athlete_decisions` rows are append-only, evidence-mandatory | integration (RLS) | `npx vitest run test/rls/athlete-decisions.spec.ts -t "evidence"` | ❌ W0 | ⬜ pending |
| 42-01-TBD | 01 | 0 | FOUND-03 | V4 | Only `record_athlete_decision()` can write `athlete_state` (authenticated AND service-role writes fail) | integration (RPC) | `npx vitest run test/rls/athlete-state.spec.ts -t "cannot UPDATE"` | ❌ W0 | ⬜ pending |
| 42-01-TBD | 01 | 0 | FOUND-04 | V4 | RLS: own-read succeeds, cross-read denied, no client write path exists | integration (RLS) | `npx vitest run test/rls/athlete-state.spec.ts` (full file) | ❌ W0 | ⬜ pending |
| 42-01-TBD | 01 | 0 | FOUND-05 | V5 | `rolling_summary` column + documented read convention exists | manual (schema review) | N/A — verify via `\d athlete_state` / migration diff review; no runtime assertion possible until Phase 44 has a reader | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs are placeholders (TBD) — the planner assigns real task IDs; requirement coverage and file paths above are locked.*

---

## Wave 0 Requirements

- [ ] `backend/api/test/rls/athlete-state.spec.ts` — covers FOUND-01, FOUND-03, FOUND-04 (own-read, cross-read-denied, authenticated-write-blocked, service-role-write-blocked)
- [ ] `backend/api/test/rls/athlete-decisions.spec.ts` — covers FOUND-02 (evidence-mandatory via RPC call with `p_evidence: null`, expecting the `evidence_required` error path since direct INSERT is revoked from the admin client too) and immutability (no UPDATE/DELETE policy exists — verify via admin-client attempt, expecting a permission error identical to the state-table pattern)
- [ ] No changes needed to `backend/api/test/rls/fixtures.ts` — `getAdminClient()`, `getAnonClient()`, `createTestUser()`, `cleanupTestUsers()` already cover every fixture these specs require (confirmed by direct inspection during research)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `rolling_summary` column + bounded-context read convention exists and is documented | FOUND-05 | No caller exists yet to exercise real read behavior (first reader is Phase 44) — this phase verifies the schema/discipline exists, not runtime behavior | Run `\d athlete_state` (or equivalent migration diff review) and confirm `rolling_summary TEXT` is present; confirm the read convention (rolling_summary + last-N-raw-decisions, never full replay) is documented in the phase's SUMMARY.md or code comments for Phase 44 to follow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (both RLS spec files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
