# Phase 45: Storage Pipeline & Mobile Upload — Research

**Researched:** 2026-05-26
**Domain:** Supabase Storage signed URL upload, expo-image-picker video, expo-notifications push, Hono coach routes
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two-endpoint flow — `POST /coach/videos/upload-url` returns `{ signedUrl, videoId }`. Mobile XHRs PUT directly to Supabase. Then `POST /coach/videos/:videoId/complete` with `{ title, duration_s }`. Hono inserts the DB row and triggers push on the second call.
- **D-02:** Signed URLs generated using Supabase **service role** (`SUPABASE_SERVICE_KEY` env var). Publishable key lacks storage.admin needed for `createSignedUploadUrl`.
- **D-03:** Signed URL expiry: **15 minutes**.
- **D-04:** Minimal Expo push in this phase — do not wait for v1.11. Token stored in `user_profiles.expo_push_token`. Hono sends via Expo Push API from the `/complete` endpoint.
- **D-05:** Token registration: coach opens web or mobile and calls Hono to upsert their push token into `user_profiles.expo_push_token`.
- **D-06:** New **"Vidéos" tab** inside the existing Mon coach plugin — available only in State C (athlete linked to a coach). Route: `app/(app)/(plugins)/mon-coach/videos.tsx` (NOTE: actual coach plugin route dir is `coach/`, not `mon-coach/` — see Architectural Note below).
- **D-07:** Videos tab shows list of uploaded videos (title, date, status: uploading/ready/annotated) plus a floating "Uploader une vidéo" button.
- **D-08:** Title entered on a **confirmation bottom sheet** after athlete picks or records the video.
- **D-09:** Auto-suggested title: `"Exercice YYYY-MM-DD"`. Athlete can edit.
- **D-10:** Title is **required** — Upload button disabled if empty.
- **INFRA-01:** Bucket `coach-videos`, path `{athleteId}/{videoId}.mp4`.
- **INFRA-02:** iOS video exported as H.264/MP4 via `videoExportPreset` at picker time.
- **INFRA-03:** Upload via signed URL PUT — Vercel 4.5 MB limit bypassed.
- **INFRA-04:** SQL migration: `coach_client_videos` + `coach_video_annotations` tables.
- `is_coach_of()` RLS function already exists (migration 035).

### Claude's Discretion

- Auto-suggested title format: `"Exercice YYYY-MM-DD"` (date of upload).
- Push notification body: `"📹 [athlete name] a uploadé une nouvelle vidéo : [title]"`.
- Upload status in video list: `uploading` (spinner + progress %), `ready` (green dot), `annotated` (orange dot).

### Deferred Ideas (OUT OF SCOPE)

- Video duration/size cap at picker time.
- Upload resumable TUS (> 500 MB) — post-v1.13.
- Thumbnail generation (FFmpeg WASM) — post-v1.13.
- Token storage migration to `notification_tokens` table — deferred to v1.11.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPLOAD-01 | Athlete can select from gallery OR record via camera using expo-image-picker | expo-image-picker v17 `launchImageLibraryAsync` + `launchCameraAsync` already installed and working in `avatar.tsx` pattern |
| UPLOAD-02 | Upload shows a progress bar via XMLHttpRequest progress events (50–500 MB files) | XHR upload progress fixed in Expo SDK 54 for iOS dev builds; project is on `~54.0.0` |
| UPLOAD-03 | Athlete can enter a title before upload | Confirmation bottom sheet via React Native `Modal` (existing pattern in habits plugin) |
| UPLOAD-04 | Coach receives push notification when new video is available | `notificationService.ts` + `expo-server-sdk` + `notification_tokens` table already in codebase — full infrastructure exists |
| INFRA-01 | Bucket `coach-videos` with `is_coach_of()` RLS | New bucket + new SQL migration needed; `is_coach_of()` function already exists |
| INFRA-02 | H.264/MP4 via `videoExportPreset` | `VideoExportPreset.H264_1920x1080` (enum value 7) — verified in locally installed types |
| INFRA-03 | Signed URL PUT — bytes never touch Hono | `storageRouter` in `storage.ts` has the exact pattern with `createSignedUploadUrl`; new coach-videos route adapts it |
| INFRA-04 | `coach_client_videos` + `coach_video_annotations` migration | Next available migration number is **057** |
</phase_requirements>

---

## Summary

Phase 45 lays the foundation for coach video feedback. An athlete uses `expo-image-picker` to select or record a technique video, then goes through a two-step flow: pick video → confirmation bottom sheet (title input + duration preview) → XHR PUT directly to Supabase Storage via signed URL → notify coach.

