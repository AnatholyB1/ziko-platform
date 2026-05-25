# Research Summary — v1.13 Retour Vidéo Coach

**Workstream:** retour-video
**Domain:** Coaching video upload, annotation, and athlete review
**Researched:** 2026-05-25
**Confidence:** HIGH

---

## Executive Summary

Retour Vidéo Coach is a coaching video feedback tool following the pattern of Onform, CoachFeedback, and Coach Logic. The athlete uploads a technique video from mobile; the coach annotates it on web with timecoded text and voice comments; the athlete reviews annotations synchronized with the video on mobile. This is a 1:1 coaching workflow, not a team sports broadcast, so the feature surface is well-bounded. Build complexity lives in three areas: reliable large-file upload on mobile, precise timecode rendering in the web player, and the voice annotation pipeline reused from v1.9.

The recommended approach is a 3-phase build with zero new mobile dependencies and a single new web package (@vidstack/react). All upload infrastructure follows the existing Supabase signed-URL pattern. The Whisper + Claude pipeline from retour-vocal (v1.9) is reused for voice annotations via a new independent endpoint. The existing retour-vocal route is never modified. Video bytes never touch Vercel functions; Hono handles metadata only.

Two decisions must be resolved before Phase 1 starts: (1) confirm Supabase plan tier — the free tier 50 MB per-file cap makes video upload structurally impossible; (2) confirm the project uses Expo Dev Build — required for TUS resumable uploads on large files. Both are go/no-go blockers for the entire workstream.

---

## Stack Additions

### Already installed — no new mobile packages needed

| Package | Version | Role |
|---|---|---|
| expo-image-picker | ~17.0.10 | Pick video from camera roll |
| expo-camera | ~17.0.10 | Record video (deferred to v2) |
| base64-arraybuffer | ^1.0.2 | Available if needed for small payloads |

### New — web only

```bash
npm install @vidstack/react   # apps/web only
```

@vidstack/react was chosen over react-player (black-box DOM, cannot overlay annotation UI), video.js (jQuery-era, complex React integration), and raw HTML5 video + custom JS. It exposes useMediaState for currentTime as a reactive hook so timecode-synchronized annotation markers need zero additional logic. Its Tailwind-compatible default layout works with the existing web stack.

### Backend — no new packages

Whisper (OpenAI) and Claude (Anthropic) are already integrated. Add coach-videos to ALLOWED_BUCKETS in backend/api/src/routes/storage.ts. Create lib/whisper.ts shared utility in Phase 3 regardless of v1.9 shipping status.

---

## Feature Table Stakes

Must ship in v1.13. Missing any one makes the product feel broken to coaches familiar with Onform or CoachFeedback.

| Feature | Why Non-Negotiable |
|---|---|
| Mobile video upload from camera roll | Athlete workflow starts here |
| Video playback on web with timeline scrubbing | Coach must seek freely to annotate the right moment |
| Timecoded text annotations | Every competitor ships this; absence is disqualifying |
| Annotation markers on the scrub bar | Coach needs to see at a glance where the feedback is |
| Athlete push notification when annotations are ready | Silence after upload creates support tickets |
| Athlete views annotations synchronized with video | Tapping a marker must seek the video to that exact timecode |
| Coach slow-motion playback (0.5x, 0.25x) | Technique analysis requires slow motion |

### Should have (v1.13 differentiators)

- Timecoded voice annotations via Whisper + Claude: core Ziko differentiator; stack already built in v1.9; low marginal cost
- Emoji reaction from athlete (thumbs-up acknowledgment): low-friction confirmation
- Annotation categories/tags (technique, breathing, good rep): simple enum

### Defer to v1.x+1

- Side-by-side video comparison (synchronized dual player — high complexity)
- Coach markup / drawing on frame (telestration — canvas layer and coordinate normalization)
- AI auto-detection of form errors (computer vision — ML infrastructure)
- In-app recording by coach (explicitly out of scope per STATE.md)

---

## Architecture Overview

### New Supabase tables (migration 054)

**coach_client_videos:** one row per uploaded video (coach_id, client_id, storage_path, filename, size_bytes, duration_s, mime_type, title). RLS: coach owns their rows.

