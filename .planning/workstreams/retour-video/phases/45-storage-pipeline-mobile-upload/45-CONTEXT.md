# Phase 45: Storage Pipeline & Mobile Upload — Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

An athlete can select or record a technique video on mobile, add a title, and upload it directly to the `coach-videos` Supabase Storage bucket via signed URL (bytes never touch Hono). The coach receives an Expo push notification when upload completes. The athlete sees a list of their previously uploaded videos in a new "Vidéos" tab inside the Mon coach plugin.

**This phase does NOT include:** web player, annotations, or athlete annotation review (Phase 46). No voice pipeline (Phase 47).
</domain>

<decisions>
## Implementation Decisions

### Hono Endpoint Design
- **D-01:** Two-endpoint flow — `POST /coach/videos/upload-url` returns `{ signedUrl, videoId }`. Mobile XHRs PUT directly to Supabase. Then `POST /coach/videos/:videoId/complete` with `{ title, duration_s }`. Hono inserts the DB row and triggers push on the second call.
- **D-02:** Signed URLs generated using Supabase **service role** (new `SUPABASE_SERVICE_KEY` backend env var). Publishable key lacks storage.admin needed for `createSignedUploadUrl`.
- **D-03:** Signed URL expiry: **15 minutes** (sufficient for 500 MB on typical mobile connection).

### Push Notification
- **D-04:** Implement minimal Expo push in this phase — **do not wait for v1.11**. Store coach's Expo push token in a new `expo_push_token TEXT` column on `user_profiles`. Hono sends via Expo Push API (`https://exp.host/--/api/v2/push/send`) from the `/complete` endpoint. v1.11 can migrate token storage to a dedicated table later.
- **D-05:** Token registration: when the coach opens the web or mobile coach app, it calls Hono to upsert their push token into `user_profiles.expo_push_token`.

### Upload Screen Placement (Mobile)
- **D-06:** New **"Vidéos" tab** inside the existing Mon coach plugin — available only in State C (athlete linked to a coach). Route: `app/(app)/(plugins)/mon-coach/videos.tsx`. No new top-level navigation needed.
- **D-07:** Videos tab shows a **list of uploaded videos** (title, date, status: uploading / ready / annotated) plus a floating "Uploader une vidéo" button. This gives the athlete a history view without waiting for Phase 46.

### Title Input UX
- **D-08:** Title is entered on a **confirmation bottom sheet** that appears after the athlete picks or records the video. Two-step flow: pick video → sheet appears with title + duration preview + Upload button.
- **D-09:** Auto-suggested title format: `"Exercice YYYY-MM-DD"` (date of upload, e.g. "Exercice 2026-05-26"). Athlete can edit before uploading.
- **D-10:** Title is **required** — Upload button disabled if the title field is empty. Auto-suggestion ensures low friction while guaranteeing the coach always sees a meaningful label.

### Already-Locked Requirements (from ROADMAP + STATE)
- Video bytes never pass through Hono — signed URL PUT pattern (INFRA-03) ✓
- iOS HEVC enforced to H.264/MP4 via `videoExportPreset` at picker time (INFRA-02) ✓
- Bucket `coach-videos`, path `{athleteId}/{videoId}.mp4` (INFRA-01) ✓
- `coach_client_videos` schema: `(id, athlete_id, coach_id, storage_path, title, duration_s, created_at, status)` (INFRA-04) ✓
- `is_coach_of()` RLS function already exists (migration 035) ✓
- Expo Dev Build (EAS) required — prerequisite before execution ✓
- Supabase Pro plan required — prerequisite before execution ✓

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/retour-video/ROADMAP.md` — Phase 45 goal, success criteria, prereqs
- `.planning/workstreams/retour-video/REQUIREMENTS.md` — UPLOAD-01..04, INFRA-01..04 full definitions

### Existing Upload Pattern (Codebase)
- `apps/mobile/app/(app)/profile/avatar.tsx` — existing `expo-image-picker` + `supabase.storage.upload()` pattern (images only, no progress bar; this phase uses XHR instead for progress events)

### RLS & Coach-Athlete Schema
- `supabase/migrations/035_coach_invitations_links_rls.sql` — `is_coach_of()` function and `coach_client_links` table; RLS policy pattern to copy for `coach_client_videos`

### Push Notification Reference
- `apps/mobile/app/(app)/notifications.tsx` — current mock notifications screen (no real push impl yet — reference for UI pattern only)

### Mon Coach Plugin (entry point)
- `plugins/` — search for mon-coach plugin directory to understand State C structure and where the new Videos tab attaches

### Migration Sequence
- `supabase/migrations/` — latest migration number must be checked before creating Phase 45 migrations; use next available number after migration 044

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/app/(app)/profile/avatar.tsx:6` — `expo-image-picker ~17.0.10` already installed; `launchImageLibraryAsync` + `launchCameraAsync` pattern already working on device
- `expo-notifications ^0.32.16` — already in `apps/mobile/package.json`; `registerForPushNotificationsAsync` can be called without new installs

### Established Patterns
- **Direct storage upload via FormData:** `avatar.tsx` uses `supabase.storage.from('avatars').upload(path, formData)` — works on Android physical devices. Phase 45 needs XHR instead to expose `upload` progress events; FormData approach doesn't surface byte-level progress.
- **Supabase client on mobile:** `apps/mobile/src/lib/supabase.ts` — existing singleton; import as usual
- **`showAlert` everywhere in plugins:** `showAlert` from `@ziko/plugin-sdk` must replace `Alert.alert` in the new upload screen (CLAUDE.md rule)
- **`paddingBottom: 100`** — all plugin screens use this for tab bar clearance

### Integration Points
- Mon coach plugin — State C (linked state) gets a new "Vidéos" tab; check how existing tabs are structured in that plugin
- Hono backend `backend/api/src/routes/` — new `coach-videos.ts` route file following existing route pattern (auth middleware already handles Supabase JWT)
- Supabase migration — INFRA-04 `coach_client_videos` table and `coach_video_annotations` table need a new migration; use `is_coach_of()` in RLS policies

</code_context>

<specifics>
## Specific Ideas

- Confirmation sheet shows video duration (derived from `expo-image-picker` asset metadata) so athlete can sanity-check they picked the right clip before uploading
- Upload status in video list: `uploading` (spinner + progress %), `ready` (green dot), `annotated` (orange dot — for when Phase 46 ships). Status field drives the list item visual.
- Push notification body: "📹 [athlete name] a uploadé une nouvelle vidéo : [title]" — concise, actionable for coach

</specifics>

<deferred>
## Deferred Ideas

- Video duration / size cap at picker time — no hard limit enforced in Phase 45; Supabase Pro handles up to 5 GB per file. Can add if needed based on real usage.
- Upload resumable TUS (> 500 MB) — explicitly deferred post-v1.13 per REQUIREMENTS.md
- Thumbnail generation (FFmpeg WASM) — deferred post-v1.13
- Token storage migration to `notification_tokens` table — deferred to v1.11; current `user_profiles.expo_push_token` column is the bridge

</deferred>

---

*Phase: 45 — Storage Pipeline & Mobile Upload*
*Context gathered: 2026-05-26*