The good news is that almost all infrastructure already exists in the codebase. The `notificationService.ts` is fully implemented with `expo-server-sdk`, `notification_tokens` table, quiet hours, idempotency, and the full Expo Push pipeline. The `storageRouter` already shows the exact `createSignedUploadUrl` pattern. The `expo-image-picker` and `expo-notifications` packages are both already installed on mobile.

The critical discovery: **D-04 and D-05 in CONTEXT.md describe a simplified approach using `user_profiles.expo_push_token` column, but the codebase already has a production-grade `notification_tokens` table and `notificationService`. The plan should use the existing `notificationService.send()` — not implement a new simplified push path.** This is a significant finding that simplifies the implementation.

**Primary recommendation:** Use `notificationService.send()` for push (do not re-implement); adapt the signed URL pattern from `storage.ts` for the coach-videos route; use `VideoExportPreset.H264_1920x1080` for iOS H.264 enforcement; next migration is 057.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Supabase bucket + SQL migration | Database / Storage | — | Bucket RLS and table schema live in Supabase, applied via migration |
| Signed URL generation + video record creation | API / Backend (Hono) | — | Service role key must never leave the server; Hono owns the two-endpoint flow |
| Video pick/record + H.264 enforcement | Mobile client | — | `videoExportPreset` is a picker-time option; bytes go direct to Storage from mobile |
| XHR upload + progress UI | Mobile client | — | XHR PUT to signed URL; progress events surfaced in the UI |
| Title confirmation bottom sheet | Mobile client | — | React Native Modal, pure UI |
| Videos list ("Vidéos" tab) | Mobile client | — | TanStack Query fetching `coach_client_videos` directly via Supabase client |
| Push notification to coach | API / Backend (Hono) | — | Hono `/complete` endpoint calls `notificationService.send()` after DB insert |
| Push token registration | Mobile client + API | — | Mobile calls `POST /notifications/token` (already exists) with ExponentPushToken |

---

## Standard Stack

### Core (all already installed — no new installs required)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `expo-image-picker` | `~17.0.10` | Video gallery picker + camera recording | Already installed; `launchImageLibraryAsync`/`launchCameraAsync` working in `avatar.tsx` |
| `expo-notifications` | `^0.32.16` | Get push token on device | Already installed |
| `expo-server-sdk` | `^6.1.0` | Send push via Expo Push API from Hono | Already installed in backend; `notificationService.ts` uses it |
| `@supabase/supabase-js` | `^2.47.0` (mobile) / `^2.50.0` (backend) | Storage `createSignedUploadUrl`, DB queries | Project-wide standard |
| `@tanstack/react-query` | `^5.62.0` | Videos list query with cache invalidation | Project-wide standard for server state |
| `hono` | `^4.7.0` | Two new coach-video routes | Project-wide backend framework |

### No new packages needed

All required libraries are already in the project. Phase 45 adds no new npm dependencies.

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| expo-image-picker | npm | ~8 yrs | 40M+/wk | github.com/expo/expo | [OK] | Approved — already installed |
| expo-notifications | npm | ~6 yrs | 20M+/wk | github.com/expo/expo | [OK] | Approved — already installed |
| expo-server-sdk | npm | ~9 yrs | 1M+/wk | github.com/expo/expo-server-sdk | [OK] | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*All packages above tagged `[VERIFIED: npm registry]` — confirmed via `npm view` and slopcheck `[OK]`.*

---

## Architecture Patterns

### System Architecture Diagram

```
[Athlete Mobile]
  |
  |── 1. launchImageLibraryAsync({ mediaTypes:['videos'], videoExportPreset: H264_1920x1080 })
  |          iOS: re-encodes HEVC → H.264/AAC before returning asset URI
  |
  |── 2. POST /coach/videos/upload-url  { athleteId, coachId }
  |          Authorization: Bearer <athlete-jwt>
  |
  v
[Hono API]
  |── validates auth, resolves coach_id from coach_client_links
  |── supabaseAdmin.storage.from('coach-videos').createSignedUploadUrl(path, { expiresIn: 900 })
  |── generates videoId = crypto.randomUUID()
  |── returns { signedUrl, videoId, path }
  |
  v
[Athlete Mobile]
  |── XHR PUT signedUrl  Content-Type: video/mp4   (bytes direct to Supabase — Hono untouched)
  |── xhr.upload.onprogress → update React state with (loaded/total)*100
  |── on success → show "upload complete" state
  |
  |── 3. POST /coach/videos/:videoId/complete  { title, duration_s }
  |
  v
[Hono API]
  |── INSERT INTO coach_client_videos(id, athlete_id, coach_id, storage_path, title, duration_s, status='ready')
  |── notificationService.send({ recipientUserId: coachId, type:'video_uploaded', ... })
  |── returns { ok: true }
  |
  v
[Expo Push Service]
  |── Delivers to coach device: "📹 Joaquim a uploadé : Squat dos 2026-05-26"
  |
  v
[Videos Tab — Mobile]
  |── useQuery(['coach-videos', userId]) → SELECT * FROM coach_client_videos WHERE athlete_id=userId ORDER BY created_at DESC
  |── renders list: title + date + status badge (uploading/ready/annotated)
```

