# Pitfalls — Retour Vidéo Coach

**Workstream:** retour-video (v1.13)
**Researched:** 2026-05-25
**Overall confidence:** HIGH (multiple official sources + issue trackers)

---

## Video Upload Pitfalls

### CRITICAL — Supabase Free Tier Hard Limits Video

**What goes wrong:** The free Supabase Storage plan caps file size at **50 MB globally across all buckets**. A typical squat video recorded on iOS at default settings is 100–500 MB. The upload will be rejected at the storage layer with no warning to the user unless size is validated client-side first.

**Why it happens:** Supabase free tier enforces a platform-wide 50 MB maximum. Pro plan raises this to 500 GB. The 1 GB total storage figure people cite is the cumulative bucket storage, not the per-file limit.

**Consequences:** Coach uploads fail silently, or user waits for a large upload only to see a 413 error from Supabase.

**Prevention:**
- Gate video uploads with a client-side file size check before calling the signed-URL endpoint. Reject and show a clear message: "Vidéo trop grande (max 200 MB). Compresse ou réduis la durée."
- Define a hard compression step on mobile using `expo-video-thumbnails` + a compression library, OR limit recording duration in the app.
- Track storage usage explicitly — 1 GB fills fast with even 10 uploaded videos.
- Plan for upgrade to Supabase Pro ($25/month) at the first paying coach.

**Detection:** 413 or RLS policy violation response from Supabase Storage endpoint.

---

### CRITICAL — iOS Records HEVC (.mov) by Default; Web Cannot Play It

**What goes wrong:** iPhones record in HEVC (H.265) in a MOV container. Safari can play it. Chrome and Firefox cannot. The coach opens the video in the Next.js web player and sees a black screen or error.

**Why it happens:** `expo-image-picker` with `videoExportPreset: 'Passthrough'` (the SDK 54 default) returns the original `.mov` HEVC file. No transcoding is applied.

**Consequences:** Video displays fine during upload confirmation on the athlete's phone, but the coach's web viewer is broken.

**Prevention:**
- Set `videoExportPreset: MediaTypeOptions.Videos` or use `'HighestQuality'` export preset to force iOS to transcode to H.264/MP4 before picking. This adds 20–60s on device for a 1-minute video.
- Alternatively: accept the MOV file, store it, and run an async FFmpeg transcode via a Supabase Edge Function or a background queue after upload completes. Store both the original and a `_web.mp4` version.
- On the web player, check `video.canPlayType('video/mp4; codecs="avc1"')` and show an appropriate error if the format is not playable.

**Detection:** Coach reports black screen in the web video player on Chrome.

---

### HIGH — TUS Resumable Upload Requires Native Modules (Not Available in Expo Managed Workflow)

**What goes wrong:** The standard TUS resumable-upload libraries (`tus-js-client`, `react-native-tus-client`) require either ejecting from Expo managed workflow or using a Dev Build. The Expo managed workflow does not support these native modules. Using a JS-only fallback (like `fetch` with manual chunk splitting) is fragile.

**Why it happens:** `react-native-background-upload` (the most complete solution for background-aware uploads) explicitly requires ejecting. `react-native-tus-client` wraps TUSKit (iOS) and tus-android-client (Android) — both native.

**Consequences:** The upload cannot survive the user backgrounding the app during a 200 MB upload. On iOS, the app gets ~5 seconds of background time before the OS kills the network request.

**Prevention:**
- Use **Expo Dev Build** (not managed workflow) for this workstream. The project already uses `eas build` — this is not a major shift.
- Integrate `tus-js-client` with the Supabase TUS endpoint (`https://project-id.storage.supabase.co/upload/resumable`). Chunk size must be exactly **6 MB** — Supabase docs state this is mandatory, not configurable.
- Show a "Keep this screen open during upload" message as a fallback UX.

**Detection:** User backgrounds the app mid-upload; upload starts over from 0% next time they open it.

---

### HIGH — iOS Requires Media Library Permission AFTER Video Selection (Not Before)

**What goes wrong:** In Expo SDK 54+, `expo-image-picker` with `videoExportPreset: 'Passthrough'` shows an unexpected system permission dialog *after* the user has already selected a video (asking for media library access to read the original file). This interrupts the UX flow and confuses users.

**Why it happens:** Passthrough mode needs to read the original file from the Photos library, which requires `NSPhotoLibraryUsageDescription` permission. In the picker flow, this dialog appears post-selection.