**coach_video_annotations:** timecoded annotations (video_id, coach_id, timecode_ms, type [text|voice], content, audio_path, transcript, cleaned_text). Indexed on (video_id, timecode_ms).

Storage bucket: coach-videos (private, signed URLs). Path convention: {coach_id}/{client_id}/{uuid}.mp4 for videos, {coach_id}/{client_id}/annotations/{uuid}.webm for voice blobs. Single bucket simplifies ALLOWED_BUCKETS.

### New Hono routes (backend/api/src/coach/video/)

| Route | Purpose |
|---|---|
| GET /coach/video/upload-url | Creates DB row + signed upload URL (coach caller) |
| GET /video/upload-url | Same for mobile athlete caller; validates coach relationship, populates coach_id |
| GET /coach/video/signed-url/:videoId | Fresh read URL (TTL 12h); validates ownership |
| GET /coach/video/clients/:clientId/videos | Video list ordered by uploaded_at DESC |
| DELETE /coach/video/:videoId | Deletes row + storage, cascades annotations |
| POST /coach/video/:videoId/annotations | Create text or voice annotation |
| GET /coach/video/:videoId/annotations | All annotations ordered by timecode_ms |
| PATCH /coach/video/annotations/:annotationId | Edit annotation |
| DELETE /coach/video/annotations/:annotationId | Delete annotation |
| POST /coach/video/annotations/:annotationId/transcribe | Whisper + Claude cleanup (independent of retour-vocal route) |

Hard constraint: Video bytes never pass through Hono. Vercel 4.5 MB body limit and 60s timeout are both fatal for video. All binary uploads go directly to Supabase Storage via signed URL.

### New web components (apps/web)

- Route: app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx
- VideoGrid + VideoCard (thumbnail, title, date, duration, delete)
- VideoPlayerModal: Vidstack MediaPlayer + AnnotationMarkers overlay + AnnotationPanel right sidebar
- AnnotationPanel: AnnotationList + AnnotationComposer (text tab + voice tab with VoiceAnnotationRecorder)
- ClientTabStrip: add { key: "videos", label: "Vidéos" } — one-line change, strip already scrolls horizontally

### New mobile screen (apps/mobile)

- apps/mobile/app/(app)/workout/video-upload.tsx: expo-image-picker pick + client-side size/format guard + XMLHttpRequest PUT upload with progress + success confirmation.
- Entry points: workout summary CTA and workout history screen.

---

## Critical Decisions Before Phase 1

| Decision | Stakes | Recommendation |
|---|---|---|
| Supabase plan tier | Free tier caps uploads at 50 MB. A 1-minute squat video at 1080p = 100-300 MB. Video upload is impossible on free. | Upgrade to Supabase Pro ($25/month) before Phase 1. Gate mobile client on 200 MB max with a clear error message. |
| Expo Dev Build | TUS resumable uploads require native modules unavailable in Expo managed workflow. Without TUS, a 200 MB upload backgrounded by iOS fails with no recovery. | Project already uses eas build — confirm Dev Build is active. If not, this is the moment to switch. |
| iOS video format | iPhones record HEVC (.mov) by default. Chrome and Firefox cannot play HEVC. Coach opens video on web and sees a black screen. | Set videoExportPreset to force H.264/MP4 transcode at pick time (20-60s on device per minute of video). Decide and enforce in Phase 1. |
| Signed URL TTL | Default 1h TTL: coach leaves tab open, video returns 403 on next play attempt. Looks like a platform bug to the user. | Set TTL to 12h for video files. Handle 403 video.error events to auto-refresh signed URL without resetting currentTime. |

---

## Watch Out For

**1. iOS HEVC format breaks the web player (CRITICAL)**

iPhones default to HEVC H.265 in MOV container. Safari plays it; Chrome and Firefox cannot. Will not be caught in dev unless tested on Chrome with a real iPhone-recorded file.

Prevention: Set videoExportPreset in picker config in Phase 1. Add canPlayType check with visible error fallback in the web player.

**2. Supabase free tier 50 MB limit silently kills uploads (CRITICAL)**

No user-visible error on mobile — upload just fails. Looks like a code bug.