### Recommended Project Structure

```
supabase/migrations/
  057_coach_videos_schema.sql       # coach_client_videos + coach_video_annotations + RLS + bucket

backend/api/src/coach/videos/
  service.ts                        # Hono router: /upload-url + /:videoId/complete
  db.ts                             # DB queries: createVideoRecord, getVideosByAthlete
  types.ts                          # UploadUrlBody, CompleteVideoBody

apps/mobile/app/(app)/(plugins)/coach/
  dashboard.tsx                     # existing
  videos.tsx                        # NEW: Videos tab route (thin wrapper)

plugins/coach/src/screens/
  CoachScreen.tsx                   # existing — add "Vidéos" tab when linked
  VideoListScreen.tsx               # NEW: video list with upload FAB
  VideoUploadSheet.tsx              # NEW: confirmation bottom sheet component
```

### Pattern 1: Signed URL Upload (Hono side)

```typescript
// Source: backend/api/src/routes/storage.ts (existing pattern, adapted for coach-videos)
// backend/api/src/coach/videos/service.ts

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,   // D-02: service role required for storage.admin
  { auth: { autoRefreshToken: false, persistSession: false } }
);

videosRouter.post('/upload-url', async (c) => {
  const { userId: athleteId } = c.get('auth');
  // Resolve coachId from coach_client_links (must be active link)
  const coachId = await getCoachForAthlete(athleteId);
  if (!coachId) return c.json({ error: 'NOT_LINKED' }, 403);

  const videoId = randomUUID();
  const path = `${athleteId}/${videoId}.mp4`;

  const { data, error } = await supabaseAdmin.storage
    .from('coach-videos')
    .createSignedUploadUrl(path, { expiresIn: 900 });  // D-03: 15 min = 900s

  if (error || !data) return c.json({ error: 'Failed to generate URL' }, 500);

  return c.json({ signedUrl: data.signedUrl, videoId, path });
});
```

### Pattern 2: XHR PUT with Progress (Mobile side)

```typescript
// Source: verified from Expo docs + existing avatar.tsx upload pattern
// XHR replaces supabase.storage.upload() to expose progress events
// Fixed in Expo SDK 54 iOS dev builds (issue #34641 — fixed Feb 2026)

async function uploadVideoWithProgress(
  signedUrl: string,
  localUri: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', 'video/mp4');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));

    // React Native: send file URI directly — avoids fetch().blob() which fails on Android
    xhr.send({ uri: localUri, type: 'video/mp4', name: 'upload.mp4' } as any);
  });
}
```

### Pattern 3: expo-image-picker Video with H.264 Enforcement

```typescript
// Source: expo-image-picker types verified from node_modules/expo-image-picker/src/ImagePicker.types.ts
// VideoExportPreset.H264_1920x1080 = 7 — Resolution 1920x1080, H.264 + AAC (INFRA-02)
// iOS ONLY: videoExportPreset is ignored on Android (Android returns original format)

import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['videos'],             // new string array API (MediaTypeOptions enum deprecated)
  allowsEditing: false,               // must be false for videoExportPreset to apply
  videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
  videoMaxDuration: 0,               // no limit (D: deferred)
});

if (!result.canceled && result.assets?.[0]) {
  const asset = result.assets[0];
  const durationMs = asset.duration ?? 0;          // milliseconds
  const durationSec = Math.round(durationMs / 1000);
  const localUri = asset.uri;
  // asset.mimeType should be 'video/mp4' after H.264 export
}
```

### Pattern 4: Push Notification (using existing notificationService)

