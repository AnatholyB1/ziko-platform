---
phase: 46
slug: web-player-text-annotations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing — `backend/api/` already configured) |
| **Config file** | `backend/api/vitest.config.ts` |
| **Quick run command** | `cd backend/api && npx vitest run src/coach/videos/` |
| **Full suite command** | `cd backend/api && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend/api && npx vitest run src/coach/videos/`
- **After every plan wave:** Run `cd backend/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-xx-01 | 01 | 1 | PLAYER-01 | — | Video list only returns videos for athlete linked to requesting coach | unit | `cd backend/api && npx vitest run src/coach/videos/` | ✅ extend | ⬜ pending |
| 46-xx-02 | 01 | 1 | PLAYER-02 | — | Signed read URL returned only for valid videoId owned by athlete | unit | `cd backend/api && npx vitest run src/coach/videos/` | ✅ extend | ⬜ pending |
| 46-xx-03 | 02 | 2 | ANNOT-01 | — | POST annotation creates row with correct timestamp_s, coach_id, video_id | unit | `cd backend/api && npx vitest run src/coach/videos/` | ✅ extend | ⬜ pending |
| 46-xx-04 | 02 | 2 | ANNOT-02 | — | PATCH/DELETE rejected if requester is not the annotation's coach | unit | `cd backend/api && npx vitest run src/coach/videos/` | ✅ extend | ⬜ pending |
| 46-xx-05 | 02 | 2 | ANNOT-03 | — | GET annotations returns list sorted by timestamp_s ascending | unit | `cd backend/api && npx vitest run src/coach/videos/` | ✅ extend | ⬜ pending |
| 46-xx-06 | 02 | 2 | REVIEW-01 | — | Athlete can GET annotations for their own video only | unit | `cd backend/api && npx vitest run src/coach/videos/` | ✅ extend | ⬜ pending |
| 46-xx-07 | 02 | 2 | REVIEW-02 | — | send-feedback sets status=annotated + triggers Expo push; idempotent (no resend) | unit | `cd backend/api && npx vitest run src/coach/videos/` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test cases to add to `backend/api/src/coach/videos/` (extend existing `service.test.ts` or create `annotations.test.ts`):

- [ ] Test `GET /coach/videos/:videoId/annotations` → sorted list
- [ ] Test `POST /coach/videos/:videoId/annotations` → creates row with timestamp_s
- [ ] Test `PATCH /coach/videos/:videoId/annotations/:annotId` → coach-only guard
- [ ] Test `DELETE /coach/videos/:videoId/annotations/:annotId` → coach-only guard
- [ ] Test `GET /coach/videos/:videoId/signed-url` → returns valid signed URL
- [ ] Test `POST /coach/videos/:videoId/send-feedback` → status=annotated + push sent

Vitest infrastructure already exists — no new framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Orange dot markers appear at correct timeline positions | ANNOT-01, ANNOT-03 | Browser visual — Vitest has no DOM with video duration | Open player page, add annotation at T=30s, verify dot appears at ~50% of a 60s video scrub bar |
| Slow-motion playback (0.5x / 0.25x) | PLAYER-02 | Playback rate requires a real browser player | Open player, switch to 0.5x, confirm video plays at half speed |
| expo-video seek on annotation tap | REVIEW-02 | Native mobile — no Vitest coverage | Tap an annotation dot on mobile VideoPlayerScreen, confirm video seeks to timestamp |
| Push notification received by athlete | REVIEW-01 | Expo push API — external service | Coach clicks 'Envoyer le retour', athlete device receives push within 30s |
| Notes panel hidden on /videos/* sub-pages | D-02 | Layout rendering — visual | Navigate to `/coach/clients/[id]/videos/[videoId]`, confirm w-72 notes panel is not rendered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
