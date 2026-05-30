---
phase: 2
slug: upload-ux-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc --noEmit`) + manual browser smoke |
| **Config file** | `apps/web/tsconfig.json` |
| **Quick run command** | `cd apps/web && npx tsc --noEmit` |
| **Full suite command** | `cd apps/web && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx tsc --noEmit`
- **After every plan wave:** Run `cd apps/web && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Automated Command | Status |
|---------|------|------|-------------|-------------------|--------|
| i18n keys | 01 | 1 | UPLOAD-02 | `cd apps/web && npx tsc --noEmit` | ⬜ pending |
| Chat bubble component | 01 | 1 | UPLOAD-02 | `cd apps/web && npx tsc --noEmit` | ⬜ pending |
| Drop zone component | 01 | 1 | UPLOAD-01 | `cd apps/web && npx tsc --noEmit` | ⬜ pending |
| FileState type + store | 01 | 1 | UPLOAD-01 | `cd apps/web && npx tsc --noEmit` | ⬜ pending |
| Pipeline orchestration | 01 | 2 | UPLOAD-03 | `cd apps/web && npx tsc --noEmit` | ⬜ pending |
| Polling + cleanup | 01 | 2 | UPLOAD-03 | `cd apps/web && npx tsc --noEmit` | ⬜ pending |
| WizardStep4Import wired | 01 | 2 | UPLOAD-01,02,03 | `cd apps/web && npx tsc --noEmit` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop file selection | UPLOAD-01 | Browser drag events cannot be automated via tsc | Drag a PDF onto the drop zone; confirm card appears with `uploading` pill |
| 4-file cap visual dimming | UPLOAD-01 | Visual state only | Add 4 files; confirm drop zone dims and shows cap message |
| Status pill transitions | UPLOAD-03 | Requires real backend pipeline | Upload a real file; confirm pill progresses uploading → parsing → ready |
| × remove stops polling | UPLOAD-03 | Runtime behavior only | Start upload, click × during parsing; confirm no further network calls |
| IA chat bubble renders | UPLOAD-02 | Visual render | Load Step 4; confirm avatar + opening message visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
