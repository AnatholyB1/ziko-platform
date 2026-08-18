---
phase: 3
slug: legal-cgv-cgu
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`apps/web/vitest.config.ts`) — `apps/web/package.json` `"test": "vitest run --passWithNoTests"` |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npx vitest run test/legal` (new directory, mirrors `test/purge`, `test/actions`) |
| **Full suite command** | `cd apps/web && npm run test` |
| **Estimated runtime** | ~5-10 seconds (content-assertion tests, no Supabase credentials required) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run test/legal`
- **After every plan wave:** Run `cd apps/web && npm run test`; if the retention migration was touched, also `cd backend/api && npm run test:rls` (known environment gap — no live `SUPABASE_SERVICE_ROLE_KEY` here per STATE.md, so this may only be runnable in CI)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-0X | 01 | 0 | LEGAL-01/02/03/04/06/07 | — | N/A | unit | `npx vitest run test/legal` (Wave 0 stubs) | ❌ W0 | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-01 | — | `/fr/cgv` and `/en/cgv` render genuinely divergent locale content | render | `npx vitest run test/legal/cgv-locale.test.ts` | ❌ W0 | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-02 | — | CGV states AI-credit cap, no "illimité"/"unlimited" near AI | content-assertion | `npx vitest run test/legal/cgv-content.test.ts` | ❌ W0 | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-03 | — | "à vie" scoped to service lifetime, no unqualified revocation pairing | content-assertion | `npx vitest run test/legal/cgv-content.test.ts` | ❌ W0 | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-04 | — | CGV/CGU AI-credit-cap sentences byte-identical or documented cross-ref | consistency | `npx vitest run test/legal/cgv-cgu-consistency.test.ts` | ❌ W0 | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-05 | — | Process gate only — verified at Phase 4 boundary | process gate | — (no automated test this phase) | — | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-06/07 | — | Checkbox/notice copy present, non-empty, CNIL Art.13 minimum fields | content-assertion | `npx vitest run test/legal/consent-copy.test.ts` | ❌ W0 | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-08 | — | New migration's `app_config` retention INSERT idempotent, value matches copy | migration/RLS | `cd backend/api && npm run test:rls` (extend `waitlist-config-rpc.spec.ts`) | ✅ suite exists | ⬜ pending |
| 03-0X-0X | TBD | 1+ | LEGAL-09 | — | `anonymize_waitlist_signup()` callable only by `service_role`; erasure script (if built) CLI-gated | unit + RLS | `cd backend/api && npm run test:rls` + new `apps/web/test/legal/erasure-script.test.ts` if script built | ✅ RPC grants covered / ❌ script tests | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are placeholders — the planner assigns real task IDs; this map's requirement coverage is the binding contract, not the exact IDs.*

---

## Wave 0 Requirements

- [ ] `apps/web/test/legal/cgv-content.test.ts` — string/content assertions over exported CGV copy constants (LEGAL-02, LEGAL-03)
- [ ] `apps/web/test/legal/cgv-cgu-consistency.test.ts` — cross-document consistency check (LEGAL-04)
- [ ] `apps/web/test/legal/consent-copy.test.ts` — checkbox/notice copy structural checks (LEGAL-06/07)
- [ ] `apps/web/test/legal/cgv-locale.test.ts` — confirms genuine FR/EN divergence, guards against copying the existing French-only-body pattern (LEGAL-01)
- [ ] Extend `backend/api/test/rls/waitlist-config-rpc.spec.ts` (existing) to cover the new `app_config` retention row (LEGAL-08)
- [ ] If an erasure script is built: `apps/web/test/legal/erasure-script.test.ts` mirroring `apps/web/test/purge/purge-delete.test.ts`'s hand-rolled-fake style (LEGAL-09)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legal correctness/enforceability of CGV/CGU drafting | LEGAL-01–05 | No test suite can verify legal validity — only outside counsel can | D-01's blocking checkpoint: phase does not close until user confirms real outside counsel has reviewed and approved the drafted text |
| "Draft pending review" state is visibly honest on live pages (not hidden) | D-01 | Visual/UX judgment, not a structural assertion | Manually load `/fr/cgv` and `/en/cgv` in a browser pre-approval and confirm the pending-review banner is visible to a real visitor |
| Counsel-briefing package is genuinely usable | D-02 | Content-quality judgment | Manual read-through against the three flagged open questions (Pitfall 7 "à vie" scope, Pitfall 8 modification clause, free-vs-paid lifetime-benefit nuance) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
