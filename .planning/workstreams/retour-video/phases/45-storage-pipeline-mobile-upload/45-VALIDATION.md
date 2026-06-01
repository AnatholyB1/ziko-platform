---
phase: 45
slug: storage-pipeline-mobile-upload
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2.4 |
| **Config file** | `backend/api/vitest.config.ts` (or vitest defaults) |
| **Quick run command** | `cd backend/api && npx vitest run src/coach/videos/ --reporter=verbose` |
| **Full suite command** | `cd backend/api && npx vitest run` |
| **Estimated runtime** | ~15 seconds (backend unit tests only) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend/api && npx vitest run src/coach/videos/`
- **After every plan wave:** Run `cd backend/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-T1 | 01 | 1 | INFRA-01 | — | — | manual (bucket creation) | — | ✅ checkpoint | ⬜ pending |
| 45-01-T2 | 01 | 1 | INFRA-04 | — | RLS prevents cross-user access | structural | `grep -c "CREATE TABLE.*coach_client_videos" supabase/migrations/057_coach_videos_schema.sql` | ❌ W0 | ⬜ pending |
| 45-01-T3 | 01 | 1 | INFRA-01 | — | — | manual (schema push) | `supabase db push` | ✅ checkpoint | ⬜ pending |
| 45-02-T1 | 02 | 1 | INFRA-03 | T-45-04 | 403 for unlinked athlete | unit | `cd backend/api && npx vitest run src/coach/videos/service.test.ts -t "upload-url"` | ❌ W0 | ⬜ pending |
| 45-02-T2 | 02 | 1 | INFRA-04 / UPLOAD-04 | T-45-05 | idempotency via videoId key | unit | `cd backend/api && npx vitest run src/coach/videos/service.test.ts -t "complete"` | ❌ W0 | ⬜ pending |
| 45-02-T3 | 02 | 1 | INFRA-03 | — | route registered | structural | `grep -n "coach/videos" backend/api/src/app.ts` | ✅ exists | ⬜ pending |
| 45-03-T1 | 03 | 2 | UPLOAD-01 / INFRA-02 | T-45-09 | H.264 + allowsEditing false | compile | `cd apps/mobile && npx tsc --noEmit` | ✅ exists | ⬜ pending |
| 45-03-T2 | 03 | 2 | UPLOAD-02 / UPLOAD-03 / UPLOAD-04 | T-45-10 | title required, XHR progress | compile | `cd apps/mobile && npx tsc --noEmit` | ✅ exists | ⬜ pending |
| 45-04-T1 | 04 | 2 | UPLOAD-04 | T-45-12 | Device.isDevice guard | structural | `grep -n "notifications/token" plugins/coach/src/screens/CoachScreen.tsx` | ✅ exists | ⬜ pending |
| 45-04-T2 | 04 | 2 | UPLOAD-04 | — | — | manual (E2E push) | — | ✅ checkpoint | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/api/src/coach/videos/service.test.ts` — covers INFRA-03 (`/upload-url` returns `{ signedUrl, videoId }`, 403 for unlinked athlete), INFRA-04 (`/complete` inserts DB row), UPLOAD-04 (`/complete` calls `notificationService.send()` with correct payload and idempotency key)
- [ ] `backend/api/src/coach/videos/db.test.ts` — covers DB query functions `createVideoRecord`, `getVideosByAthlete` (optional — lower priority; service.test.ts has higher ROI)

*Wave 0 files must be created as part of Plan 45-02 execution (TDD tasks T1 and T2).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase bucket `coach-videos` created as private | INFRA-01 | Bucket creation requires Supabase Dashboard/CLI — not automatable in SQL | Run `supabase storage buckets create coach-videos --private` or create via Dashboard → Storage → New bucket |
| Schema push applied to remote DB | INFRA-04 | `supabase db push` requires live DB access and may prompt interactively | Run `SUPABASE_ACCESS_TOKEN=... supabase db push` after migration 057 is written |
| XHR upload progress fires on iOS physical device | UPLOAD-02 | Requires Expo Dev Build on physical device; not testable in simulator | Open Vidéos tab, upload a video, verify progress bar increments visibly |
| H.264/MP4 output from iOS picker | INFRA-02 | Requires physical iOS device with HEVC video in camera roll | Pick a HEVC video, verify uploaded file plays in Chrome without format errors |
| Coach push notification received | UPLOAD-04 | Requires physical device with active Expo Dev Build | Upload video as athlete, verify push notification arrives on coach's device |
| E2E flow: pick → sheet → upload → list → push | All UPLOAD-0x | Full flow requires Expo Dev Build + Supabase Pro + physical device | See Plan 45-04 Task 2 `how-to-verify` instructions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