**Prevention:**
- Call `ImagePicker.requestMediaLibraryPermissionsAsync()` explicitly *before* opening the picker, during onboarding or on first upload attempt.
- Add `NSPhotoLibraryUsageDescription` in `app.json` plugins config.

**Detection:** Users report an unexpected permission popup appearing mid-flow after selecting a video.

---

### MEDIUM — TUS Upload URL Expires After 24 Hours

**What goes wrong:** The TUS upload URL generated by Supabase is valid for 24 hours. If a user starts an upload, pauses it, and resumes the next day, the upload fails and must restart from zero.

**Prevention:**
- Store the upload URL and offset in MMKV (persisted local storage) so resumption is possible within the 24-hour window.
- On app launch, check if a pending upload exists and is less than 23 hours old. If older, discard and prompt re-upload.
- Display "Upload en pause — expire dans X heures" if the upload is interrupted.

---

### MEDIUM — Supabase Signed Upload URL vs Direct TUS Conflict

**What goes wrong:** The existing pattern in Ziko Platform uses `createSignedUploadUrl()` for photos. For video with TUS, the endpoint is different (`/upload/resumable`). Using the wrong endpoint for large files causes silent failures or falls back to standard upload (no resumption).

**Prevention:**
- Create a dedicated utility `uploadVideo(file, bucket, path)` that routes to the TUS endpoint for files over 10 MB and uses the standard signed-URL path for smaller files (thumbnails).
- Never reuse the photo upload utility for video.

---

## Player/Annotation Pitfalls

### CRITICAL — HTML5 Video `currentTime` Is Not Frame-Accurate

**What goes wrong:** The annotation is stored at `currentTime` from the HTML5 video element. When re-playing, seeking to that same `currentTime` does not always land on the same frame. Chrome rounds internally; WebKit has a known bug where seeking can land on the end of the *previous* frame. Annotations feel "off" by one frame.

**Why it happens:** The HTML5 Video API exposes time-based seeking, not frame-based. Frame boundaries are codec-dependent and not exposed to JavaScript. Chrome's Chromium issue tracker has an open bug on this since 2016.

**Consequences:** A coach annotates "bad knee position" at T=1.23s. On replay, the annotation marker shows at T=1.23s but the visible frame is actually T=1.20s. At 30fps this is a 1-frame error; at 60fps it can be 2 frames. For biomechanics feedback this is noticeable.

**Prevention:**
- Accept this limitation rather than fighting it — the use case (coaching annotations, not frame-level labeling) tolerates ±50ms drift.
- Store timecode at `Math.round(currentTime * 100) / 100` (centisecond precision) to avoid false precision.
- When rendering annotation markers on the timeline, snap them to the nearest 100ms bucket.
- Do NOT attempt SMPTE frame counting unless you know the video's frame rate (which the HTML5 API does not expose without workarounds like `requestVideoFrameCallback`).

---

### HIGH — Video `.webm` Recorded via MediaRecorder Cannot Be Seeked

**What goes wrong:** If any part of the system records video using the browser MediaRecorder API (e.g., a future webcam-recording feature), the resulting `.webm` file does not contain a `SeekHead` or `Cues` element. This makes seeking non-functional — the annotation timeline cannot jump to a timecode.

**Why it happens:** MediaRecorder writes chunks sequentially and cannot pre-compute seeking tables. No browser-produced `.webm` supports seeking reliably.

**Consequences:** The annotation timeline scrubber freezes or jumps erratically for any MediaRecorder-produced video.

**Prevention:**
- This milestone (v1.13) only handles athlete-uploaded videos from the phone, not browser-recorded coach videos (explicitly deferred). Keep it that way.
- If webcam recording is ever added in a future milestone, the output must be post-processed (e.g., via `ffmpeg -i input.webm -c copy output.mp4`) to produce a seekable file before storing. This requires a background job.

---

### HIGH — Annotation Race Condition on Save

**What goes wrong:** Coach annotates rapidly (adds 3 annotations in 5 seconds), each triggering a `PATCH /annotations/:id` or `INSERT` call. Due to network latency, response for annotation #1 arrives after annotation #3 is already sent. If the client updates local state from the server response, it can overwrite annotation #2 and #3 with stale data.

**Why it happens:** Optimistic UI updates + concurrent save calls + server response ordering mismatch.

