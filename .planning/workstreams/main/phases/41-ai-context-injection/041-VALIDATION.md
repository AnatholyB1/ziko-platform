---
phase: 41
slug: ai-context-injection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test runner confirmed active — `npm run type-check` as automated proxy |
| **Config file** | Not found — Wave 0 gap (check `backend/api/package.json` for vitest/jest) |
| **Quick run command** | `npm run type-check` |
| **Full suite command** | `npm run type-check` (no full suite available) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run type-check`
- **After every plan wave:** Run `npm run type-check` + manual smoke test
- **Before `/gsd-verify-work`:** TypeScript clean + manual smoke test of all 4 AI features
- **Max feedback latency:** ~30 seconds (type-check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Migration + types | 01 | 1 | AI-04 | T-41-01 / IDOR | RLS `auth.uid() = coach_id` on coach_metric_thresholds | unit | `npm run type-check` | ❌ W0 | ⬜ pending |
| buildCoachSystemPrompt extension | 01 | 1 | AI-01 | — / N/A | dashboardCtx injected only when present | unit | `npm run type-check` | ❌ W0 | ⬜ pending |
| DashboardChatDrawer | 02 | 1 | AI-01 | — / N/A | dashboard_context field in POST body | manual | Manual browser test | ❌ W0 | ⬜ pending |
| Insights endpoint | 03 | 2 | AI-02, AI-03 | T-41-02 / Prompt injection | chartData sanitized to scalar values | unit | `npm run type-check` | ❌ W0 | ⬜ pending |
| NarrativeSummaryCard + chips | 04 | 2 | AI-02, AI-03 | — / N/A | Silent fail on error | manual | Manual browser test | ❌ W0 | ⬜ pending |
| AlertesModal + threshold CRUD | 05 | 3 | AI-04 | T-41-01 / IDOR | coach_id scoped queries | manual | Manual browser test | ❌ W0 | ⬜ pending |
| Threshold crossing detection + badge | 05 | 3 | AI-04 | — / N/A | Visual badge only (no push) | manual | Manual browser test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify if `vitest` or `jest` is in `backend/api/package.json` — if yes, wire `tools.test.ts`
- [ ] `npm run type-check` must pass clean before any Wave 1 tasks begin

*If no test runner is found: "Existing infrastructure does not include automated tests — TypeScript type-check is the only automated gate."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat drawer sends dashboard_context in SSE request | AI-01 | No test runner for integration/e2e | Open dashboard → click "Demander à l'IA" → send message → inspect Network tab for `dashboard_context` field in POST body |
| AI insight chips render per chart | AI-02 | UI rendering requires browser | Open dashboard → select sport → verify each ChartCard shows insight chip text (not placeholder) |
| Narrative card appears above chart grid | AI-03 | UI rendering requires browser | Open dashboard → select sport → verify NarrativeSummaryCard renders with AI-generated paragraph |
| Threshold CRUD and badge | AI-04 | Requires DB + UI interaction | Click "Alertes" → add threshold (RPE > 8.5) → save → verify badge appears on RPE chart card if client exceeds threshold |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
