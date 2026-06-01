# Architecture — Retour Vidéo Coach

**Milestone:** v1.13
**Researched:** 2026-05-25
**Confidence:** HIGH — based on direct inspection of existing code

---

## Context & Constraints

- Vercel serverless functions have a **4.5 MB body limit** — video uploads must bypass Hono entirely and go directly to Supabase Storage via signed URLs (same pattern as `storage.ts`)
- Supabase Storage is already used for `profile-photos`, `scan-photos`, `exports`, `coach-kyc`, `ai-imports` — add a `coach-videos` bucket
- Retour-vocal (v1.9) Whisper endpoint **does not exist yet** — both workstreams are in planning; video builds on top of it but cannot depend on it being shipped first
- The coach web client detail view has 8 tabs in `ClientTabStrip`; video becomes a 9th tab
- Mobile upload target: `expo-image-picker` or `expo-document-picker` (both already patterns in the codebase) for video file selection, then direct PUT to Supabase signed URL
- Annotation storage is lightweight JSON (timecode + text/audio path), not embedded in the video

---

## New Supabase Tables

Next migration number: **054**.

### `054_retour_video_schema.sql`

```sql
-- 1. Video uploads (one row per video file)
CREATE TABLE public.coach_client_videos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,          -- e.g. "{coach_id}/{client_id}/{uuid}.mp4"
  filename     TEXT NOT NULL,          -- original filename shown in UI
  size_bytes   BIGINT,
  duration_s   INTEGER,               -- filled by mobile after recording/selection
  mime_type    TEXT DEFAULT 'video/mp4',
  title        TEXT,                   -- optional coach label
  uploaded_at  TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.coach_client_videos ENABLE ROW LEVEL SECURITY;
-- Coach can CRUD their own videos; client cannot access directly
CREATE POLICY "coach_videos_coach_rls" ON public.coach_client_videos
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- 2. Timecoded annotations on a video
CREATE TABLE public.coach_video_annotations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id     UUID NOT NULL REFERENCES public.coach_client_videos(id) ON DELETE CASCADE,
  coach_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timecode_ms  INTEGER NOT NULL,       -- position in video (milliseconds)
  type         TEXT NOT NULL DEFAULT 'text'
                 CHECK (type IN ('text', 'voice')),
  -- text annotations
  content      TEXT,
  -- voice annotations (reuses coach-videos bucket under annotations/ prefix)
  audio_path   TEXT,                  -- storage path of raw audio blob
  transcript   TEXT,                  -- Whisper output
  cleaned_text TEXT,                  -- Claude-cleaned version
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.coach_video_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_annotations_rls" ON public.coach_video_annotations
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- 3. Index for fast per-video annotation lookup
CREATE INDEX coach_video_annotations_video_id_idx
  ON public.coach_video_annotations(video_id, timecode_ms);
```

**Storage bucket** (create via Supabase dashboard or migration):
- Name: `coach-videos`
- Access: private (signed URLs only)
- Path convention: `{coach_id}/{client_id}/{uuid}.mp4` for videos, `{coach_id}/{client_id}/annotations/{uuid}.webm` for voice blobs

**No separate bucket** — both videos and voice annotation audio live in `coach-videos` under different path prefixes. This simplifies the ALLOWED_BUCKETS allowlist in `storage.ts` (one addition).

---

## New Hono Routes

All routes mount under the `coach/` bounded context. Add a new `video/` module mirroring the pattern of `coach/clients/`, `coach/ai/` etc.

