# Phase 46: Web Player & Text Annotations — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The coach can open any athlete-uploaded video in a dedicated player page, annotate it at precise timecodes using a text composer in a lateral panel, and send the complete feedback to the athlete in one batch push notification. The athlete can open their annotated videos from the same "Vidéos" tab in the Mon coach mobile plugin and review each annotation with seek-to-timecode using expo-video + a custom annotation overlay.

**This phase does NOT include:** voice annotations (Phase 47). No new top-level navigation — everything lives inside the existing ClientTabStrip and Mon coach plugin.
</domain>

<decisions>
## Implementation Decisions

### Player Page Layout
- **D-01:** The "Vidéos" tab shows the video list first. Clicking a video navigates to a **new sub-page** `/coach/clients/[id]/videos/[videoId]`. The ClientTabStrip stays visible above; back = video list. Clean URL per video, sharable.
- **D-02:** On the player sub-page, the **sticky notes panel (w-72) is hidden**. The annotation panel takes the full right column. The player and annotation panel split **2/3 / 1/3** of the page width.
- **D-03:** The `/videos` list page lives at `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx`. The player page lives at `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/[videoId]/page.tsx`.

### Annotation Creation UX
- **D-04:** Coach creates an annotation by **pausing the video → clicking 'Annoter à ce moment'** button below the player. Player timestamp is captured at that moment.
- **D-05:** After clicking 'Annoter', the **right panel switches to a composer view** (list hidden temporarily): timestamp displayed read-only, textarea for text, Save / Cancel buttons. After save, the annotation list reappears with the new entry.
- **D-06:** Annotation **markers on the Vidstack scrub bar** are rendered as **small orange dots** (primary color, `#FF5C1A`) pinned at the timestamp % position. Hovering a dot shows the annotation text in a tooltip. Clicking a dot in the panel or the dot on the timeline seeks the player to that timecode.

### Push Notification — Batch Send
- **D-07:** The coach annotates freely. When done, they click **'Envoyer le retour'** in the annotation panel. This calls a single Hono endpoint that:
  1. Updates `coach_client_videos.status` → `annotated`
  2. Sends one Expo push notification to the athlete
  After send, the button changes to 'Retour envoyé' (disabled) and cannot be resent.
- **D-08:** Push notification body: `"📹 [coach name] a analysé votre vidéo : [video title]"` — same Expo Push API pattern as Phase 45.

### Athlete Mobile Review (Mon coach plugin)
- **D-09:** The existing `VideoListScreen` (Phase 45) is extended: tapping a video with status `annotated` opens a **VideoPlayerScreen** (new screen in the plugin).
- **D-10:** `VideoPlayerScreen` uses **expo-video** (Expo SDK 54 native module) to render the video. A **custom annotation timeline strip** is overlaid below the player: orange dots positioned at `(timestamp_s / duration_s) * 100%`. Tapping a dot seeks the video to that timecode and shows a comment card below.
- **D-11:** Signed URL for mobile playback: fetched from Hono via `GET /coach/videos/:videoId/signed-url`. Short expiry (15 min) refreshed on screen open.

### Already-Locked (from ROADMAP + Phase 45)
- `coach_video_annotations` schema: id, video_id, coach_id, timestamp_s, type, content, audio_path ✓
- `coach_client_videos.status` enum: uploading / ready / annotated ✓
- `is_coach_of()` RLS used for all coach reads ✓
- No dark mode — light sport theme only ✓
- `@vidstack/react` specified in ROADMAP for web player ✓

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/retour-video/ROADMAP.md` — Phase 46 goal, success criteria, player/annotation requirements
- `.planning/workstreams/retour-video/REQUIREMENTS.md` — PLAYER-01, PLAYER-02, ANNOT-01, ANNOT-02, ANNOT-03, REVIEW-01, REVIEW-02 full definitions

### Phase 45 Context (decisions carried forward)
- `.planning/workstreams/retour-video/phases/45-storage-pipeline-mobile-upload/45-CONTEXT.md` — DB schema, bucket, signed URL pattern, push notification pattern

### Existing Web Patterns
- `apps/web/src/components/coach/ClientTabStrip.tsx` — 10-tab strip; add "Vidéos" as tab 11 (key: `videos`, label: `Vidéos`)
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` — client detail layout with notes panel; player sub-page must hide the notes panel (`w-72 shrink-0`) conditionally
- `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` — reference for complex state machine + GSAP entrance animation pattern in coach web components
- `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/vocal/page.tsx` — simplest tab page pattern (page.tsx → client component)