Prevention: Upgrade to Pro before Phase 1. Add client-side size validation before calling the upload-url endpoint.

**3. Video bytes through Vercel = guaranteed 60s timeout (CRITICAL)**

Synchronous video processing — duration extraction, thumbnail generation, transcoding — times out on Vercel.

Prevention: Direct Supabase PUT bypasses Hono entirely. Duration provided by the client after local file selection (asset.duration). Thumbnails generated on the mobile client before upload.

**4. MediaRecorder format mismatch on Safari (CRITICAL for voice annotations)**

Chrome records audio/webm;codecs=opus. Safari records audio/mp4. A Safari coach recording a voice annotation sends a format the Hono endpoint does not expect — silent transcription failure.

Prevention: Use MediaRecorder.isTypeSupported() probe. Priority: audio/mp4 first, then audio/webm;codecs=opus, then audio/webm. Pass actual MIME type to the endpoint — never hardcode.

**5. Do not mutate the retour-vocal route (HIGH)**

POST /coach/voice/transcribe from v1.9 is a shared resource. Modifying it for video annotations breaks existing voice feedback for coaches.

Prevention: New independent endpoint POST /coach/video/annotations/:annotationId/transcribe. Share only lib/whisper.ts utility function. Different response shapes — keep routes completely separate.

**6. Annotation race condition on rapid saves (HIGH)**

Coach adds 3 annotations in 5 seconds. Out-of-order server responses overwrite local optimistic state.

Prevention: Client-generated UUIDs per annotation. TanStack Query onMutate/onError/onSuccess pattern. Apply deltas only — never derive full annotations array from a bulk server response.

---

## Suggested Phase Order

### Phase 1 — Storage and Upload Pipeline

**Rationale:** Everything depends on videos being in storage. Forces the two hardest non-code decisions (Supabase plan, Dev Build) as a Day 1 forcing function. Zero external API dependencies.

**Delivers:** Athlete uploads video on mobile and it lands in the coach-videos bucket. Coach sees it as a VideoCard in the web CRM.

**Scope:**
- Supabase migration 054 (tables + bucket)
- Hono coach/video/ module: upload-url, signed-url, list, delete
- Mobile video-upload.tsx with picker, size guard, format validation, XMLHttpRequest progress
- Web videos/page.tsx + VideoGrid + VideoCard

**Pitfalls addressed:** iOS HEVC format, 50 MB limit, TUS/Dev Build choice, iOS media library permission timing.

**Research flag:** Standard patterns — existing storage.ts signed-URL pattern extended. No research-phase needed.

---

### Phase 2 — Web Player and Text Annotations

**Rationale:** Text annotations have zero external API dependencies. Validates timecode data model, player/panel layout, and annotation UX in isolation before Whisper complexity is introduced.

**Delivers:** Coach watches video at variable speed, clicks to set timecode, types annotation, sees marker on scrub bar. Athlete receives push notification and views annotations synchronized with video.

**Scope:**
- Vidstack MediaPlayer integration + AnnotationMarkers overlay
- AnnotationPanel text mode: AnnotationList + AnnotationComposer
- Hono annotation CRUD routes (GET, POST, PATCH, DELETE)
- ClientTabStrip +1 tab entry
- Push notification trigger on annotation submit

**Pitfalls addressed:** video.duration NaN before loadedmetadata, 403 signed URL refresh (12h TTL), cross-browser H.264 format check, annotation race condition, currentTime centisecond rounding.

**Research flag:** Vidstack API is well-documented. HTML5 video overlay positioning is standard. No research-phase needed.

---

### Phase 3 — Voice Annotations + Whisper + Claude Cleanup

**Rationale:** Whisper is the only external API risk not yet validated in this workstream. Isolating it in Phase 3 lets Phases 1 and 2 ship independently. Aligns with retour-vocal (v1.9) timeline — if v1.9 ships first, lib/whisper.ts may already exist.

**Delivers:** Coach records a voice comment at a specific timecode. Whisper transcribes it. Claude removes filler words. Transcript appears in the annotation with a raw/cleaned toggle. Matches retour-vocal card UX.