### `backend/api/src/coach/video/` module

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/coach/video/upload-url` | Returns signed upload URL for a video file. Query: `client_id`, `filename`, `size_bytes`, `duration_s?`. Creates row in `coach_client_videos`, returns `{ upload_url, video_id, storage_path }`. |
| `GET` | `/coach/video/annotation-upload-url` | Returns signed upload URL for a voice annotation audio blob. Query: `video_id`. Returns `{ upload_url, audio_path }`. |
| `GET` | `/coach/video/signed-url/:videoId` | Returns a fresh signed read URL (TTL: 3600s) for a stored video. Validates `coach_id = auth.uid()`. |
| `GET` | `/coach/video/clients/:clientId/videos` | Lists all videos for a client (coach-scoped). Returns metadata rows ordered by `uploaded_at DESC`. |
| `DELETE` | `/coach/video/:videoId` | Deletes video row + removes from storage. Cascades to annotations. |
| `POST` | `/coach/video/:videoId/annotations` | Creates a text or voice annotation. Body: `{ timecode_ms, type, content? }`. |
| `GET` | `/coach/video/:videoId/annotations` | Returns all annotations for a video ordered by `timecode_ms`. |
| `PATCH` | `/coach/video/annotations/:annotationId` | Updates annotation text or cleaned_text. |
| `DELETE` | `/coach/video/annotations/:annotationId` | Deletes one annotation. |
| `POST` | `/coach/video/annotations/:annotationId/transcribe` | Triggers Whisper + Claude cleanup for a voice annotation. Reuses exact same pipeline as `POST /coach/voice/transcribe` (retour-vocal v1.9). Body: nothing — reads `audio_path` from DB. Returns `{ transcript, cleaned_text }` and patches the annotation row. |

**All routes** use `authMiddleware` (JWT). The `signed-url` route enforces ownership before returning — clients cannot request signed URLs for other coaches' videos.

### Storage.ts changes

Add `'coach-videos'` to the `ALLOWED_BUCKETS` tuple. Add path validation: path must start with `{userId}/` (existing rule) OR `{coachId}/{clientId}/` when the requesting user is a coach linked to that client. The latter case is handled by the new `/coach/video/upload-url` route which generates the path server-side — the generic `/storage/upload-url` endpoint does not need modification.

---

## New Next.js Components

### New route: `/coach/clients/[id]/videos/`

```
app/[locale]/(coach)/coach/clients/[id]/videos/
  page.tsx            ← Server component: fetches video list, passes to client shell
  loading.tsx         ← Skeleton (matches other tabs)
```

### Component tree

```
ClientVideosPage (server)
  └── ClientVideosShell (client, 'use client')
        ├── VideoUpload section (upload CTA — web only via drag-drop or file picker)
        │     └── VideoUploadDropzone
        │           └── uses /coach/video/upload-url → PUT to Supabase signed URL
        ├── VideoGrid
        │     └── VideoCard (thumbnail, title, date, duration, delete button)
        └── VideoPlayerModal (opens on VideoCard click)
              ├── VideoPlayer
              │     └── <video> HTML5 element with signed URL src
              │     └── AnnotationMarkers (positioned divs on the timeline bar)
              ├── AnnotationPanel (right sidebar, 320px)
              │     ├── AnnotationList
              │     │     └── AnnotationItem (timecode chip + text, or voice with play button)
              │     ├── AnnotationComposer
              │     │     ├── [Text] tab — textarea + Submit
              │     │     └── [Voice] tab — VoiceAnnotationRecorder
              │     │           ├── MediaRecorder API (webm/opus)
              │     │           ├── upload audio → /coach/video/annotation-upload-url
              │     │           └── POST /coach/video/annotations/:annotationId/transcribe
              │     └── TimecodeJumpLink (clicking annotation seeks video to timecode_ms)
              └── (optional) VideoTitleEditor — inline edit of video title
