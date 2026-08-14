---
phase: 26
slug: crm-client-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3 |
| **Config file** | `backend/api/vitest.config.ts` |
| **Quick run command** | `rtk vitest run --reporter=verbose test/coach/clients-*.spec.ts` |
| **Full suite command** | `rtk vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `rtk vitest run test/coach/clients-<relevant>.spec.ts`
- **After every plan wave:** Run `rtk vitest run` (full backend suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 0 | CLIENT-01..08 | — | N/A — Wave 0 installs deps + creates test stubs | setup | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 26-02-01 | 02 | 1 | CLIENT-05, CLIENT-06 | T-26-tags | coach_id isolation — Coach B cannot read Coach A's tags/notes | integration | `rtk vitest run test/coach/clients-tags.spec.ts test/coach/clients-notes.spec.ts` | ❌ W0 | ⬜ pending |
| 26-03-01 | 03 | 1 | CLIENT-01, CLIENT-02 | T-26-roster | Coach reads only linked clients (is_coach_of RLS); signal flags computed correctly | integration + unit | `rtk vitest run test/coach/clients-roster.spec.ts test/coach/clients-signals.spec.ts` | ❌ W0 | ⬜ pending |
| 26-04-01 | 04 | 2 | CLIENT-04 | T-26-summary | Summary aggregates correct; unlinked coach gets empty/403 | unit + integration | `rtk vitest run test/coach/clients-summary.spec.ts` | ❌ W0 | ⬜ pending |
| 26-05-01 | 05 | 2 | CLIENT-03 | T-26-tabs | 7 tab routes return 200 for linked coach; unlinked coach gets empty rows | integration | `rtk vitest run test/coach/clients-tabs.spec.ts` | ❌ W0 | ⬜ pending |
| 26-06-01 | 06 | 3 | CLIENT-07 | T-26-compare | Comparison endpoint validates is_coach_of per client ID; no data leak for unlinked | integration | `rtk vitest run test/coach/clients-compare.spec.ts` | ❌ W0 | ⬜ pending |
| 26-07-01 | 07 | 3 | CLIENT-08 | T-26-revoke | Coach-side revoke sets revoked_at; RLS blocks coach on next read | integration | `rtk vitest run test/coach/clients-revoke-coach.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/coach/clients-roster.spec.ts` — stubs for CLIENT-01
- [ ] `test/coach/clients-signals.spec.ts` — stubs for CLIENT-02 (signal threshold unit tests)
- [ ] `test/coach/clients-tabs.spec.ts` — stubs for CLIENT-03 (7 tab route integration tests)
- [ ] `test/coach/clients-summary.spec.ts` — stubs for CLIENT-04 (aggregate computation)
- [ ] `test/coach/clients-tags.spec.ts` — stubs for CLIENT-05
- [ ] `test/coach/clients-notes.spec.ts` — stubs for CLIENT-06
- [ ] `test/coach/clients-compare.spec.ts` — stubs for CLIENT-07
- [ ] `test/coach/clients-revoke-coach.spec.ts` — stubs for CLIENT-08
- [ ] `supabase/migrations/041_coach_client_tags_notes.sql` — prerequisite for CLIENT-05/06 tests
- [ ] `npm install @tanstack/react-table@8.21.3 recharts@3.8.1` — in `apps/web/`

*Existing vitest infrastructure in `backend/api/` covers all phase test requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TanStack Table multi-select UI (checkbox indeterminate, max-5 lock) | CLIENT-01, CLIENT-07 | Browser interaction — checkbox indeterminate state + max-5 disable requires DOM inspection | Open `/coach/clients`, select 5 clients, verify 6th checkbox is `disabled` + `opacity-40`; verify header checkbox shows indeterminate; click "Comparer (5)" verifies navigate to `/compare?ids=...` |
| Recharts chart renders correct lines per client | CLIENT-07 | Visual validation — chart rendering requires browser | Open `/coach/clients/compare?ids=id1,id2,id3`, verify 3 colored lines render; switch metric selector; switch date range chips; verify legend shows client names |
| Tags autosave on blur / chip × removal | CLIENT-05 | Browser interaction — blur event + immediate persistence | Add tag "Hyrox prep", blur input, reload page → tag persists; click × on chip → tag deleted immediately |
| Notes dirty-state save button | CLIENT-06 | Browser interaction — dirty detection requires user typing | Open notes panel, type text, verify save button appears; click save, verify button disappears and timestamp shown |
| "Vue lecture seule" badge visible on detail header | CLIENT-03 | Visual confirmation | Open any client detail page, verify `Vue lecture seule` badge is visible in `bg-primary/10 text-primary` styling |
| force-dynamic on all tab pages (no cache across coaches) | CLIENT-03 | Cross-user isolation requires two browser sessions | Log in as Coach A, open client detail; log in as Coach B in another browser, open same URL → should show different data or 0 rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
