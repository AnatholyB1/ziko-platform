---
phase: 01
slug: transcription-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured in backend/api and apps/web) |
| **Config file** | `backend/api/vitest.config.ts` (or vitest defaults via package.json) |
| **Quick run command** | `npm run test --workspace=backend/api` |
| **Full suite command** | `npm run test` (Turborepo) |
| **Estimated runtime** | ~15 seconds (quick), ~45 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=backend/api`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-01 | W0 | 0 | VOICE-01 | — | N/A | unit | `vitest run apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` | ❌ W0 | ⬜ pending |
| 01-W0-02 | W0 | 0 | VOICE-01 | — | Auto-stop enforced at 300s | unit | `vitest run apps/web/src/components/coach/vocal/useVocalTimer.test.ts` | ❌ W0 | ⬜ pending |
| 01-W0-03 | W0 | 0 | VOICE-03 | — | N/A | unit | `vitest run apps/web/src/components/coach/vocal/vocalReducer.test.ts` | ❌ W0 | ⬜ pending |
| 01-W0-04 | W0 | 0 | VOICE-03 | — | N/A | unit | `vitest run apps/web/src/components/coach/vocal/VocalReview.test.tsx` | ❌ W0 | ⬜ pending |
| 01-W0-05 | W0 | 0 | VOICE-02 | T-01-02 | Auth required — 401 without JWT | unit | `vitest run backend/api/test/voice.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-01 | 01 | 1 | VOICE-02 | T-01-01 | Proxy passes binary multipart unchanged | unit | `vitest run backend/api/test/voice.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | VOICE-02 | T-01-03 | bodyLimit rejects payloads > 20MB | unit | `vitest run backend/api/test/voice.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | VOICE-01 | — | MediaRecorder produces non-empty blob | unit | `vitest run apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | VOICE-03 | — | State transitions: STOP→transcribing, SUCCESS→review, ERROR→error | unit | `vitest run apps/web/src/components/coach/vocal/vocalReducer.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` — mock `getUserMedia`, test blob output, test auto-stop signal
- [ ] `apps/web/src/components/coach/vocal/useVocalTimer.test.ts` — fake timers, test auto-stop at 300s, timer color threshold at 240s
- [ ] `apps/web/src/components/coach/vocal/vocalReducer.test.ts` — all state transitions (idle→recording, recording→transcribing, transcribing→review, transcribing→error)
- [ ] `apps/web/src/components/coach/vocal/VocalReview.test.tsx` — renders transcript text, renders [Valider] and [Relancer] buttons
- [ ] `backend/api/test/voice.test.ts` — route tests with mocked OpenAI client: 200 + transcript, 401 no JWT, 400 no audio field, 413 oversized payload

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mic permission prompt appears on first use | VOICE-01 | Requires real browser + OS | Open client sheet, click "Nouveau retour", verify browser permission dialog appears |
| beforeunload warning appears when navigating away during recording | VOICE-01 | Browser dialog cannot be asserted by Vitest | Start recording, navigate to another tab, verify warning dialog text matches copywriting contract |
| Safari produces audio/mp4 and upload succeeds | VOICE-02 | Requires Safari browser | Record on Safari, verify transcript returns successfully |
| Transcript displays correctly for long speech (> 6 lines, scroll appears) | VOICE-03 | Visual / scroll behavior | Use a 2+ min recording that produces long transcript, verify scroll appears in review state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
