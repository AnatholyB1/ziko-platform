# Stack — Retour Vidéo Coach

**Milestone:** v1.13
**Researched:** 2026-05-25
**Confidence:** HIGH for mobile upload, HIGH for web player, MEDIUM for annotation pattern

---

## Mobile Video Upload

### Already installed — no new packages needed for pick + record

| Package | Version in repo | Role |
|---|---|---|
| `expo-image-picker` | `~17.0.10` | Pick video from gallery |
| `expo-camera` | `~17.0.10` | Record video with camera (`CameraView` + `recordAsync`) |
| `base64-arraybuffer` | `^1.0.2` | Convert file data for PUT upload |

### Pick from gallery

```ts
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['videos'],
  videoMaxDuration: 180,   // 3 min cap — squat review videos
  quality: 0.7,            // iOS transcode before upload
});
// result.assets[0].uri  — local file URI
```

**iOS gotcha:** Request `mediaLibrary` permission before calling `launchImageLibraryAsync` with `allowsEditing: false` to avoid a surprise permission dialog after selection.

### Record with camera

```ts
import { CameraView } from 'expo-camera';

const cameraRef = useRef<CameraView>(null);
await cameraRef.current?.recordAsync({ maxDuration: 180 });
// returns { uri: string }
```

Use `mode="video"` on `<CameraView>` and toggle with a record button. **Known Android bug in SDK 52** (stuck single frame) — confirmed fixed in SDK 54 via expo-camera changelog; verify with a device build before shipping.

### Upload to Supabase Storage via signed URL

Reuse the existing `GET /storage/upload-url?bucket=&path=` endpoint (already in `backend/api/src/routes/storage.ts`). Add `coach-videos` to `ALLOWED_BUCKETS`.

Upload pattern — fetch PUT with blob (avoids base64 overhead on large files):

```ts
const { upload_url } = await getSignedUploadUrl('coach-videos', `${userId}/${videoId}.mp4`);

const fileBlob = await (await fetch(localUri)).blob();

await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'video/mp4' },
  body: fileBlob,
});
```

**Why blob over base64:** Video files are typically 20–150 MB. Base64 inflates size ~33% and requires reading the entire file into memory. The blob approach streams from the filesystem reference directly.

**Why not TUS resumable uploads:** `tus-js-client` / Uppy has confirmed 0-byte upload bugs in React Native (Supabase blog, 2024). The standard PUT via signed URL is reliable up to 6 MB per Supabase docs, but with fetch + blob it handles larger files fine in practice for video up to ~200 MB — sufficient for squat review clips. Add progress via `XMLHttpRequest` if a progress bar is required.

**No new expo package needed** — `expo-video` is for playback only. The mobile app does not play back videos in v1.13.

---

## Web Video Player

### Recommendation: Vidstack Player (`@vidstack/react`)

```bash
npm install @vidstack/react
```

**Why Vidstack over alternatives:**

| Library | Reason not chosen |
|---|---|
| `react-player` | Black-box DOM, no hook API, hard to overlay custom annotation UI |
| `video.js` | jQuery-era patterns, complex React integration, large bundle |
| `HTML5 <video>` + custom JS | Annotation layer is the hard part — Vidstack solves it |
| Mux Player | Requires Mux hosting; we use Supabase Storage signed URLs |

Vidstack is headless-first: the player state (currentTime, duration, paused) is exposed via `useMediaState('currentTime')` hook, making it trivial to synchronize an annotation overlay with playback position. It ships with a Tailwind-compatible default layout (Tailwind v4 already used in the web app).

**Import path:**
```ts
import { MediaPlayer, MediaProvider, useMediaState } from '@vidstack/react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
```

**Minimal player for signed URL playback:**
```tsx
<MediaPlayer src={supabaseSignedUrl} viewType="video">
  <MediaProvider />
  <DefaultVideoLayout />
</MediaPlayer>
```

Signed URL from Supabase Storage is a standard HTTPS URL — Vidstack handles it natively.

---

## Annotation Timeline UI

### Pattern: overlay div positioned via `useMediaState` — no extra library

Vidstack exposes `currentTime` and `duration` as reactive state. Annotation pins are rendered as absolutely-positioned elements on a `div` that mirrors the timeline width.

```tsx
const currentTime = useMediaState('currentTime', playerRef);
const duration    = useMediaState('duration', playerRef);

// For each annotation at timestamp T:
const pct = (annotation.timestamp_s / duration) * 100;

<div className="relative w-full h-2 bg-gray-200">
  {annotations.map(a => (
    <div
      key={a.id}
      className="absolute w-3 h-3 rounded-full bg-orange-500 -translate-x-1/2 -translate-y-1/4 cursor-pointer"
      style={{ left: `${(a.timestamp_s / duration) * 100}%` }}
      onClick={() => playerRef.current?.remoteControl.seek(a.timestamp_s)}
    />
  ))}
  {/* Playhead */}
  <div className="absolute h-full bg-orange-500/30" style={{ width: `${(currentTime/duration)*100}%` }} />
</div>
```