```typescript
// Source: backend/api/src/services/notificationService.ts (already implemented)
// Do NOT call Expo Push API directly — use the existing service which handles
// idempotency, quiet hours, DeviceNotRegistered cleanup, and notification_log.

import { notificationService } from '../../services/notificationService.js';

// In /coach/videos/:videoId/complete handler, after INSERT:
await notificationService.send({
  recipientUserId: coachId,
  category: 'coach',
  type: 'video_uploaded',
  title: '📹 Nouvelle vidéo',
  body: `${athleteName} a uploadé une nouvelle vidéo : ${title}`,
  data: { url: `/coach/clients/${athleteId}/videos`, videoId },
  idempotencyKey: `video_uploaded_${videoId}`,
});
```

### Pattern 5: Videos Tab as additional State C content

```typescript
// Source: apps/mobile/app/(app)/(plugins)/coach/dashboard.tsx pattern
// The Videos tab is added within CoachScreen.tsx (State C conditional rendering)
// Route file: apps/mobile/app/(app)/(plugins)/coach/videos.tsx

// apps/mobile/app/(app)/(plugins)/coach/videos.tsx
import VideoListScreen from '@ziko/plugin-coach/screens/VideoListScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachVideosRoute() {
  return <VideoListScreen supabase={supabase} />;
}
```

### Anti-Patterns to Avoid

- **Calling Expo Push API directly from `/complete`:** The codebase has `notificationService.ts` which handles idempotency, quiet hours, token validation, and `notification_log`. Bypassing it creates duplicate sends and breaks the notification inbox.
- **Using `supabase.storage.upload()` for video:** The `formData` approach from `avatar.tsx` does not expose `upload` progress events. Must use XHR PUT for UPLOAD-02.
- **`videoExportPreset` with `allowsEditing: true`:** Combining these is unsupported — `allowsEditing` disables the export preset on iOS. Keep `allowsEditing: false` for video.
- **Using `MediaTypeOptions.Videos`:** This enum is deprecated. Use `mediaTypes: ['videos']` string array.
- **Creating a new simplified push path:** Do NOT add `expo_push_token TEXT` to `user_profiles` as CONTEXT.md D-04 suggests. The `notification_tokens` table already exists and is the correct approach. The planner should use `notificationService.send()` instead.
- **Registering push token via a new endpoint:** `POST /notifications/token` already exists and handles UPSERT. The mobile side just needs to call it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push notification delivery | Custom HTTP fetch to Expo Push API with no idempotency | `notificationService.send()` (existing) | Handles idempotency key, quiet hours, `notification_log`, `DeviceNotRegistered` deactivation |
| Push token storage | New `expo_push_token TEXT` column on `user_profiles` | `notification_tokens` table + `POST /notifications/token` (both existing) | Already implemented with multi-device support and `is_active` deactivation |
| Storage upload progress | `supabase.storage.upload()` with FormData | XHR PUT with `xhr.upload.onprogress` | The Supabase JS SDK `upload()` does not expose byte-level progress events |
| videoId generation | Custom ID scheme | `crypto.randomUUID()` (Node built-in) | UUID matches `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` in migration |
| RLS for coach-videos | Custom SECURITY DEFINER function | `is_coach_of()` (existing, migration 035) | Already audited, indexed, and in production |

**Key insight:** This phase's value is wiring together existing infrastructure (notificationService, storageRouter pattern, is_coach_of RLS), not building new primitives.

---

## Architectural Note: Critical Routing Correction

**CONTEXT.md D-06 specifies route `app/(app)/(plugins)/mon-coach/videos.tsx`** — but the actual plugin directory is `apps/mobile/app/(app)/(plugins)/coach/`, not `mon-coach/`. The plugin ID is `coach`, the manifest route is `/(plugins)/coach/dashboard`, and the wrapper file is `coach/dashboard.tsx`.

The correct route file path is: `apps/mobile/app/(app)/(plugins)/coach/videos.tsx`

The plugin screen component lives in: `plugins/coach/src/screens/VideoListScreen.tsx` (new file)

---

## SQL Migration Plan (Migration 057)

Next available migration number is **057** (migration 056 = `056_dashboard_widgets.sql`).