### Existing Mobile Patterns
- Phase 45 mobile screens (VideoListScreen, VideoUploadSheet) — in Mon coach plugin; VideoPlayerScreen hooks in as a new screen accessible from VideoListScreen
- `apps/mobile/app/(app)/profile/avatar.tsx` — expo-image-picker pattern (reference for asset metadata)

### Design System
- `CLAUDE.md` — Design tokens: primary `#FF5C1A`, background `#F7F6F3`, border `#E2E0DA`, text `#1C1A17`, muted `#6B6963`
- All mobile screens: `paddingBottom: 100` for tab bar clearance
- `showAlert` from `@ziko/plugin-sdk` (NOT `Alert.alert`) in plugin screens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/coach/vocal/useVocalRecorder.ts` — MIME type detection pattern (WebM/Opus vs MP4/AAC) — relevant for Phase 47; not Phase 46
- `apps/web/src/components/coach/NavItem.tsx` — active state logic via `usePathname().startsWith(href)` — same pattern for "Vidéos" tab active detection
- `fetch` with `credentials: 'include'` — established auth pattern in web client components (see `ClientDetailHeader.tsx` → `RevokeClientButton`)

### Established Patterns
- **Server component page.tsx → client component** pattern: all client detail tabs follow this (page.tsx imports and renders a Client component). VideoListPage and VideoPlayerPage follow the same.
- **`force-dynamic` + `revalidate = 0`** on coach routes (`layout.tsx` line 1-2) — applies to new video pages automatically via the coach layout.
- **Hono API fetch from server component**: `fetch(`${apiUrl}/coach/clients/${clientId}/summary`, { headers: { Authorization: \`Bearer ${jwt}\` } })` — copy this pattern for fetching video list and annotations.

### Integration Points
- `ClientTabStrip.tsx` — add `{ key: 'videos', label: 'Vidéos' }` to TABS array
- `ClientDetailLayout` — the notes panel (`hidden lg:block w-72 shrink-0`) must be hidden on `/videos/*` sub-pages; detect via `pathname.includes('/videos')` in the layout or use a client-side conditional
- Hono backend: new route file `backend/api/src/routes/coach-video-annotations.ts` (or extend `coach-videos.ts` from Phase 45)
- `notification_tokens` table + Expo Push API — push token lookup for athlete's token (athlete sends their token via `POST /notifications/token`)

</code_context>

<specifics>
## Specific Ideas

- The 'Envoyer le retour' button appears in the annotation panel footer only after at least one annotation has been saved. Before that: disabled or hidden.
- After 'Retour envoyé': button label changes and becomes read-only — no resend possible in Phase 46. (Phase 47 can revisit if needed.)
- Annotation list items in the panel: `[MM:SS] — annotation text` sorted by timestamp_s ascending. Clicking an item seeks the player.
- Mobile VideoPlayerScreen: signed URL expires in 15 min — fetch fresh on screen mount; show loading state while URL is obtained.

</specifics>

<deferred>
## Deferred Ideas

- Slow-motion playback speed controls (0.5x / 0.25x) — listed in ROADMAP success criteria but Vidstack supports this natively; planner can include if trivial, defer if complex
- Resend retour / re-notify athlete — explicitly deferred to post-v1.13
- Voice annotations — Phase 47

</deferred>

---

*Phase: 46 — Web Player & Text Annotations*
*Context gathered: 2026-05-27*