**Prevention:**
- Use **optimistic local state** for the annotation list (immediate UI update), but send saves independently per annotation with a unique client-generated UUID.
- Never derive the annotations array from a server response that returns the full list — only apply the delta (the newly created/updated annotation).
- Use TanStack Query's mutation with `onMutate` / `onError` / `onSuccess` pattern for rollback on failure.
- Debounce rapid annotation creates (300ms) to avoid duplicate entries.

---

### MEDIUM — Timeline Marker Position Depends on Video Duration (Not Available Immediately)

**What goes wrong:** The annotation timeline renders markers at `(timecode / duration) * 100%`. If `video.duration` is `NaN` or `Infinity` (which happens before the video metadata loads), all markers render at position 0 or become invisible.

**Why it happens:** `video.duration` is only available after the `loadedmetadata` event fires. If the component renders immediately without waiting, `duration` is undefined.

**Prevention:**
- Gate timeline rendering on `video.readyState >= 1` (HAVE_METADATA).
- Store `duration` in component state, updated via `onLoadedMetadata` event.
- Show a loading skeleton on the timeline until duration is known.

---

### MEDIUM — Cross-Browser Video Format for the Coach Web Player

**What goes wrong:** Safari requires `.mp4` with H.264 for reliable playback via the native `<video>` element. Chrome additionally supports `.webm`. Firefox has edge cases with some H.264 profiles. If videos are stored in a non-universal format, some coaches will see broken playback.

**Prevention:**
- Mandate MP4/H.264 as the storage format. Reject or transcode anything else during upload.
- Use `<source type="video/mp4">` explicitly. Add a `canPlayType` fallback with a user-visible error: "Format non supporté — contactez le support."
- Test explicitly on Safari 17+ (macOS) and Chrome (Windows/Mac) before release.

---

## Voice Annotation Pitfalls

### CRITICAL — MediaRecorder Audio Format Incompatibility Between Chrome and Safari

**What goes wrong:** The existing retour-vocal workstream uses `MediaRecorder` in the browser. Chrome/Edge record in `audio/webm; codecs=opus`. Safari records in `audio/mp4`. Whisper API accepts both, but the current Hono endpoint likely handles only one content-type. For timecoded voice annotations, the web coach interface needs MediaRecorder too — and the same format mismatch applies.

**Why it happens:** There is no single universally supported MIME type for MediaRecorder across all browsers. Chrome chose WebM/Opus; Safari chose MP4/AAC. Chrome 126 added MP4 container support for MediaRecorder, but not all coaches will be on Chrome 126+.

**Consequences:** A coach on Safari records a voice annotation → it sends `audio/mp4` → the Hono route that expects `audio/webm` fails or sends the wrong content-type to Whisper → transcription fails silently.

**Prevention:**
- Use `MediaRecorder.isTypeSupported()` to probe the browser's preferred format before starting recording.
- Record in the best available format in this priority: `audio/mp4` (broadest compatibility with Whisper) → `audio/webm;codecs=opus` → `audio/webm`.
- Attach the actual MIME type as metadata when uploading to the Hono transcription endpoint. The Whisper API is format-agnostic (it detects automatically), so passing the correct `Content-Type` is the main concern.
- Do NOT hardcode `audio/webm` in the Hono route — pass it through from the client.
- This reuses the retour-vocal Whisper endpoint: ensure the endpoint accepts `multipart/form-data` with a dynamic content-type field, not a hardcoded one.

---

### HIGH — Whisper Timestamp Granularity vs. Annotation Timecode Mismatch

**What goes wrong:** Voice annotations are recorded at a specific video timecode (e.g., T=1:23). Whisper returns a transcript with word-level timestamps — but these timestamps are relative to the *audio recording start*, not to the video timeline. The coach starts recording at T=1:23 in the video, records for 8 seconds, and Whisper returns `word: "genou", start: 2.1, end: 2.4` — meaning 2.1 seconds into the recording. To place this on the video timeline, you must add the annotation's `video_timecode` offset.

**Prevention:**
- Store `video_timecode_start` (when in the video the coach started recording) alongside each voice annotation in the database.
- When displaying the Whisper transcript segments on the video timeline, offset each word by `video_timecode_start + word.start`.
- Accept segment-level timestamps (not word-level) for v1.13 — they are less noisy and sufficient for coaching feedback.