```sql
-- 057_coach_videos_schema.sql

SET LOCAL lock_timeout = '5s';

-- 1. coach_client_videos table (INFRA-04)
CREATE TABLE IF NOT EXISTS public.coach_client_videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,       -- e.g. "{athleteId}/{videoId}.mp4"
  title         TEXT NOT NULL CHECK (char_length(title) <= 200),
  duration_s    INTEGER,             -- NULL allowed (optional from mobile)
  status        TEXT NOT NULL DEFAULT 'ready'
                  CHECK (status IN ('uploading', 'ready', 'annotated')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_client_videos_athlete ON public.coach_client_videos(athlete_id, created_at DESC);
CREATE INDEX idx_coach_client_videos_coach   ON public.coach_client_videos(coach_id, created_at DESC);

ALTER TABLE public.coach_client_videos ENABLE ROW LEVEL SECURITY;

-- Athlete reads/inserts their own videos
CREATE POLICY "coach_client_videos_athlete"
  ON public.coach_client_videos
  FOR ALL
  USING (auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = athlete_id);

-- Coach reads videos of their linked athletes
CREATE POLICY "coach_client_videos_coach_read"
  ON public.coach_client_videos
  FOR SELECT
  USING (public.is_coach_of(auth.uid(), athlete_id));

-- Coach can update status (e.g. to 'annotated' in Phase 46)
CREATE POLICY "coach_client_videos_coach_update"
  ON public.coach_client_videos
  FOR UPDATE
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- 2. coach_video_annotations table (INFRA-04, used in Phase 46)
CREATE TABLE IF NOT EXISTS public.coach_video_annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID NOT NULL REFERENCES public.coach_client_videos(id) ON DELETE CASCADE,
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_s NUMERIC(10,3) NOT NULL,   -- timecode in seconds, 3 decimal places
  type        TEXT NOT NULL CHECK (type IN ('text', 'voice')),
  content     TEXT,                      -- text annotation body or cleaned transcript
  audio_path  TEXT,                      -- storage path for voice annotation blob
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_video_annotations_video ON public.coach_video_annotations(video_id, timestamp_s);

ALTER TABLE public.coach_video_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_video_annotations_coach"
  ON public.coach_video_annotations
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Athlete reads annotations on their own videos
CREATE POLICY "coach_video_annotations_athlete_read"
  ON public.coach_video_annotations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_client_videos v
      WHERE v.id = video_id AND v.athlete_id = auth.uid()
    )
  );

-- 3. Supabase Storage bucket: coach-videos
-- IMPORTANT: Bucket creation is done via Supabase Dashboard/CLI, not SQL migration.
-- SQL below creates a storage policy assuming bucket 'coach-videos' exists.

-- Athletes can upload to their own folder: {athlete_id}/{videoId}.mp4
CREATE POLICY "coach_videos_athlete_upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'coach-videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Athletes can read their own videos
CREATE POLICY "coach_videos_athlete_read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'coach-videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Coaches can read videos in folders that belong to their linked athletes
CREATE POLICY "coach_videos_coach_read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'coach-videos' AND
    public.is_coach_of(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
```

**Note:** Supabase storage bucket creation must be done via dashboard or CLI command (`supabase storage buckets create coach-videos --private`), not via SQL. The SQL above creates the RLS policies on `storage.objects`.

---

## Common Pitfalls

### Pitfall 1: Android ignores videoExportPreset
**What goes wrong:** `VideoExportPreset.H264_1920x1080` is iOS-only. On Android, the picker returns whatever format is in the gallery — typically MP4/H.264 already on modern devices, but not guaranteed.
**Why it happens:** Android doesn't use UIImagePickerController and has no equivalent `videoExportPreset`.
**How to avoid:** Accept the Android behavior as-is for v1.13 (most modern Android devices store as H.264). The main concern is HEVC on iOS, which is solved by the preset. If Android HEVC ever becomes an issue, it can be addressed post-v1.13 with `expo-video-thumbnails` or a re-encode step.
**Warning signs:** Coach sees "unsupported format" in web player (Phase 46). Flag for investigation at that point.

### Pitfall 2: XHR upload progress on iOS dev builds (historical, now fixed)
**What goes wrong:** `xhr.upload.onprogress` was not firing on iOS in `expo-dev-client` builds (Expo SDK 49–53).
**Why it happens:** A regression introduced in SDK 49, tracked as issue #34641 and #28269.
**How to avoid:** The project is on Expo SDK `~54.0.0`. The fix was confirmed shipped in SDK 54 (Feb 2026 changelog: "[iOS] Fixed missing upload progress from `XMLHttpRequest` when network inspector is enabled"). No action needed — just proceed with standard XHR pattern.
**Warning signs:** Progress bar stuck at 0% on iOS physical device. If this occurs in QA, disable "Network Inspector" in Expo dev tools as a temporary workaround.

