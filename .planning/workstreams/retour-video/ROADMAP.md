# Roadmap — v1.13 Retour Vidéo Coach

**Workstream:** retour-video
**Milestone:** v1.13
**Done criterion:** Joaquim uploads a squat video from mobile → Guillaume annotates at T+1:23 with a cleaned voice comment visible in the lateral panel.

## Overview

Three phases that build the video feedback pipeline from the ground up. Phase 45 lays the storage and upload foundation — nothing else can be tested without real videos in the bucket. Phase 46 delivers the web player and text annotation workflow, validating the timecode data model before any external API risk is introduced. Phase 47 adds the voice annotation pipeline, reusing the Whisper + Claude stack from v1.9 via an independent route. The result is a complete 1:1 coach-to-athlete video feedback loop with no new mobile dependencies and a single new web package.

**Prerequisite note (Phase 45):** This workstream requires Expo Dev Build — the managed Expo workflow is insufficient for large-file uploads via XMLHttpRequest. Confirm Dev Build (EAS) is active before executing Phase 45. Also confirm Supabase plan is Pro ($25/month) — the free tier 50 MB per-file cap makes video upload structurally impossible.

## Phases

- [ ] **Phase 45: Storage Pipeline & Mobile Upload** - Bucket, migration, signed URL, mobile video picker with H.264 enforcement, upload progress, title input, push notification to coach
- [ ] **Phase 46: Web Player & Text Annotations** - @vidstack/react player, Videos tab in client detail, timecoded text annotations with edit/delete, lateral annotation panel, athlete mobile review screen
- [ ] **Phase 47: Voice Annotations** - MediaRecorder on web, Whisper + Claude route (lib/whisper.ts shared), audio storage, transcript in DB, inline audio player in annotation panel

## Phase Details

### Phase 45: Storage Pipeline & Mobile Upload
**Goal**: An athlete can select and upload a technique video from mobile and it lands in the coach-videos bucket, visible to the coach on web
**Depends on**: Nothing (first phase) — Expo Dev Build and Supabase Pro are prerequisites
**Requirements**: UPLOAD-01, UPLOAD-02, UPLOAD-03, UPLOAD-04, INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Athlete selects a video from their camera roll (or records directly) and the upload completes with a visible progress bar showing percent complete
  2. The uploaded video is stored in Supabase bucket `coach-videos` as H.264/MP4 — not HEVC — and is playable in Chrome without format errors
  3. The athlete can attach a title (e.g. "Squat dos 2026-05-26") before uploading and it is stored with the video record
  4. The coach receives a push notification when the upload completes
  5. The signed URL pattern bypasses the Vercel 4.5 MB limit — video bytes never pass through Hono
**Plans**: 4 plans

Plans:
- [ ] 45-01-PLAN.md — SQL migration 057 (coach_client_videos + coach_video_annotations + RLS) + bucket creation + schema push
- [ ] 45-02-PLAN.md — Hono backend: /coach/videos/upload-url + /:videoId/complete endpoints + vitest tests + app.ts registration
- [ ] 45-03-PLAN.md — Mobile screens: VideoListScreen + VideoUploadSheet (H.264, XHR progress, title input) + videos.tsx route
- [ ] 45-04-PLAN.md — Push token registration in CoachScreen (State C) + E2E verification checkpoint

### Phase 46: Web Player & Text Annotations
**Goal**: The coach can watch the uploaded video with full scrubbing, leave timecoded text annotations with markers on the timeline, and the athlete can review those annotations synchronized with the video on mobile
**Depends on**: Phase 45
**Requirements**: PLAYER-01, PLAYER-02, ANNOT-01, ANNOT-02, ANNOT-03, REVIEW-01, REVIEW-02
**Success Criteria** (what must be TRUE):
  1. A "Vidéos" tab appears in the client detail view and lists all videos uploaded by that athlete with title, date, and status
  2. Coach can open a video and use the Vidstack player to play, pause, and scrub — including slow-motion playback (0.5x / 0.25x)
  3. Coach can pause at any moment, type a text annotation, and see a colored marker appear on the timeline scrub bar at the exact timecode
  4. Coach can edit or delete any existing annotation from the lateral panel, and clicking an annotation seeks the player to that timestamp
  5. Athlete receives a push notification when the coach submits annotations, then can open the video on mobile and see annotation markers on the timeline — tapping a marker seeks to that timecode and shows the comment
**Plans**: 4 plans

Plans:
- [ ] 46-01-PLAN.md — Hono backend: annotation CRUD + signed-url + send-feedback routes + vitest tests (Wave 1)
- [ ] 46-02-PLAN.md — Web pages: ClientTabStrip Vidéos tab + notes panel hide + VideoListPage with all states (Wave 2)
- [ ] 46-03-PLAN.md — Web player: @vidstack/react install + VideoPlayerClient + AnnotatedTimeSlider + AnnotationPanel state machine (Wave 2)
- [ ] 46-04-PLAN.md — Mobile: expo-video install + video-player route + VideoPlayerScreen + VideoListScreen extension (Wave 2)

### Phase 47: Voice Annotations
**Goal**: The coach can record a voice comment at a specific timecode, which is transcribed by Whisper and cleaned by Claude, with the transcript and audio playback available inline in the annotation panel
**Depends on**: Phase 46
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04
**Success Criteria** (what must be TRUE):
  1. Coach can switch to voice mode in the annotation composer and record a comment — the MediaRecorder probe detects the correct MIME type (WebM/Opus on Chrome, MP4/AAC on Safari) automatically
  2. The voice blob uploads to `coach-videos/annotations/` in storage and the Whisper + Claude route transcribes and cleans filler words — the result appears in the annotation within seconds
  3. The transcript and audio player are visible inline in the lateral annotation panel — athlete can read the cleaned transcript and play the raw audio
  4. The voice annotation route is independent from the retour-vocal (v1.9) route — `POST /coach/video/annotations/:annotationId/transcribe` shares only `lib/whisper.ts`, never modifies the v1.9 endpoint
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 45. Storage Pipeline & Mobile Upload | 0/4 | Not started | - |
| 46. Web Player & Text Annotations | 0/4 | Not started | - |
| 47. Voice Annotations | 0/? | Not started | - |