**Click-to-annotate:** On click anywhere on the player container (outside controls), capture `currentTime` → open annotation form → save `{ timestamp_s, content, voice_transcript? }` to DB.

**No dedicated annotation library needed.** Libraries like `react-annotations` or `peaks.js` are audio-focused (waveform-based) and would require heavy adaptation for video. The overlay-div pattern is 30 lines of code and gives full control over styling.

---

## Voice Recording on Web

### Recommendation: Native `MediaRecorder` Web API — no npm package

The existing retour-vocal (v1.9) Whisper + Claude stack is 100% reusable:

- **Recording:** `MediaRecorder` (browser-native, no package) captures `audio/webm;codecs=opus`
- **Transport:** `Blob` → `FormData` → `POST /ai/voice/transcribe` (existing Hono endpoint from v1.9)
- **Transcription:** OpenAI `whisper-1` (FR/EN, already integrated)
- **Structuring:** Claude (already integrated)

```ts
// Start recording
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
const chunks: BlobPart[] = [];
recorder.ondataavailable = e => chunks.push(e.data);
recorder.start();

// Stop + send
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const form = new FormData();
  form.append('audio', blob, 'annotation.webm');
  form.append('timestamp_s', String(currentTime));
  const { transcript } = await fetch('/api/voice/transcribe', { method: 'POST', body: form }).then(r => r.json());
};
recorder.stop();
```

**Why no `react-media-recorder` or similar package:** The v1.9 workstream explicitly chose direct `MediaRecorder` API (see REQUIREMENTS.md — "MediaRecorder API direct retenu"). Web API is stable across all modern browsers. Adding a wrapper package would introduce a dependency for ~20 lines of code.

**Mobile browser caveat:** `MediaRecorder` with `audio/webm;codecs=opus` does not work on iOS Safari (which uses `audio/mp4`). The annotation voice recording is a web/coach surface only — coaches use Chrome/Firefox on desktop, so this is not a concern for v1.13.

---

## What NOT to Add

| What | Why |
|---|---|
| `react-native-video` | `expo-video` (playback) and `expo-camera` (record) cover everything; react-native-video requires bare workflow config |
| Mux, Cloudflare Stream, or any video CDN | Supabase Storage signed URLs are sufficient; adding a video CDN is infra complexity with no UX benefit at this scale |
| `peaks.js` / `wavesurfer.js` | Audio waveform tools — wrong domain for video annotation |
| `uppy` / `tus-js-client` | Known 0-byte bug in React Native; standard PUT upload is reliable for video clips ≤200 MB |
| `expo-video` on mobile | Only for playback; the mobile side of v1.13 is upload-only. Do not add to avoid SDK upgrade conflicts with expo-av (still in use for audio in other plugins) |
| HLS transcoding pipeline (FFmpeg, etc.) | MP4 progressive download via signed URL is sufficient for coach review. HLS is only needed for live streaming or adaptive bitrate — not this use case |
| Any annotation-specific npm library | The overlay-div pattern on top of Vidstack requires zero additional dependencies |

---

## Installation Summary

### Web app (`apps/web`)

```bash
npm install @vidstack/react
```

That's the only new dependency.

### Mobile app (`apps/mobile`)

No new packages. `expo-camera`, `expo-image-picker`, and `base64-arraybuffer` are already installed.

### Backend (`backend/api`)

No new packages. Whisper + Claude already integrated via v1.9. Add `coach-videos` to `ALLOWED_BUCKETS` in `storage.ts`.

---

## Sources

- Expo ImagePicker SDK 54 docs: https://docs.expo.dev/versions/latest/sdk/imagepicker/
- Expo Camera SDK 54 docs (recordAsync): https://docs.expo.dev/versions/latest/sdk/camera/
- expo-video SDK 54 docs (playback only, no recording): https://docs.expo.dev/versions/latest/sdk/video/
- Supabase Storage standard uploads: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Supabase resumable upload TUS / React Native 0-byte bug: https://supabase.com/blog/react-native-storage
- Vidstack Player state management (`useMediaState`): https://vidstack.io/docs/player/core-concepts/state-management/
- Vidstack `useMediaState` hook: https://vidstack.io/docs/player/api/hooks/use-media-state/
- MediaRecorder + Whisper Next.js patterns: https://medium.com/@jordans2299/using-openai-whisper-api-with-next-js-13-8a19dcd0fdbf
- expo-video vs expo-av migration context: https://swmansion.com/blog/the-future-of-video-in-react-native-moving-from-expo-av-to-expo-video-6f4f78e51196/