```

**Key component details:**

- `VideoPlayer` wraps a native `<video>` element. The signed URL is fetched server-side at page load (or client-side on modal open) with 1-hour TTL. Re-fetch needed if user keeps tab open > 1h (simple check on play error → refetch → set new src).
- `AnnotationMarkers` renders colored pip marks along the `<progress>` bar using absolute positioning relative to video duration. Clicking a pip seeks via `videoRef.current.currentTime`.
- `VoiceAnnotationRecorder` uses browser `MediaRecorder` API (same approach as retour-vocal Phase 01 for coach-side mic recording) — no additional library needed.
- `AnnotationItem` for voice type shows transcript + cleaned_text toggle (raw vs. Claude-cleaned), matching the retour-vocal card UX pattern.

### ClientTabStrip change

Add `{ key: 'videos', label: 'Vidéos' }` to the `TABS` array in `ClientTabStrip.tsx`. This is a one-line addition. The tab strip already scrolls horizontally (`overflow-x-auto`) — no layout change needed.

---

## Mobile Changes (Expo)

Video recording and upload happen on the **athlete's mobile app** (Joaquim records squat → Guillaume annotates on web). The mobile side is a **new screen added to the workout flow**, not a new plugin.

### New screen: `apps/mobile/app/(app)/workout/video-upload.tsx`

Accessible from `workout/summary.tsx` after completing a session ("Ajouter une vidéo de cette séance" CTA) or from a dedicated entry point in the workout history screen.

**Flow:**
1. `expo-image-picker` with `mediaTypes: ['videos']` — picks from gallery or camera roll (no live recording in v1.13 — deferred per STATE.md decision on webcam)
2. File size guard: warn if > 500 MB, hard block if > 2 GB
3. `GET /coach/video/upload-url?client_id={athleteUserId}&filename=...&size_bytes=...` — but note: athlete calls this endpoint as themselves; the route needs a `client_id` that is the athlete's own ID, linked to a coach
4. `fetch(signedUrl, { method: 'PUT', body: fileBlob })` — direct to Supabase, bypasses Vercel limit
5. Progress tracking via `XMLHttpRequest` with `upload.onprogress` (fetch API has no upload progress in RN)
6. Success → back to workout summary or history

**Permissions required in `app.json`:**
```json
"ios": {
  "infoPlist": {
    "NSPhotoLibraryUsageDescription": "Pour envoyer tes vidéos d'entraînement à ton coach"
  }
},
"android": {
  "permissions": ["READ_MEDIA_VIDEO", "READ_EXTERNAL_STORAGE"]
}
```

**expo-image-picker** is likely already installed (check `packages/`) — if not, single `npx expo install expo-image-picker` addition.

### Upload-URL endpoint for athlete callers

The `/coach/video/upload-url` route must handle two caller types:
- **Coach on web** uploading a client's video: authenticated as coach, `client_id` param validated against `coach_client_relationships`
- **Athlete on mobile** uploading their own video: authenticated as athlete, `client_id = auth.uid()`, system looks up which coach is linked

Recommendation: A separate endpoint `/video/upload-url` (not under `/coach/`) for mobile athletes, mirroring the simpler pattern of `/storage/upload-url`. It validates that the athlete has at least one active coach relationship, then creates the `coach_client_videos` row with `coach_id` populated from the relationship.

---

## Integration Points with retour-vocal Stack

The retour-vocal (v1.9) stack introduces:
- `POST /coach/voice/transcribe` — accepts audio blob, calls OpenAI Whisper, returns transcript
- `POST /coach/voice/structure` — sends transcript + athlete context to Claude, returns 5-section card
- `coach_vocal_feedbacks` table

Retour-vidéo reuses the transcription half only:

### What to reuse

**Whisper transcription:** Extract the Whisper API call from `coach/voice/service.ts` (once built) into a shared utility `coach/voice/transcribe.ts` (or `lib/whisper.ts`). The video annotation transcription route (`POST /coach/video/annotations/:annotationId/transcribe`) calls this utility directly — no HTTP hop between Hono routes, just a function import.

**Claude cleanup:** Retour-vocal uses Claude for full 5-section structuring of a coaching feedback. Retour-vidéo needs only a lightweight cleanup pass (remove filler words, fix punctuation) on a short annotation clip (typically 10–30 seconds of speech). Use a minimal prompt variant, not the full STRUCT prompt. Share the Anthropic client instance but not the prompt template.

### What NOT to share

- `coach_vocal_feedbacks` table — annotation voice comments are stored in `coach_video_annotations.transcript`, not in the vocal feedback table. Different data model, different query patterns.
- The 5-section card structure — annotations are single-field text, not cards.
- Audio recording UI — retour-vocal uses `MediaRecorder` on web (browser mic); retour-vidéo annotation panel uses the same browser API. The mobile athlete upload uses `expo-image-picker`. No shared component possible across web/mobile.

### Dependency management

**If retour-vocal (v1.9) ships first:** The video workstream imports the whisper utility from the already-built `coach/voice/` module.

**If retour-vidéo ships first (or in parallel):** The video workstream builds its own minimal `lib/whisper.ts` with just the Whisper API call. When retour-vocal later ships, it imports from the same utility — no duplication stranded.

Recommended: build the shared whisper utility in Phase 1 of retour-vidéo regardless of v1.9 status.

---

## Suggested Build Order

### Phase 1 — Storage & Upload Pipeline
**Goal:** Athlete uploads a video on mobile → file lands in Supabase `coach-videos` bucket → coach can see it in the web CRM

**Deliverables:**
- Supabase migration 054 (tables + bucket)
- Hono `coach/video/` module: `upload-url`, `signed-url`, `list`, `delete`
- Mobile screen `video-upload.tsx` with `expo-image-picker` + progress
- Web `videos/page.tsx` + `VideoGrid` + `VideoCard` + signed URL read

**Rationale:** Storage is the foundation everything else depends on. Validates the bucket, path convention, and RLS before any player or annotation work.

### Phase 2 — Web Video Player + Text Annotations
**Goal:** Coach opens a video in the CRM, watches it, adds text annotations at timecodes

**Deliverables:**
- `VideoPlayerModal` with HTML5 `<video>` player + timeline markers
- `AnnotationPanel` with `AnnotationList` + `AnnotationComposer` (text mode)
- Hono routes: `GET/POST/PATCH/DELETE` annotations
- `ClientTabStrip` addition

**Rationale:** Text annotations are self-contained (no Whisper dependency) and validate the timecode data model and the player/panel UX before adding voice complexity.

### Phase 3 — Voice Annotations + Whisper + Claude Cleanup
**Goal:** Coach records a short voice comment on an annotation → transcript appears + Claude-cleaned version

**Deliverables:**
- `VoiceAnnotationRecorder` component (MediaRecorder, webm upload)
- `lib/whisper.ts` shared utility
- Hono route `POST /coach/video/annotations/:annotationId/transcribe`
- `AnnotationItem` voice variant (raw / cleaned toggle)

**Rationale:** Whisper is the only external API dependency (OpenAI). Isolate it in Phase 3 so Phases 1–2 can be validated without it. Also gives time for retour-vocal v1.9 to progress — if it ships before Phase 3 starts, the whisper utility is already written and can be imported directly.

---

## Summary Table

| Layer | Artifact | Phase |
|-------|----------|-------|
| Supabase | Migration 054 (`coach_client_videos`, `coach_video_annotations`) | 1 |
| Supabase | `coach-videos` bucket | 1 |
| Hono | `coach/video/` module (upload-url, signed-url, list, delete) | 1 |
| Hono | Annotation CRUD routes | 2 |
| Hono | Transcription route + `lib/whisper.ts` | 3 |
| Mobile | `video-upload.tsx` screen + `expo-image-picker` | 1 |
| Web | `videos/page.tsx` + `VideoGrid` + `VideoCard` | 1 |
| Web | `VideoPlayerModal` + `AnnotationMarkers` | 2 |
| Web | `AnnotationPanel` (text) | 2 |
| Web | `VoiceAnnotationRecorder` + voice `AnnotationItem` | 3 |
| Web | `ClientTabStrip` +1 tab | 2 |