### Pitfall 3: videoExportPreset ignored when allowsEditing is true
**What goes wrong:** If `allowsEditing: true` is set, iOS ignores `videoExportPreset` entirely.
**Why it happens:** UIImagePickerController editing flow overrides the export preset.
**How to avoid:** Always set `allowsEditing: false` for video picks. Confirmed in CONTEXT.md D-08/D-09 — the confirmation sheet is the UX; no in-picker editing needed.

### Pitfall 4: Signed URL path ownership validation
**What goes wrong:** Without path validation, any authenticated user could generate a signed URL for another user's path.
**Why it happens:** `createSignedUploadUrl` accepts any path if called with service role key.
**How to avoid:** The Hono endpoint must verify `path.startsWith(`${athleteId}/`)` before calling `createSignedUploadUrl`. This is the same pattern in `storage.ts` line 38.

### Pitfall 5: Duplicate push notifications on retry
**What goes wrong:** Network timeout on `/complete` causes mobile to retry, sending the push twice.
**Why it happens:** `/complete` is not inherently idempotent.
**How to avoid:** Use `videoId` as the idempotency key in `notificationService.send()`: `idempotencyKey: \`video_uploaded_${videoId}\`` — the `notification_log` UNIQUE constraint on `idempotency_key` prevents duplicate sends automatically.

### Pitfall 6: Using user_profiles.expo_push_token instead of notification_tokens
**What goes wrong:** CONTEXT.md D-04 specifies storing push token in `user_profiles.expo_push_token` column, but this column does not exist — the codebase uses `notification_tokens` table instead.
**Why it happens:** CONTEXT.md predates the discovery of `054_notification_schema.sql` and `notificationService.ts`.
**How to avoid:** Use `POST /notifications/token` (already exists) for token registration. Use `notificationService.send()` (already exists) for sending. Do NOT add `expo_push_token` column to `user_profiles`.

### Pitfall 7: Bucket creation via SQL only (incomplete)
**What goes wrong:** SQL `CREATE POLICY` on `storage.objects` fails silently if the bucket `coach-videos` does not exist.
**Why it happens:** Supabase buckets are created via the storage API, not raw SQL.
**How to avoid:** Migration 057 creates the RLS policies. The planner must include a separate step to create the bucket: either `supabase storage buckets create coach-videos --private` via CLI, or via Supabase Dashboard → Storage → "New bucket". This is a prerequisite to the migration RLS policies working.

### Pitfall 8: Coach-id lookup in upload-url endpoint
**What goes wrong:** The Hono `/upload-url` endpoint must resolve the athlete's current coach from `coach_client_links` — but `coach_client_links` has `revoked_at` lifecycle. A stale link must not grant upload access.
**Why it happens:** `is_coach_of()` handles this in RLS, but the Hono endpoint needs to do the lookup itself to return `coachId` in the response.
**How to avoid:** Query `coach_client_links WHERE client_id=$athleteId AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`. This mirrors the `is_coach_of()` predicate exactly.

---

## Code Examples

### Upload flow (complete mobile sequence)