---

### HIGH — Reusing retour-vocal Whisper Route — Do Not Mutate Shared Code

**What goes wrong:** The retour-vocal workstream (v1.9) has a `POST /coach/voice/transcribe` route. If retour-video adds a timecoded variant of this route by editing the same handler, it will break the existing vocal feedback feature for coaches who use it.

**Prevention:**
- Create a **new route** `POST /coach/video/annotation/transcribe` that is independent of the retour-vocal route.
- Share only the Whisper API call as a utility function in `backend/api/src/lib/whisper.ts`. Both routes call this utility; neither route modifies it.
- The retour-vocal route returns a flat transcript. The retour-video route returns transcript + Whisper segment timestamps. These are structurally different responses — do not unify them into one endpoint.

---

### MEDIUM — Voice Annotation Audio Blob Size vs Vercel 4.5 MB Limit

**What goes wrong:** A 90-second voice annotation at Opus 128kbps ≈ 1.4 MB. That fits. But a 5-minute annotation at higher bitrate in MP4/AAC could approach or exceed 4.5 MB. Sending it directly to the Hono route as a request body will fail.

**Prevention:**
- Cap voice annotation recording at **3 minutes maximum** (enforced in the UI with a visible timer).
- For the annotation use case, 30-60 seconds is typical. Document the max and enforce it client-side.
- If the retour-vocal route already uses a signed-URL pre-upload pattern for audio, replicate that pattern here.

---

### LOW — Whisper Hallucination on Short Silent Clips

**What goes wrong:** If the coach accidentally clicks "record annotation" and then clicks stop after 1–2 seconds of silence, Whisper sometimes returns hallucinated transcriptions ("Merci.", "Sous-titres réalisés par la communauté d'Amara.org", etc.) instead of an empty string.

**Prevention:**
- Reject audio clips under 3 seconds before sending to Whisper.
- Check transcript confidence or length: if transcript is under 3 words, show "Annotation trop courte — veuillez ré-enregistrer."

---

## Vercel/Hono Specific

### CRITICAL — Vercel 60s Timeout Kills Any Synchronous Video Processing

**What goes wrong:** Any Hono route that attempts to do video work synchronously (downloading the video, generating a thumbnail, running FFprobe to extract duration, transcoding) will time out at 60 seconds. Vercel hobby/pro functions hard-stop at this limit (pro allows up to 300s with explicit config, but this is not the default).

**Why it happens:** Video processing is inherently slow. Even reading metadata from a 200 MB file via network takes 10–20s. Transcoding is minutes.

**Consequences:** Route returns 504, client sees an error, no feedback on what happened.

**Prevention:**
- All video processing must be **fire-and-forget or polling-based**:
  1. Client uploads video directly to Supabase Storage via TUS (no Hono involvement).
  2. Client calls `POST /coach/video/register` — Hono inserts a DB record with `status: 'processing'` and returns 202 immediately.
  3. A Supabase Database Webhook (or Edge Function triggered on insert) handles async work: extract duration via the Supabase Storage metadata, generate thumbnail.
  4. Client polls `GET /coach/video/:id/status` until `status: 'ready'`.
- Never route the video binary through Hono. The signed-URL pattern already in place for photos must be extended to video without modification to the proxy pattern.

---

### HIGH — Vercel Cold Start Latency on First Annotation Save

