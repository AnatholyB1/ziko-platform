---
phase: 02
slug: claude-structuring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npx vitest run src/components/coach/vocal/vocalReducer.test.ts --passWithNoTests` |
| **Full suite command** | `cd apps/web && npx vitest run src/components/coach/vocal/ --passWithNoTests` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run src/components/coach/vocal/vocalReducer.test.ts --passWithNoTests`
- **After every plan wave:** Run `cd apps/web && npx vitest run src/components/coach/vocal/ --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | STRUCT-01 | — | N/A | unit | `cd apps/web && npx vitest run src/components/coach/vocal/vocalReducer.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | STRUCT-01 | — | VALIDATE → structuring (not idle) | unit | `cd apps/web && npx vitest run src/components/coach/vocal/vocalReducer.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | STRUCT-01 | T-02-01 | coach JWT required; RLS enforces coach-client access | manual | POST /coach/voice/structure with valid JWT and athlete_id | N/A | ⬜ pending |
| 02-03-01 | 03 | 2 | STRUCT-02 | — | card sections render with correct content | unit | `cd apps/web && npx vitest run src/components/coach/vocal/` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | STRUCT-03 | — | section click enters edit mode, tag toggle updates state | unit | `cd apps/web && npx vitest run src/components/coach/vocal/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/coach/vocal/vocalReducer.test.ts` — update VALIDATE test (review → `structuring`), add Phase 02 transition tests:
  - `STRUCTURE_SUCCESS → card-ready` with card payload
  - `STRUCTURE_ERROR → structuring-error`
  - `SECTION_EDIT → updates editedCard`
  - `TAG_TOGGLE → adds/removes tag from editedCard.tags`
  - `START_SAVING → card-saving`
  - `SAVE_COMPLETE → card-saved`
  - `RESET → idle`

*Existing `apps/web/vitest.config.ts` covers all phase requirements. No new framework install needed.*

---

## Nyquist Exception — React Component Tests

`nyquist_compliant: false` is intentional and accepted for this phase.

**Exception rationale:** React component tests for Phase 02 vocal components (VocalStructuring, VocalStructuringError, VocalCardReady, FeedbackCard, CardSection, TagChip) require mocking browser APIs that are non-trivial to stub in Vitest:
- `MediaRecorder` — not available in jsdom
- `GSAP` — manipulates DOM style properties; behaviour differs in test environment
- `fetch` — requires mocking the structure endpoint response

Adding fragile stub tests would produce false confidence and maintenance overhead. The component behaviour is fully covered by the Manual-Only Verifications section above.

**What IS automated:** All `vocalReducer.ts` state transition logic (pure function — no browser APIs) is tested in `vocalReducer.test.ts`. This covers the core state machine contract for STRUCT-01, STRUCT-02, STRUCT-03.

**Accepted by:** planner revision 2026-05-27

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| POST /coach/voice/structure returns valid StructuredCard JSON | STRUCT-01, STRUCT-02 | Requires live Claude API + Supabase — no backend unit tests in this workstream | 1. Start backend with valid .env. 2. POST `{ athlete_id: <valid UUID>, transcript: "Test retour vocal" }` with coach JWT. 3. Response must be `{ card: { context, strengths, corrections, next_steps, tags } }`. |
| Spinner appears while Claude processes (structuring state) | STRUCT-01 | Visual state transition — Playwright not configured | Click [Valider] on a transcript. Spinner with "Structuration en cours…" must appear before card loads. |
| Card renders all 5 sections with Claude content | STRUCT-02 | Requires live Claude response | After structuring completes, all 5 sections (Contexte séance, Points forts, Corrections, Prochaines étapes, Tags) must be populated. |
| Section click-to-edit activates inline textarea | STRUCT-03 | Visual interaction | In card-ready state, click any section. That section must become an editable textarea with border `1.5px solid #1C1A17`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant` documented exception recorded (see Nyquist Exception section)

**Approval:** pending