**Scope:**
- VoiceAnnotationRecorder component (MediaRecorder, isTypeSupported probe, webm/mp4 upload to storage)
- lib/whisper.ts shared utility (built here regardless of v1.9 status)
- POST /coach/video/annotations/:annotationId/transcribe (independent route)
- AnnotationItem voice variant (transcript + cleaned_text toggle, audio playback)
- video_timecode_start offset stored and applied to Whisper segment timestamps

**Pitfalls addressed:** MediaRecorder Safari format mismatch, Whisper timestamp offset arithmetic, retour-vocal route isolation, 3-minute voice cap (Vercel body limit), Whisper hallucination rejection for clips under 3 seconds.

**Research flag:** Whisper video_timecode_start + word.start offset logic has nuance and needs hands-on validation. If v1.9 has not shipped and the Whisper utility is unproven in this codebase, run a short research-phase before planning Phase 3.

---

### Phase Ordering Rationale

- Storage first: no other phase can be tested without real videos in the bucket. Surfaces the hardest infrastructure decisions on Day 1.
- Text before voice: zero external dependencies; validates timecode model and annotation UX before introducing Whisper risk.
- Voice last: only phase with external API risk (Whisper) and cross-browser audio complexity. Phases 1-2 provide a stable foundation and real videos to test against.
- No Phase 4+ in v1.13: side-by-side comparison, telestration, and AI form detection explicitly deferred.

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Direct inspection of package.json, SDK 54 changelogs, Vidstack docs, existing storage.ts pattern |
| Features | MEDIUM | 6 competitor platforms benchmarked; Ziko-specific 1:1 scoping inferred from STATE.md context |
| Architecture | HIGH | Direct inspection of existing Hono routes, Supabase migrations 001-053, ClientTabStrip, coach CRM component tree |
| Pitfalls | HIGH | Official issue trackers (W3C, Expo GitHub, Supabase Storage GitHub), Vercel KB, MDN; multiple independent confirmations |

**Overall confidence:** HIGH

### Gaps to address during planning

- **Mobile athlete review UI:** video-upload.tsx is fully specified but the screen where the athlete watches annotated video is not yet architecturally defined. Needs a component tree decision in Phase 2 planning (new screen in workout history? Push-notified deep link?).
- **Coach-client relationship table schema:** the /video/upload-url athlete endpoint must look up which coach is linked. The coach_client_relationships table is assumed to exist. Verify exact column names before writing migration 054.
- **Supabase bucket creation via migration:** confirm whether INSERT INTO storage.buckets works in a SQL migration or requires a dashboard action for the coach-videos bucket.
- **Whisper utility independence from v1.9:** Phase 3 planning ticket should explicitly state — if v1.9 shipped, import from existing lib/whisper.ts; if not, build it here.

---

## Sources

### Primary (HIGH confidence)
- Expo ImagePicker SDK 54 docs: launchImageLibraryAsync, videoExportPreset, permission flow
- Expo Camera SDK 54 docs: recordAsync, HEVC fix in SDK 54
- Supabase Storage docs: file size limits (free tier 50 MB per file), TUS endpoint, signed URL TTL, bucket RLS
- Vidstack Player docs: useMediaState, MediaPlayer, layout integration, headless API
- Vercel KB: 60s function timeout, 4.5 MB body size limit
- W3C media-and-entertainment issue tracker: frame-accurate seeking limitations in HTML5
- Expo GitHub issue tracker: expo-camera Android fix, expo-video/expo-av conflicts

### Secondary (MEDIUM confidence)
- Onform, CoachFeedback, CoachNow, Coach Logic, Hudl: feature benchmarking across 6 platforms
- Supabase blog (React Native storage): TUS react-native-tus-client 0-byte bug confirmation
- MDN MediaRecorder: isTypeSupported, cross-browser MIME type matrix

### Tertiary (LOW confidence — validate during planning)
- Whisper word-level timestamp offset: inferred from WhisperX docs and OpenAI timestamp_granularities parameter; needs hands-on validation in Phase 3
- TUS 6 MB mandatory chunk size: cited in Supabase docs; confirm against current Supabase Storage v3 spec before implementation

---

*Research completed: 2026-05-25*
*Ready for roadmap: yes*