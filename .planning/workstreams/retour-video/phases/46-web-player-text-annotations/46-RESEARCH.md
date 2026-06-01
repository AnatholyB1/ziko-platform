# Phase 46: Web Player & Text Annotations — Research

**Researched:** 2026-05-27
**Domain:** Video player integration (@vidstack/react 1.x), annotation CRUD (Hono), mobile video review (expo-video), Next.js App Router tab/layout integration
**Confidence:** HIGH (core findings) / MEDIUM (expo-video since not yet installed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Videos tab shows list first; clicking navigates to `/coach/clients/[id]/videos/[videoId]` sub-page. ClientTabStrip stays visible. Back = video list. Clean sharable URL.
- D-02: On player sub-page, the sticky notes panel (w-72) is HIDDEN. Annotation panel takes full right column. Player / annotation panel split 2/3 / 1/3.
- D-03: List page at `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx`. Player page at `…/videos/[videoId]/page.tsx`.
- D-04: Coach creates annotation by pausing → clicking 'Annoter à ce moment'. Timestamp captured at click.
- D-05: After 'Annoter', right panel switches to composer view (list hidden). Timestamp read-only, textarea, Save/Cancel. On save, list reappears with new entry.
- D-06: Annotation markers on Vidstack scrub bar = small orange dots (#FF5C1A) pinned at timestamp %. Hovering shows tooltip. Clicking dot or panel item seeks player to that timecode.
- D-07: Coach clicks 'Envoyer le retour' when done. Single Hono endpoint: updates `status → annotated`, sends Expo push to athlete. After send, button → 'Retour envoyé' (disabled, no resend).
- D-08: Push body: `"📹 [coach name] a analysé votre vidéo : [video title]"`. Same Expo Push API pattern as Phase 45.
- D-09: Existing VideoListScreen (Phase 45) extended: annotated video → opens VideoPlayerScreen (new screen in plugin).
- D-10: VideoPlayerScreen uses expo-video + custom annotation timeline strip overlaid below player. Orange dots at `(timestamp_s / duration_s) * 100%`. Tap dot → seek + comment card.
- D-11: Signed URL for mobile playback: `GET /coach/videos/:videoId/signed-url`, 15-min expiry, fetched on screen mount.

### Claude's Discretion
- Slow-motion playback (0.5x / 0.25x) — Vidstack supports natively; include if trivial.
- 'Envoyer le retour' button visibility — appears only after at least one annotation saved.
- Annotation list items: `[MM:SS] — text`, sorted by timestamp_s ascending.

### Deferred Ideas (OUT OF SCOPE)
- Resend retour / re-notify athlete — deferred post-v1.13.
- Voice annotations — Phase 47.
- Telestration, transcription, thumbnails — deferred post-v1.13.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAYER-01 | "Vidéos" tab in client detail listing athlete videos with title, date, status | ClientTabStrip TABS array append + `videos/page.tsx` fetching `coach_client_videos` via existing Hono/Supabase pattern |
| PLAYER-02 | Coach reads video via @vidstack/react — play, pause, seek, progress bar | @vidstack/react 1.15.1 (next tag) confirmed — uses MediaPlayer + MediaProvider + DefaultVideoLayout; `useMediaRemote` hook for `remote.seek(t)` |
| ANNOT-01 | Pause + create timecoded text annotation; colored marker on timeline | Custom overlay approach: absolutely-positioned orange dots on a relative container wrapping TimeSlider — no built-in marker API in Vidstack 1.x |
| ANNOT-02 | Edit/delete existing annotations from lateral panel | Hono PATCH + DELETE endpoints on `coach_video_annotations`; panel list items with inline edit/delete actions |
| ANNOT-03 | Lateral panel lists annotations sorted by timestamp; click seeks player | `useMediaRemote().seek(timestamp_s)` — confirmed working API |
| REVIEW-01 | Athlete sees annotation markers on mobile video timeline | expo-video (new install: `~2.0.6`) + custom View overlay with orange dots at percentage positions |
| REVIEW-02 | Athlete taps marker → seek + comment card shown | `player.currentTime = timestamp_s` in expo-video; annotation data pre-fetched from `GET /coach/videos/:videoId/annotations` |
</phase_requirements>

---

## Summary

Phase 46 delivers the web video player (coach) and mobile annotation review (athlete). Three areas require careful handling:

**@vidstack/react version mismatch.** The ROADMAP specifies `@vidstack/react` but the project uses React 19.2.6 while the `latest` npm tag (0.6.15) only supports React 18. The `next` npm tag (1.15.1) added React 19 support in February 2025. **Install `@vidstack/react@next` (1.15.1), not `@vidstack/react` (0.6.15).** This is a hard blocker if the wrong tag is installed.

**Timeline annotation markers.** Vidstack 1.x has no built-in API for arbitrary colored dot markers (only chapter-based markers exist). The correct approach is to render an absolutely-positioned overlay container over the TimeSlider root — orange dot `<div>`s placed at `left: (timestamp_s / duration_s * 100)%`. This requires reading `duration` from `useMediaState('duration')` and is fully composable with the Vidstack headless API.

**expo-video not installed.** The mobile app currently has `expo-av ~16.0.8` but NOT `expo-video`. `expo-av` is deprecated starting SDK 54 and removed in SDK 55. Phase 46 must install `expo-video` (`~2.0.6` for SDK 54 compatibility). The `useVideoPlayer` hook + `VideoView` component replace `expo-av`'s `Video` component. Seeking is `player.currentTime = seconds`. Time tracking uses `useEvent(player, 'timeUpdate', handler)` after setting `player.timeUpdateEventInterval = 0.25` (seconds).

**Primary recommendation:** Install `@vidstack/react@next` on web and `expo-video` on mobile; use an absolutely-positioned overlay for annotation dot markers on both platforms.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Video list (coach web) | API / Backend | Frontend Server (SSR) | Data from `coach_client_videos` via Hono; page.tsx can SSR fetch or use client fetch |
| Video playback (coach web) | Browser / Client | — | @vidstack/react requires 'use client'; media element is browser-native |
| Annotation CRUD | API / Backend | Browser / Client | Hono routes own persistence; client triggers create/edit/delete and updates UI |
| Annotation markers (web) | Browser / Client | — | Absolutely-positioned overlay on TimeSlider; computed from duration state |
| Signed read URL (mobile) | API / Backend | — | Hono endpoint calls Supabase Storage createSignedUrl with service key |
| Video playback (mobile) | Browser / Client (native) | — | expo-video is native module; VideoPlayerScreen is 'use client' equivalent |
| Annotation markers (mobile) | Browser / Client (native) | — | Custom View overlay with percentage-positioned TouchableOpacity dots |
| Push notification (send) | API / Backend | — | Hono `/send-feedback` endpoint triggers Expo Push API; same pattern as Phase 45 |

---

## @vidstack/react Integration

### Version Selection — CRITICAL

| Tag | Version | React Peer Dep | Use? |
|-----|---------|----------------|------|
| `latest` | 0.6.15 | `^18.0.0` only | **NO** — project uses React 19.2.6 |
| `next` | 1.15.1 | `^18.0.0 \|\| ^19.0.0` | **YES** |

`@vidstack/react@next` was published 2026-05-27 (today). React 19 support was merged February 2025 (PR #1574, issue #1533 closed). [VERIFIED: npm registry]

### Installation

```bash
npm install @vidstack/react@next
```

No additional peer packages required (unlike 0.6.x which required a separate `vidstack` peer).

### CSS for Tailwind v4

The project uses Tailwind v4 (`@import "tailwindcss"` in `apps/web/src/app/globals.css`). Add one line to `globals.css`:

```css
@plugin '@vidstack/react/tailwind.cjs';
```

This enables `media-*` variant classes (e.g., `media-paused:`, `media-playing:`). [CITED: vidstack.io/docs/player/styling/tailwind + github.com/vidstack/player/discussions/1621]

For the default layout CSS, also import in globals.css or in the player component file:

```css
@import '@vidstack/react/player/styles/default/theme.css';
@import '@vidstack/react/player/styles/default/layouts/video.css';
```

### Component Imports (1.x API)

```tsx
// MUST be 'use client' — MediaPlayer uses browser APIs
'use client';
import { MediaPlayer, MediaProvider, useMediaState, useMediaRemote } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
```

### Basic Player Pattern

```tsx
'use client';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';

export function VideoPlayer({ src }: { src: string }) {
  return (
    <MediaPlayer src={src} playbackRate={1}>
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
```

[CITED: vidstack.io/docs/player + vidstack/examples GitHub]

### State Reading — useMediaState

```tsx
import { useMediaState, useMediaRemote } from '@vidstack/react';

// Inside a child component of MediaPlayer:
const currentTime = useMediaState('currentTime');  // number, seconds
const duration = useMediaState('duration');         // number, seconds
const paused = useMediaState('paused');             // boolean
```

These hooks **must be called inside a `<MediaPlayer>` subtree**. [CITED: vidstack.io/docs/player/core-concepts/state-management]

### Programmatic Seek — useMediaRemote

```tsx
const remote = useMediaRemote();
remote.seek(42.5);          // seek to 42.5 seconds
remote.changePlaybackRate(0.5);  // slow motion
```

`useMediaRemote` also must be called inside a `<MediaPlayer>` subtree. For the annotation panel (which is sibling to the player, not a child), lift seek control via a `ref` callback or wrap both player + panel in a shared parent. [CITED: vidstack.io/docs/player/core-concepts/state-management]

### Playback Rate (Discretionary Feature)

`DefaultVideoLayout` includes a playback rate menu out of the box. Setting `playbackRate` prop on `<MediaPlayer>` sets initial rate. No extra work needed for 0.5x / 0.25x — it's available in the built-in rate menu. [ASSUMED — DefaultVideoLayout menu coverage; verify menu options at runtime]

---

## Timeline Markers / Annotation Dots

### No Built-In Marker API

Vidstack 1.x has no built-in arbitrary marker API (GitHub issue #1660 — open, no ETA). `TimeSlider.Steps` renders step indicators only at uniform intervals, not at custom timestamps. `TimeSlider.Chapters` is chapter-track-based (VTT file). [VERIFIED: github.com/vidstack/player/issues/1660]

### Correct Approach: Absolute Overlay

Wrap the `TimeSlider.Root` in a `relative` container and absolutely-position dot `<div>`s:

```tsx
'use client';
import { TimeSlider } from '@vidstack/react';
import { useMediaState } from '@vidstack/react';

interface Annotation {
  id: string;
  timestamp_s: number;
  content: string;
}

function AnnotatedTimeSlider({ annotations }: { annotations: Annotation[] }) {
  const duration = useMediaState('duration') ?? 0;
  const remote = useMediaRemote();

  return (
    <div className="relative w-full">
      {/* Vidstack scrub bar */}
      <TimeSlider.Root className="group flex items-center w-full h-4 cursor-pointer">
        <TimeSlider.Track className="relative z-0 h-[3px] w-full bg-border">
          <TimeSlider.TrackFill className="absolute h-full bg-primary" />
          <TimeSlider.Progress className="absolute h-full bg-white/30" />
        </TimeSlider.Track>
        <TimeSlider.Thumb className="absolute h-4 w-4 rounded-full bg-primary opacity-0 group-hocus:opacity-100 transition-opacity" />
      </TimeSlider.Root>

      {/* Annotation dot overlay */}
      {duration > 0 && annotations.map((a) => (
        <button
          key={a.id}
          title={a.content}
          onClick={() => remote.seek(a.timestamp_s)}
          style={{ left: `${(a.timestamp_s / duration) * 100}%` }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3
                     rounded-full bg-primary border-2 border-white shadow z-10
                     hover:scale-125 transition-transform cursor-pointer"
        />
      ))}
    </div>
  );
}
```

**Key requirements:**
- `useMediaState('duration')` will return `0` until media metadata loads — gate dot rendering on `duration > 0`.
- Tooltip text via `title` attribute (basic) or a custom hover popover for richer UX.
- `TimeSlider` components must be inside `<MediaPlayer>` tree; the overlay `<button>`s can be siblings to `TimeSlider.Root` as long as they share the same `relative` wrapper inside `<MediaPlayer>`. [ASSUMED — component nesting approach; test that `useMediaState` is accessible in the wrapper]

---

## expo-video (Expo SDK 54)

### Current State

`expo-video` is NOT installed in the mobile app. `expo-av` (16.0.8) is installed. `expo-av` is deprecated in SDK 54 and removed in SDK 55. [VERIFIED: expo.dev/changelog/sdk-54]

### Install Command

```bash
# From apps/mobile/
npx expo install expo-video
```

Expected resolved version for SDK 54: `~2.0.6`. [ASSUMED — version pinned by `expo install` resolver; verify with `expo-doctor` post-install]

### Requires Dev Build

`expo-video` is a native module — it does NOT work in Expo Go. The project already requires Dev Build (EAS) per Phase 45 prerequisites. No additional change needed.

### Core API

```tsx
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';

export default function VideoPlayerScreen() {
  const player = useVideoPlayer(signedUrl, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25; // fire timeUpdate every 0.25s
  });

  // Track current time for annotation overlay
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: player.currentTime });

  function seekTo(seconds: number) {
    player.currentTime = seconds;  // direct assignment
  }

  return (
    <VideoView
      player={player}
      style={{ width: '100%', aspectRatio: 16/9 }}
      contentFit="contain"
      nativeControls={true}      // shows native play/pause/scrub
      allowsPictureInPicture={false}
    />
  );
}
```

[CITED: docs.expo.dev/versions/latest/sdk/video]

### Duration

```ts
player.duration  // read-only, in seconds; available after 'readyForDisplay' event
```

Listen for `useEvent(player, 'statusChange', ...)` to detect when duration is populated.

### Seeking

```ts
player.currentTime = 42.5;    // seek to timestamp
player.seekBy(5);              // relative seek
```

Both are direct property assignments / method calls. No async required.

### Playback Rate

```ts
player.playbackRate = 0.5;   // supported range: 0 to 16.0
```

---

## Hono Annotation Routes

### Extend Existing Coach Videos Service

Phase 45 created `backend/api/src/coach/videos/service.ts` (registered as `/coach/videos` in `app.ts`). Add annotation routes to the same file (or a new `annotations.ts` imported there). The `videosRouter` is already authenticated via `authMiddleware`.

### Recommended Route Structure

```
POST   /coach/videos/:videoId/annotations           — create annotation
PATCH  /coach/videos/:videoId/annotations/:annotId  — edit text
DELETE /coach/videos/:videoId/annotations/:annotId  — delete
GET    /coach/videos/:videoId/annotations           — list all for this video (coach + athlete reads)
GET    /coach/videos/:videoId/signed-url            — 15-min read URL (for mobile playback)
POST   /coach/videos/:videoId/send-feedback         — update status + push notification
GET    /coach/clients/:clientId/videos              — list videos for a client (coach reads)
```

### Auth Pattern for Each Route

- **Coach routes** (create, edit, delete, send-feedback, signed-url): verify `auth.userId === video.coach_id`. Use `is_coach_of()` RLS or explicit query guard.
- **Athlete routes** (GET annotations, GET signed-url for mobile): verify `auth.userId === video.athlete_id`. The GET `/coach/videos/:videoId/annotations` is used by both — check if caller is coach or athlete of the video.
- **Video list for web** (`GET /coach/clients/:clientId/videos`): coach auth + `is_coach_of(clientId)` check.

### Signed Read URL Pattern

```ts
// Different from Phase 45 (createSignedUploadUrl)
// This is createSignedUrl for reading:
const { data, error } = await supabaseAdmin.storage
  .from('coach-videos')
  .createSignedUrl(storagePath, 60 * 15); // 15 minutes in seconds

// Returns: { signedUrl: string }
```

`createSignedUrl` uses the service client (`supabaseAdmin`). The publishable key may lack storage.admin for private buckets — keep using the service key pattern from Phase 45 `db.ts`. [CITED: Supabase Storage docs via codebase pattern + storage.ts reference]

### send-feedback Endpoint Logic

```ts
videosRouter.post('/:videoId/send-feedback', async (c) => {
  const { userId: coachId } = c.get('auth');
  const { videoId } = c.req.param();

  // 1. Verify coach owns this video
  // 2. Check annotations exist (at least one)
  // 3. UPDATE coach_client_videos SET status='annotated' WHERE id=videoId AND coach_id=coachId
  // 4. Get athlete_id and video title from the row
  // 5. Send push via notificationService.send({ recipientUserId: athleteId, ... })
  // 6. Return { ok: true }
});
```

Idempotency: after status is `annotated`, a second call returns early (or re-uses the DB check). The button is disabled in UI after first send anyway.

---

## Next.js Integration Points

### ClientTabStrip — Add "Vidéos" Tab

Append to the `TABS` array in `apps/web/src/components/coach/ClientTabStrip.tsx`:

```ts
{ key: 'videos', label: 'Vidéos' }
```

**Active state issue:** Current detection is `pathname.endsWith('/${tab.key}')`. This correctly highlights "Vidéos" on `/…/videos` but NOT on `/…/videos/[videoId]`. Fix: change the detection for the videos tab specifically, or change to `pathname.includes('/videos')`. The cleanest approach:

```ts
const isActive = tab.key === 'videos'
  ? pathname.includes('/videos')
  : pathname.endsWith(`/${tab.key}`);
```

This matches both `/videos` (list) and `/videos/abc-123` (player) under the same tab highlight. [VERIFIED: codebase — ClientTabStrip.tsx line 29]

### Layout — Hide Notes Panel on /videos/* Sub-pages

`apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` is a **server component**. The notes panel div is:

```tsx
<div className="hidden lg:block w-72 shrink-0">…</div>
```

To conditionally hide on `/videos/*` pages, the layout needs to detect the path. Since it's a server component, use the `params` approach by checking if the current route segment indicates a video page. The cleanest options:

**Option A (Recommended):** Move notes panel hiding to a client wrapper component that uses `usePathname()`:

```tsx
// NewClientNotesPanelWrapper.tsx
'use client';
import { usePathname } from 'next/navigation';
import { ClientNotesPanel } from './ClientNotesPanel';

export function ClientNotesPanelConditional(props) {
  const pathname = usePathname();
  if (pathname.includes('/videos')) return null;
  return <ClientNotesPanel {...props} />;
}
```

**Option B:** Pass a `hidePanel` boolean from a nested layout at `videos/layout.tsx` using a slot or context. More complex, avoid.

**Option C:** Use Next.js parallel routes with `@panel` slot. Overkill for this case.

Use Option A — it's the minimal change and matches the existing codebase pattern (`usePathname()` is used throughout coach components). [VERIFIED: codebase — NavItem.tsx pattern, ClientTabStrip.tsx pattern]

### Page File Structure

```
apps/web/src/app/[locale]/(coach)/coach/clients/[id]/
  videos/
    page.tsx                    → VideoListPage (server component → renders VideoListClient)
    [videoId]/
      page.tsx                  → VideoPlayerPage (server component → renders VideoPlayerClient)
```

**Pattern from vocal/page.tsx:**
```tsx
// videos/page.tsx
import { VideoListClient } from '@/components/coach/videos/VideoListClient';

export default async function VideosPage({ params }) {
  const { id } = await params;
  return <VideoListClient clientId={id} />;
}

// videos/[videoId]/page.tsx
import { VideoPlayerClient } from '@/components/coach/videos/VideoPlayerClient';

export default async function VideoPlayerPage({ params }) {
  const { id, videoId } = await params;
  return <VideoPlayerClient clientId={id} videoId={videoId} />;
}
```

The `force-dynamic` + `revalidate = 0` from the coach `layout.tsx` applies automatically.

### VideoPlayerClient Layout (2/3 / 1/3 split, no notes panel)

```tsx
// Two-column: 2/3 player + 1/3 annotation panel (full width — notes panel hidden by wrapper)
<div className="flex gap-6 h-full">
  {/* Player: 2/3 */}
  <div className="flex-[2] min-w-0">
    <MediaPlayer src={signedUrl}>…</MediaPlayer>
  </div>
  {/* Annotation panel: 1/3 */}
  <div className="flex-1 min-w-0 max-w-sm">
    <AnnotationPanel videoId={videoId} />
  </div>
</div>
```

---

## Existing Code Patterns

### ClientTabStrip.tsx — Exact TABS Array to Modify

```ts
// Current (10 tabs, line 5-16):
const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sessions', label: 'Séances' },
  { key: 'measurements', label: 'Mesures' },
  { key: 'habits', label: 'Habitudes' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'sleep', label: 'Sommeil' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'journal', label: 'Journal' },
  { key: 'programs', label: 'Programmes' },
  { key: 'vocal', label: 'Retour vocal' },
  // ADD:
  { key: 'videos', label: 'Vidéos' },
];
```

Tab 11. The horizontal strip already has `overflow-x-auto scrollbar-none` — no layout change needed for an 11th tab.

### layout.tsx — Notes Panel Line

```tsx
// Line 71 — target for conditional hiding:
<div className="hidden lg:block w-72 shrink-0">
```

This is in a server component. Wrapping the inner `<ClientNotesPanel>` in a `'use client'` wrapper component that checks `usePathname` is the cleanest minimal change.

### VocalRetourPanel.tsx — State Machine Pattern

The annotation panel should follow the same `useReducer` state machine pattern as `VocalRetourPanel`. Key states for annotation panel:
- `list` — showing annotation list + 'Annoter à ce moment' button
- `composing` — showing timestamp + textarea + Save/Cancel
- `sending` — 'Envoyer le retour' spinner
- `sent` — 'Retour envoyé' disabled

The GSAP entrance animation (`gsap.from(ref, { y: 16, opacity: 0, duration: 0.2 })`) is established pattern for all coach panels — replicate in the annotation panel.

### VideoListScreen.tsx (Phase 45) — Mobile Extension Point

The existing `VideoListScreen.tsx` renders a `TouchableOpacity` for each video (line 180-220) with no `onPress` handler. Phase 46 adds:

```tsx
onPress={() => {
  if (video.status === 'annotated') {
    // Navigate to VideoPlayerScreen
    router.push(`/(plugins)/coach/video-player?videoId=${video.id}`);
  }
}}
```

Use Expo Router `useRouter()`. Add a new route file: `apps/mobile/app/(app)/(plugins)/coach/video-player.tsx`.

### Hono Service Pattern — auth + service key

From `backend/api/src/coach/videos/db.ts`:
- Service client: `createClient(URL, SUPABASE_SERVICE_KEY || SUPABASE_PUBLISHABLE_KEY)`
- Auth is already in middleware; `c.get('auth').userId` gives the caller's ID
- Notification: `notificationService.send(payload)` from `backend/api/src/services/notificationService.ts`

The `notificationService` uses `expo-server-sdk` (already installed, v6.1.0).

---

## Supabase Signed Read URL

### Endpoint: GET /coach/videos/:videoId/signed-url

This is a **read** signed URL (different from Phase 45's upload signed URL).

```ts
// Supabase Storage — createSignedUrl (read, not createSignedUploadUrl which is for upload)
const { data, error } = await supabaseAdmin.storage
  .from('coach-videos')
  .createSignedUrl(storagePath, 15 * 60); // 900 seconds = 15 minutes

// Returns: { signedUrl: string }
```

The `storagePath` is retrieved from `coach_client_videos.storage_path` using the `videoId`.

**Access control:** Both coach and linked athlete should be able to call this endpoint. Check caller is either `video.coach_id` or `video.athlete_id`. Use service client to bypass RLS for the lookup.

**Mobile flow:**
1. `VideoPlayerScreen` mounts → calls `GET /coach/videos/:videoId/signed-url` (athlete JWT)
2. Gets `signedUrl` → passes to `useVideoPlayer(signedUrl, ...)`
3. URL expires in 15 min — if the athlete watches longer, the video may 404 on seek after expiry. For v1.13, accept this limitation (resigning on seek is overkill).

**Web flow (coach):**
For the web player, the signed URL is fetched server-side in the `page.tsx` (server component can use the coach's JWT from the session), passed as a prop to the client component. This avoids an extra client-side fetch and is consistent with the SSR patterns in the codebase.

---

## Package Legitimacy Audit

> slopcheck was not available in this environment. All packages verified via npm registry for age and legitimacy.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @vidstack/react | npm | 3+ yrs (Jan 2023) | Widely used | github.com/vidstack/player | n/a | Approved — install `@next` tag |
| expo-video | npm | 2+ yrs (SDK 52+) | Official Expo package | github.com/expo/expo | n/a | Approved — `npx expo install expo-video` |

**No packages removed.** Both are official packages from established organizations.
**slopcheck unavailable** — packages confirmed via official docs and npm registry history (3+ years, official org sources).

---

## Validation Architecture

nyquist_validation is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing — `backend/api/src/coach/videos/service.test.ts` exists) |
| Config file | `vitest.config.ts` at backend/api |
| Quick run | `cd backend/api && npx vitest run src/coach/videos/` |
| Full suite | `cd backend/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAYER-01 | Video list endpoint returns correct fields | unit | `vitest run src/coach/videos/service.test.ts` | ✅ (extend) |
| PLAYER-02 | Signed read URL returned for valid videoId | unit | `vitest run src/coach/videos/service.test.ts` | ✅ (extend) |
| ANNOT-01 | POST annotation creates row with timestamp_s | unit | `vitest run src/coach/videos/service.test.ts` | ✅ (extend) |
| ANNOT-02 | PATCH/DELETE annotations — coach-only guard | unit | `vitest run src/coach/videos/service.test.ts` | ✅ (extend) |
| ANNOT-03 | GET annotations returns sorted list | unit | `vitest run src/coach/videos/service.test.ts` | ✅ (extend) |
| REVIEW-01 | Athlete can GET annotations for their video | unit | `vitest run src/coach/videos/service.test.ts` | ✅ (extend) |
| REVIEW-02 | send-feedback sets status=annotated + sends push | unit | `vitest run src/coach/videos/service.test.ts` | ✅ (extend) |

### Wave 0 Gaps

The existing `service.test.ts` covers Phase 45 upload routes. Phase 46 needs new test cases added to the same file (or a new `annotations.test.ts` in the same directory). No new test file infrastructure needed — Vitest is already configured.

- [ ] Test cases for `GET /coach/videos/:videoId/annotations`
- [ ] Test cases for `POST /coach/videos/:videoId/annotations`
- [ ] Test cases for `PATCH /coach/videos/:videoId/annotations/:annotId`
- [ ] Test cases for `DELETE /coach/videos/:videoId/annotations/:annotId`
- [ ] Test cases for `GET /coach/videos/:videoId/signed-url`
- [ ] Test cases for `POST /coach/videos/:videoId/send-feedback`

Web and mobile UI components are not unit-testable in this Vitest setup — those are verified via manual smoke test (inspect player loads video, dots appear at correct positions).

---

## Risks & Landmines

### Risk 1: Wrong @vidstack/react Tag Installed

**What goes wrong:** Running `npm install @vidstack/react` installs 0.6.15 (latest tag) which requires React 18. The web app uses React 19.2.6. This causes peer dependency errors at install time (or silent runtime failures with `--legacy-peer-deps`).

**How to avoid:** Explicitly install `@vidstack/react@next` (1.15.1). The `next` tag has React 19 support. Lock the version range in `package.json` to `"@vidstack/react": "^1.15.1"` to prevent accidental downgrade.

**Warning signs:** `npm install` warns about peer dep mismatch; player renders a blank area; browser console shows React version errors.

### Risk 2: useMediaRemote/useMediaState Outside MediaPlayer Tree

**What goes wrong:** The annotation panel is a sibling of the player in the 2/3 / 1/3 layout. If `useMediaRemote()` is called in the panel component and the panel is NOT inside the `<MediaPlayer>` JSX tree, it throws or returns a no-op.

**How to avoid:** Wrap BOTH the player and the annotation panel inside `<MediaPlayer>`:

```tsx
<MediaPlayer src={signedUrl}>
  <div className="flex gap-6">
    <MediaProvider />          {/* player video element */}
    <AnnotationPanel />        {/* can call useMediaRemote() here */}
  </div>
  <DefaultVideoLayout … />
</MediaPlayer>
```

Alternatively, lift `remote.seek` as a callback prop passed down to the panel. Either approach works — the first is simpler. [ASSUMED — nesting approach; test if DefaultVideoLayout accepts non-MediaProvider siblings]

### Risk 3: Annotation Dot Duration = 0 on Mount

**What goes wrong:** `useMediaState('duration')` returns `0` until the video metadata loads. If dots are rendered before duration is known, they all cluster at `left: 0%`.

**How to avoid:** Gate annotation dot rendering: `{duration > 0 && annotations.map(...)}`. Also show a loading placeholder or nothing until duration is nonzero.

### Risk 4: expo-video Requires Native Rebuild

**What goes wrong:** Adding `expo-video` requires a new native build (Dev Build / EAS). If the team is testing on Expo Go, the `VideoView` component will fail with a "native module not found" error.

**How to avoid:** Phase 46 mobile implementation requires an EAS Dev Build (same prerequisite as Phase 45). Document in plan — no workaround for Expo Go.

### Risk 5: ActiveTab False-Negative on /videos/[videoId]

**What goes wrong:** `ClientTabStrip` uses `pathname.endsWith('/videos')`. On the player sub-page `/coach/clients/abc/videos/xyz`, `pathname.endsWith('/videos')` is false, so the "Vidéos" tab appears inactive even though the user is clearly in the videos section.

**How to avoid:** Change the isActive detection for the videos tab to use `pathname.includes('/videos')` as described in the integration section.

### Risk 6: Notes Panel Not Hidden via Server Component

**What goes wrong:** `layout.tsx` is a server component — `usePathname()` cannot be called directly in it. Attempting to conditionally render the notes panel using path detection in a server component will throw.

**How to avoid:** Use the client wrapper approach (`ClientNotesPanelConditional`) that calls `usePathname()` and returns null on `/videos/*` paths.

### Risk 7: Signed URL Expiry During Long Viewing Session

**What goes wrong:** If the coach watches a 30-minute technique video, the 15-minute signed URL expires. On seek or reload, the player gets a 403/400 from Supabase Storage.

**How to avoid (Phase 46):** Accept the limitation for v1.13. Document it in the plan task. Mitigation for the future: refresh URL before expiry using a `useEffect` timer. For now, note in UI or leave as-is.

### Risk 8: Supabase RLS for Annotations — Dual Auth

**What goes wrong:** Annotations need to be readable by BOTH the coach (for the web panel) and the athlete (for mobile review). A simple `user_id = auth.uid()` policy would not work for the athlete.

**How to avoid:** The Hono service handles authorization explicitly — check caller is `coach_id` OR `athlete_id` of the video. The annotation RLS policy in Supabase should allow:
```sql
USING (
  auth.uid() = coach_id
  OR EXISTS (
    SELECT 1 FROM coach_client_videos v
    WHERE v.id = coach_video_annotations.video_id
      AND v.athlete_id = auth.uid()
  )
)
```
Or simplify by serving all annotation reads through Hono (service key bypasses RLS). Consistent with existing pattern in the codebase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DefaultVideoLayout` menu includes 0.5x / 0.25x playback rate options | @vidstack/react Integration | Coach cannot use slow-mo from default UI; need custom rate buttons |
| A2 | expo-video install resolves to `~2.0.6` for Expo SDK 54 | expo-video section | Wrong version installed; `expo-doctor` will catch this |
| A3 | `useMediaRemote()` works inside non-`MediaProvider` children of `MediaPlayer` | Timeline Markers section | Annotation panel click-to-seek won't work; need prop-lifting workaround |
| A4 | Vidstack `DefaultVideoLayout` accepts non-MediaProvider siblings inside `MediaPlayer` | Next.js Integration | Layout breaks; need custom layout or restructure |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | @vidstack/react install | ✓ | v22.22.2 | — |
| Expo Dev Build (EAS) | expo-video native module | per Phase 45 prereq | — | None — required |
| Supabase Service Key | createSignedUrl (read) | ✓ (set in Phase 45) | — | — |
| expo-server-sdk | Push notifications | ✓ | 6.1.0 | — |
| @vidstack/react | Web player | ✗ (not installed) | needs 1.15.1 | None — required |
| expo-video | Mobile player | ✗ (not installed) | needs ~2.0.6 | expo-av (deprecated, avoid) |

**Missing dependencies with no fallback:**
- `@vidstack/react@next` — must be installed before web player implementation
- `expo-video` — must be installed before mobile player implementation (expo-av deprecated)

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | YES | Coach-only write on annotations; athlete-only read on their own video; verify in every Hono handler |
| V5 Input Validation | YES | Annotation text length cap (e.g., 2000 chars); timestamp_s must be numeric and within video duration |
| V6 Cryptography | YES (storage) | Supabase signed URLs with 15-min TTL; never expose storage_path directly to clients |

**Known threat patterns:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized annotation on another coach's video | Elevation of Privilege | `WHERE video_id = ? AND coach_id = auth.userId` check on every write |
| Athlete POSTing annotations | Elevation of Privilege | Coach-only write endpoint; verify caller is coach via `video.coach_id === auth.userId` |
| IDOR on signed-url endpoint | Information Disclosure | Verify caller is `video.coach_id` or `video.athlete_id` before generating URL |
| Resend after `status=annotated` | Spoofing | Check current status before updating; idempotency guard in send-feedback endpoint |

---

## Sources

### Primary (HIGH confidence)
- `@vidstack/react` npm registry + GitHub (vidstack/player) — version, peer deps, migration guide, issue #1660
- `expo.dev/changelog/sdk-54` — expo-av deprecation, expo-video status
- `docs.expo.dev/versions/latest/sdk/video` — useVideoPlayer, VideoView, seeking, time tracking
- `vidstack.io/docs/player/core-concepts/state-management` — useMediaState, useMediaRemote
- `vidstack.io/docs/player/components/sliders/time-slider` — TimeSlider.Root, Steps, Chapters

### Secondary (MEDIUM confidence)
- `github.com/vidstack/player/discussions/1621` — Tailwind v4 @plugin directive for Vidstack
- `github.com/vidstack/player/discussions/949` — 0.6.x → 1.0 migration guide (import paths, CSS)
- `github.com/vidstack/player/issues/1533` — React 19 support (closed Feb 2025, merged into 1.12.13+)

### Tertiary (LOW confidence)
- Web search results for DefaultVideoLayout playback rate menu — not directly verified against docs

---

## Metadata

**Confidence breakdown:**
- @vidstack/react version + install: HIGH — verified via npm registry
- Timeline marker approach: HIGH — verified via official issue #1660 (no built-in API confirmed)
- expo-video API: HIGH — from official Expo docs
- Hono route structure: HIGH — follows existing Phase 45 patterns in codebase
- Layout/tab integration: HIGH — read actual source files
- DefaultVideoLayout rate menu: LOW — assumed from description, not verified in docs

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (30 days — @vidstack/react 1.x is actively maintained but API is stable)