```typescript
// Source: verified from expo-image-picker types + avatar.tsx pattern + XHR upload gist
// plugins/coach/src/screens/VideoUploadSheet.tsx (outline)

async function handleUpload(localUri: string, durationMs: number, title: string) {
  // Step 1: Get signed URL from Hono
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const urlRes = await fetch(`${API_URL}/coach/videos/upload-url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const { signedUrl, videoId } = await urlRes.json();

  // Step 2: XHR PUT with progress
  await uploadVideoWithProgress(signedUrl, localUri, (pct) => setProgress(pct));

  // Step 3: Complete (inserts DB row + triggers push)
  const durationSec = Math.round(durationMs / 1000);
  await fetch(`${API_URL}/coach/videos/${videoId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, duration_s: durationSec }),
  });

  // Step 4: Invalidate videos list
  queryClient.invalidateQueries({ queryKey: ['coach-videos'] });
}
```

### Push token registration (mobile, on coach app open)

```typescript
// Source: docs.expo.dev/push-notifications/push-notifications-setup (verified)
// apps/mobile/src/ — called when coach is in linked state

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

async function registerPushToken(apiUrl: string, token: string) {
  if (!Device.isDevice) return; // push not supported on simulator

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId
    ?? Constants?.easConfig?.projectId;   // = "9b672c1a-10c4-4d66-882c-b9a08294650f"

  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  const deviceId = /* stable UUID from MMKV (create once, persist) */ getOrCreateDeviceId();

  await fetch(`${apiUrl}/notifications/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
      deviceId,
    }),
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ImagePicker.MediaTypeOptions.Videos` enum | `mediaTypes: ['videos']` string array | SDK 47+ | Old enum still works but deprecated — use string array |
| `supabase.storage.upload()` for large files | XHR PUT to signed URL | RN convention | Only XHR exposes `upload.onprogress` events |
| `user_profiles.expo_push_token TEXT` (CONTEXT.md D-04) | `notification_tokens` table + `notificationService` | Already in codebase | Full multi-device push infrastructure already exists — use it |
| Bare `fetch('https://exp.host/--/api/v2/push/send')` | `expo-server-sdk` + `notificationService.send()` | Migration 054 era | Idempotency, quiet hours, receipt tracking all handled |

**Deprecated/outdated (in CONTEXT.md):**
- **D-04 `user_profiles.expo_push_token` column approach:** CONTEXT.md was written before `054_notification_schema.sql` and `notificationService.ts` were discovered. These supersede the simplified approach. The planner MUST use the existing `notificationService` and `notification_tokens` table.
- **D-05 "upsert into user_profiles.expo_push_token":** Replaced by `POST /notifications/token` endpoint which already exists.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Android devices in this app's target audience store videos as H.264 by default | Common Pitfalls #1 | Coach would see format errors in web player on Phase 46; fixable post-discovery |
| A2 | XHR upload progress fix in SDK 54 applies to `~54.0.0` pin in this project | Common Pitfalls #2 | Progress bar stuck on iOS; workaround: disable network inspector in dev |
| A3 | `storage.foldername(name)` utility function is available in this Supabase project's version | SQL Migration Plan | Storage RLS policies would fail; fallback: use `split_part(name, '/', 1)` instead |

**If this table is empty:** All other claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **D-04 vs. existing notification infrastructure conflict**
   - What we know: CONTEXT.md D-04 says to use `user_profiles.expo_push_token` column. The codebase already has `notification_tokens` table, `notificationService.ts`, and `POST /notifications/token` endpoint.
   - What's unclear: Whether the user wants to follow D-04 literally (add a column that will be "migrated later") or use the already-production-ready infrastructure.
   - Recommendation: **Use the existing `notificationService` and `notification_tokens` table.** It is strictly better and already in production. The planner should diverge from D-04/D-05 here and document the override decision.

2. **Bucket creation step ordering**
   - What we know: Supabase bucket must be created before migration 057 storage policies can be tested.
   - What's unclear: Whether Supabase CLI (`supabase storage buckets create`) is available in the target execution environment, or whether the bucket must be created via Dashboard.
   - Recommendation: Plan must include an explicit bucket creation task (Wave 0 or Wave 1) with both CLI and Dashboard instructions as options.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-image-picker | UPLOAD-01, INFRA-02 | ✓ | ~17.0.10 (installed) | — |
| expo-notifications | UPLOAD-04 (token) | ✓ | ^0.32.16 (installed) | — |
| expo-server-sdk | UPLOAD-04 (send) | ✓ | ^6.1.0 (backend) | — |
| SUPABASE_SERVICE_KEY | INFRA-01, D-02 | ✓ (in .env.example, pattern established in storage.ts + auth.ts) | — | No fallback — required |
| EXPO_ACCESS_TOKEN | notificationService.ts | Unknown (env var) | — | Expo Push works without access token for unencrypted sends; token adds enhanced delivery |
| Expo Dev Build (EAS) | XHR upload + push on device | Prerequisite (per ROADMAP) | — | No fallback — managed Expo insufficient for XHR large file upload |
| Supabase Pro plan | coach-videos bucket (large files) | Prerequisite (per ROADMAP) | — | Free tier 50 MB cap makes video upload impossible |

**Missing dependencies with no fallback:**
- `SUPABASE_SERVICE_KEY` must be set in backend `.env` (already documented in `.env.example`)
- Expo Dev Build must be confirmed active before testing upload on device

**Missing dependencies with fallback:**
- `EXPO_ACCESS_TOKEN`: Optional for basic push delivery; only required for encrypted Expo Push API access

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^3.2.4 |
| Config file | `backend/api/vitest.config.ts` (if exists) or vitest defaults |
| Quick run command | `cd backend/api && npx vitest run --reporter=verbose` |
| Full suite command | `cd backend/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03 | `/upload-url` returns `{ signedUrl, videoId }` for linked athlete | unit (mocked Supabase) | `npx vitest run src/coach/videos/service.test.ts -t "upload-url"` | ❌ Wave 0 |
| INFRA-03 | `/upload-url` returns 403 for unlinked athlete | unit | `npx vitest run src/coach/videos/service.test.ts -t "upload-url 403"` | ❌ Wave 0 |
| INFRA-04 | `/complete` inserts DB row with correct fields | unit (mocked DB) | `npx vitest run src/coach/videos/service.test.ts -t "complete"` | ❌ Wave 0 |
| UPLOAD-04 | `/complete` calls notificationService with correct payload | unit (mocked notificationService) | `npx vitest run src/coach/videos/service.test.ts -t "push"` | ❌ Wave 0 |
| UPLOAD-02 | XHR progress events fire during upload | manual-only (requires physical device + EAS build) | — | manual |
| UPLOAD-01 | Video picker returns H.264 asset on iOS | manual-only (requires physical iOS device) | — | manual |