**What goes wrong:** Annotation save routes are called when a coach pauses on a frame and types. If the Hono function is cold (hasn't been called recently), the first annotation save call takes 2–4 seconds. The UI appears to hang.

**Prevention:**
- Use optimistic UI (show the annotation immediately, save in background).
- For annotation endpoints specifically, consider deploying to Vercel Edge Runtime (faster cold start, no Node.js startup) if the route only does DB writes via Supabase REST (no heavy Node.js deps).
- Keep annotation save routes thin — only Supabase `insert`/`upsert`, no AI calls.

---

### HIGH — Hono 4.5 MB Body Limit Still Applies for Thumbnails and Metadata

**What goes wrong:** Even with videos uploaded directly to Supabase Storage, thumbnail images and video metadata JSON must pass through Hono routes. A high-resolution thumbnail (1920x1080 JPEG) can be 500 KB – 2 MB. In bulk (multiple uploads), or if a base64 approach is used, this can approach the 4.5 MB limit.

**Prevention:**
- Generate thumbnails *on the client* (mobile) using `expo-video-thumbnails` before upload. Upload the thumbnail JPEG separately to Supabase Storage (same signed-URL pattern as photo uploads). Send only the storage path in the Hono request body, not the image bytes.
- Never base64-encode media in Hono request bodies.

---

### MEDIUM — Supabase Storage Signed URL Expiration Breaks Video Playback

**What goes wrong:** The web coach player loads a signed URL for private video files. If the coach leaves the tab open for hours and then tries to scrub through the video, the signed URL has expired and the video returns 403. The player shows a broken state with no explanation.

**Prevention:**
- Set signed URL expiry to at least **12 hours** for video files (vs. shorter for sensitive documents).
- On the Next.js side, catch `video.error` events and check for HTTP 403 (`MediaError.MEDIA_ERR_NETWORK` with status 403) — then auto-refresh the signed URL and reload the video source without resetting `currentTime`.
- Alternatively: use Supabase Storage public buckets for coach-shared videos (no signed URL needed), and rely on RLS at the DB layer to control who can see the video record.

---

### LOW — Vercel Function Memory Limit on Large JSON Annotation Payloads

**What goes wrong:** A heavily annotated video session with 50 text + voice annotations, each including Whisper transcript segments, can produce annotation JSON payloads in the range of 50–100 KB. This is fine. However, if the route returns all annotations with full embedded audio transcripts in a single response, and this grows to 1+ MB, it will increase function memory usage and response time.

**Prevention:**
- Return annotation metadata (id, timecode, type, short text preview) in the list endpoint.
- Lazy-load full transcript content only when a specific annotation is expanded in the UI.

---

## Prevention Strategy per Phase

| Phase | Primary Pitfalls to Address | What to Build / Decide |
|-------|-----------------------------|------------------------|
| Phase 1: Mobile Upload | iOS HEVC format trap, free tier 50 MB limit, TUS native module requirement, permission UX | Client-side size check + format validation before upload; choose Dev Build vs managed; implement TUS via Expo Dev Build; request media library permissions proactively |
| Phase 2: Web Player | `currentTime` precision, cross-browser format, `duration` metadata timing, signed URL expiry | Mandate MP4/H.264 in storage; use `onLoadedMetadata` gate; set 12h signed URL expiry; handle 403 refresh |
| Phase 3: Text Annotations | Timeline marker race condition, `duration` NaN, optimistic UI | UUID per annotation; TanStack mutation with rollback; gate timeline on `readyState >= 1` |
| Phase 4: Voice Annotations | MediaRecorder format mismatch, Whisper timestamp offset, retour-vocal route isolation, audio size limit | New independent route; `isTypeSupported()` probe; `video_timecode_start` offset stored; 3-min cap |
| Phase 5: Backend/Persistence | Vercel 60s timeout for processing, cold start, Hono body limit | Fire-and-forget pattern with polling; Edge Runtime for annotation routes; client-side thumbnail generation |

---

## Sources

- [Supabase Storage File Size Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase Resumable Uploads (TUS)](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase Storage v3 Announcement](https://supabase.com/blog/storage-v3-resumable-uploads)
- [TUS Resumable Upload 6MB Bug Report](https://github.com/supabase/storage/issues/563)
- [Expo ImagePicker — SDK 54 Passthrough Mode](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [expo-video Android Multi-Instance Bug](https://github.com/expo/expo/issues/31248)
- [Encord — Pausing Video Is Difficult](https://encord.com/blog/video-annotation-issues/)
- [W3C Frame Accurate Seeking Issue](https://github.com/w3c/media-and-entertainment/issues/4)
- [MediaRecorder Cross-Browser Compatibility](https://media-codings.com/articles/recording-cross-browser-compatible-media)
- [MediaRecorder — Can I Use](https://caniuse.com/mediarecorder)
- [Vercel Function Timeout — KB](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Vercel Body Size Limit Bypass](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [React Native Background Upload](https://github.com/Vydia/react-native-background-upload)
- [React Native TUS Client](https://github.com/vinzscam/react-native-tus-client)
- [Supabase React Native Storage Guide](https://supabase.com/blog/react-native-storage)
- [OpenAI Whisper Timestamp Granularities](https://x.com/gdb/status/1756048736986472799)
- [WhisperX Word-Level Timestamps](https://github.com/m-bain/whisperX)