### Sampling Rate
- Per task commit: `cd backend/api && npx vitest run src/coach/videos/`
- Per wave merge: `cd backend/api && npx vitest run`
- Phase gate: Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/api/src/coach/videos/service.test.ts` — covers INFRA-03, INFRA-04, UPLOAD-04
- [ ] `backend/api/src/coach/videos/db.test.ts` — covers DB query functions (optional, lower priority)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Hono `authMiddleware` (Supabase JWT) on all `/coach/videos/*` routes |
| V3 Session Management | no | Stateless JWT — no session management |
| V4 Access Control | yes | `is_coach_of()` RLS — coach reads only their linked athletes' videos; athlete path ownership check in Hono |
| V5 Input Validation | yes | Zod or inline validation on `/complete` body (`title` required, `duration_s` integer) |
| V6 Cryptography | no | Signed URLs generated by Supabase SDK — no hand-rolled crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal (athlete uploads to another user's path) | Spoofing | Hono validates `path.startsWith(athleteId + '/')` before calling `createSignedUploadUrl` |
| Expired signed URL reuse | Elevation of Privilege | Supabase signed URL expiry enforced server-side (900s TTL, D-03) |
| Push notification spam / duplicate push | Denial of Service | `idempotencyKey = "video_uploaded_${videoId}"` in `notificationService.send()` |
| Unlinked athlete bypassing upload | Elevation of Privilege | Hono `/upload-url` rejects if no active `coach_client_links` row found |
| Storage RLS bypass via direct API | Spoofing | Storage bucket is `private`; `is_coach_of()` RLS on `storage.objects` |

---

## Sources

### Primary (HIGH confidence)
- Locally installed `node_modules/expo-image-picker/src/ImagePicker.types.ts` — `VideoExportPreset` enum values, `MediaType` array API, `duration` field on assets `[VERIFIED: codebase]`
- `backend/api/src/services/notificationService.ts` — full push pipeline already in codebase `[VERIFIED: codebase]`
- `backend/api/src/routes/notifications.ts` — `POST /notifications/token` endpoint already exists `[VERIFIED: codebase]`
- `backend/api/src/routes/storage.ts` — `createSignedUploadUrl` pattern `[VERIFIED: codebase]`
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of()` function definition `[VERIFIED: codebase]`
- `supabase/migrations/054_notification_schema.sql` — `notification_tokens` table schema `[VERIFIED: codebase]`
- `apps/mobile/app/(app)/profile/avatar.tsx` — `expo-image-picker` + FormData upload pattern `[VERIFIED: codebase]`
- [Expo ImagePicker docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/) — `videoExportPreset` options, `duration` field `[CITED: docs.expo.dev]`
- [Expo Push Notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) — `getExpoPushTokenAsync` with `projectId` `[CITED: docs.expo.dev]`

### Secondary (MEDIUM confidence)
- Expo SDK 54 changelog (Feb 2026): "[iOS] Fixed missing upload progress from `XMLHttpRequest` when network inspector is enabled" `[CITED: expo.dev/changelog/sdk-54]`
- GitHub issue #34641 (closed May 2025): XHR `onprogress` issue on iOS dev builds — confirmed resolved in SDK 54 context `[CITED: github.com/expo/expo/issues/34641]`

### Tertiary (LOW confidence)
- None — all critical claims verified from codebase or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in installed `node_modules` and `package.json`
- Architecture: HIGH — patterns traced directly from existing codebase implementations
- Pitfalls: HIGH — XHR issue confirmed via official Expo changelog; other pitfalls from code analysis
- SQL migration: HIGH — `is_coach_of()` RLS pattern directly copied from migration 035
- Push notification: HIGH — existing `notificationService.ts` is fully implemented and registered in `app.ts`

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (Expo SDK 54 stable; infrastructure will not change in 30 days)
