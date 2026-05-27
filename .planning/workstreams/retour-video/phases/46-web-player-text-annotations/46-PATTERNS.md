# Phase 46: Web Player & Text Annotations — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 14
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/components/coach/ClientTabStrip.tsx` | component (modify) | request-response | self (existing file) | exact |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` | layout (modify) | request-response | self (existing file) | exact |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx` | route | request-response | `…/clients/[id]/vocal/page.tsx` | exact |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/[videoId]/page.tsx` | route | request-response | `…/clients/[id]/programs/page.tsx` | exact |
| `apps/web/src/components/coach/videos/VideoListClient.tsx` | component | CRUD | `…/programs/ClientProgramsContent.tsx` | role-match |
| `apps/web/src/components/coach/videos/VideoPlayerClient.tsx` | component | CRUD | `…/programs/ClientProgramsContent.tsx` | role-match |
| `apps/web/src/components/coach/videos/VideoPlayer.tsx` | component | streaming | `VocalRetourPanel.tsx` (useRef + useEffect) | partial |
| `apps/web/src/components/coach/videos/AnnotatedTimeSlider.tsx` | component | event-driven | `VocalRetourPanel.tsx` (useReducer + ref) | partial |
| `apps/web/src/components/coach/videos/AnnotationPanel.tsx` | component | event-driven | `VocalRetourPanel.tsx` (useReducer state machine) | exact |
| `apps/web/src/components/coach/videos/ClientNotesPanelConditional.tsx` | component | request-response | `NavItem.tsx` (usePathname) | role-match |
| `backend/api/src/coach/videos/service.ts` | service (modify) | CRUD | self (existing Phase 45 routes) | exact |
| `backend/api/src/coach/videos/db.ts` | service (modify) | CRUD | self (existing Phase 45 queries) | exact |
| `apps/mobile/app/(app)/(plugins)/coach/video-player.tsx` | route | request-response | `…/coach/videos.tsx` route wrapper | exact |
| Plugin `VideoPlayerScreen` (Mon coach plugin) | component | streaming | `VideoListScreen.tsx` (Phase 45) | role-match |

---

## Pattern Assignments

### `apps/web/src/components/coach/ClientTabStrip.tsx` (modify — add Vidéos tab)

**Analog:** self (lines 1-50, `C:/ziko-platform/apps/web/src/components/coach/ClientTabStrip.tsx`)

**TABS array to modify** (lines 5-16):
```typescript
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

**Active state detection to patch** (line 29 — `pathname.endsWith` is a false-negative for sub-pages):
```typescript
// Replace:
const isActive = pathname.endsWith(`/${tab.key}`);

// With:
const isActive = tab.key === 'videos'
  ? pathname.includes('/videos')
  : pathname.endsWith(`/${tab.key}`);
```

The strip already has `overflow-x-auto scrollbar-none` — no layout change needed.

---

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` (modify — hide notes panel on /videos/*)

**Analog:** self (lines 1-84, `C:/ziko-platform/apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx`)

**Import change** (line 7 — replace static ClientNotesPanel import with conditional wrapper):
```typescript
// Replace:
import { ClientNotesPanel } from '@/components/coach/ClientNotesPanel';

// With:
import { ClientNotesPanelConditional } from '@/components/coach/videos/ClientNotesPanelConditional';
```

**Notes panel div to modify** (lines 71-79):
```tsx
// Replace:
<div className="hidden lg:block w-72 shrink-0">
  <div className="sticky top-8">
    <ClientNotesPanel
      clientId={id}
      initialNote={noteData?.content ?? ''}
      initialTags={...}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}
    />
  </div>
</div>

// With:
<div className="hidden lg:block w-72 shrink-0">
  <div className="sticky top-8">
    <ClientNotesPanelConditional
      clientId={id}
      initialNote={noteData?.content ?? ''}
      initialTags={(tagsData ?? []).map((t: { id: string; tag: string }) => ({ id: t.id, tag: t.tag }))}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}
    />
  </div>
</div>
```

---

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx` (new — server route)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/vocal/page.tsx` (all 10 lines)

**Full page pattern** (lines 1-10 of vocal/page.tsx):
```typescript
import { VideoListClient } from '@/components/coach/videos/VideoListClient';

export default async function VideosPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  return <VideoListClient clientId={id} />;
}
```

Note: `force-dynamic` + `revalidate = 0` from the parent `layout.tsx` applies automatically — no need to repeat here.

---

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/[videoId]/page.tsx` (new — server route with SSR fetch)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` (lines 36-94)

**SSR fetch + pass to client component pattern** (programs/page.tsx lines 36-94):
```typescript
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { VideoPlayerClient } from '@/components/coach/videos/VideoPlayerClient';

export default async function VideoPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; videoId: string }>;
}) {
  const { id: clientId, videoId } = await params;
  const [locale] = await Promise.all([getLocale(), getCachedCoachUser()]);
  const supabase = await createServerSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  // Fetch signed URL and annotations server-side
  let signedUrl = '';
  let annotations: Annotation[] = [];
  let video: VideoRecord | null = null;

  if (jwt) {
    try {
      const [signedRes, annotRes, videoRes] = await Promise.all([
        fetch(`${apiUrl}/coach/videos/${videoId}/signed-url`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/coach/videos/${videoId}/annotations`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/coach/videos/${videoId}`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
      ]);
      if (signedRes.ok) signedUrl = (await signedRes.json()).signedUrl;
      if (annotRes.ok) annotations = await annotRes.json();
      if (videoRes.ok) video = await videoRes.json();
    } catch (err) {
      console.error('[videos/[videoId]/page] fetch error:', err);
    }
  }

  return (
    <VideoPlayerClient
      clientId={clientId}
      videoId={videoId}
      signedUrl={signedUrl}
      annotations={annotations}
      video={video}
      accessToken={jwt}
      apiUrl={apiUrl}
    />
  );
}
```

---

### `apps/web/src/components/coach/videos/VideoListClient.tsx` (new — client component)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx` (lines 1-50, 177-313)

**Client component skeleton pattern** (programs/ClientProgramsContent.tsx lines 1-2, 34-41):
```typescript
'use client';
import { useState } from 'react';

// Props passed from server page.tsx:
interface VideoListClientProps {
  clientId: string;
  accessToken: string;
  apiUrl: string;
  locale: string;
}
```

**Fetch with Authorization header pattern** (programs/ClientProgramsContent.tsx lines 70-83):
```typescript
const handleSave = async () => {
  setSaving(true);
  try {
    await fetch(`${apiUrl}/coach/clients/${clientId}/shared-note`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ shared_note: note }),
    });
```

**Card list rendering pattern** (programs/ClientProgramsContent.tsx lines 222-274):
```tsx
<div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
  <div className="flex items-center justify-between mb-4">
    <span className="text-xs font-bold text-muted uppercase tracking-wide">
      Vidéos
    </span>
  </div>
  {/* map over video rows */}
</div>
```

**Empty state pattern** (programs/ClientProgramsContent.tsx lines 188-213):
```tsx
<div className="flex flex-col items-center text-center py-16 bg-white border border-border rounded-2xl shadow-sm">
  <svg ... className="text-muted mb-4" />
  <h2 className="text-base font-bold text-text">Aucune vidéo</h2>
  <p className="text-sm text-muted mt-2 max-w-sm">…</p>
</div>
```

---

### `apps/web/src/components/coach/videos/VideoPlayerClient.tsx` (new — client component, 2/3+1/3 layout)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx` (structure) + RESEARCH.md layout spec

**Two-column layout pattern** (from RESEARCH.md — no existing 2/3+1/3 split in codebase yet):
```tsx
'use client';
// Two-column: 2/3 player + 1/3 annotation panel (notes panel hidden by ClientNotesPanelConditional)
// CRITICAL: Both VideoPlayer and AnnotationPanel must be children of <MediaPlayer>
// so that useMediaRemote() works inside AnnotationPanel (see Risk 2 in RESEARCH.md)
<div className="flex gap-6 h-full">
  {/* Player column: 2/3 */}
  <div className="flex-[2] min-w-0">
    {/* MediaPlayer wraps both columns — AnnotationPanel goes inside */}
  </div>
  {/* Annotation panel: 1/3 */}
  <div className="flex-1 min-w-0 max-w-sm">
    <AnnotationPanel videoId={videoId} accessToken={accessToken} apiUrl={apiUrl} />
  </div>
</div>
```

**Client component 'use client' + useState pattern** (ClientProgramsContent.tsx lines 1-2):
```typescript
'use client';
import { useState } from 'react';
```

---

### `apps/web/src/components/coach/videos/VideoPlayer.tsx` (new — Vidstack wrapper)

**Analog:** `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` (lines 1-3, 16, 58-63 for ref + GSAP entrance)

**useRef + GSAP entrance pattern** (VocalRetourPanel.tsx lines 16, 58-63):
```typescript
const panelRef = useRef<HTMLDivElement>(null);

// Page entrance animation
useEffect(() => {
  if (panelRef.current) {
    gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
  }
}, []);
```

**Vidstack import pattern** (from RESEARCH.md — new package, no codebase analog):
```typescript
'use client';
import { MediaPlayer, MediaProvider, useMediaState, useMediaRemote } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
// CSS must be imported in globals.css (see Shared Patterns below)
```

**Basic player JSX** (from RESEARCH.md):
```tsx
<MediaPlayer src={src} playbackRate={1}>
  <MediaProvider />
  <DefaultVideoLayout icons={defaultLayoutIcons} />
</MediaPlayer>
```

---

### `apps/web/src/components/coach/videos/AnnotatedTimeSlider.tsx` (new — overlay dots on TimeSlider)

**Analog:** `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` (lines 1-3, useRef pattern) — plus RESEARCH.md overlay approach (no codebase analog exists for Vidstack markers)

**useMediaState hook usage** (from RESEARCH.md — must be inside MediaPlayer subtree):
```typescript
'use client';
import { TimeSlider, useMediaState, useMediaRemote } from '@vidstack/react';

// Inside component (must be a child of <MediaPlayer>):
const duration = useMediaState('duration') ?? 0;
const remote = useMediaRemote();
```

**Absolute overlay pattern** (from RESEARCH.md):
```tsx
<div className="relative w-full">
  <TimeSlider.Root className="group flex items-center w-full h-4 cursor-pointer">
    <TimeSlider.Track className="relative z-0 h-[3px] w-full bg-border">
      <TimeSlider.TrackFill className="absolute h-full bg-primary" />
      <TimeSlider.Progress className="absolute h-full bg-white/30" />
    </TimeSlider.Track>
    <TimeSlider.Thumb className="absolute h-4 w-4 rounded-full bg-primary opacity-0
                                  group-hocus:opacity-100 transition-opacity" />
  </TimeSlider.Root>

  {/* Gate on duration > 0 (Risk 3 from RESEARCH.md) */}
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
```

---

### `apps/web/src/components/coach/videos/AnnotationPanel.tsx` (new — useReducer state machine)

**Analog:** `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` (lines 1-180) and `apps/web/src/components/coach/vocal/vocalReducer.ts` (lines 1-134)

**useReducer state machine scaffold** (vocalReducer.ts lines 16-27 for state union type):
```typescript
// annotationReducer.ts — copy this exact pattern from vocalReducer.ts
export type AnnotationState =
  | { status: 'list'; annotations: Annotation[] }
  | { status: 'composing'; annotations: Annotation[]; timestampS: number }
  | { status: 'saving'; annotations: Annotation[]; timestampS: number; text: string }
  | { status: 'sending' }
  | { status: 'sent' };

export type AnnotationAction =
  | { type: 'START_COMPOSE'; timestampS: number }
  | { type: 'CANCEL_COMPOSE' }
  | { type: 'SET_TEXT'; text: string }
  | { type: 'SAVE_ANNOTATION'; annotation: Annotation }
  | { type: 'DELETE_ANNOTATION'; annotationId: string }
  | { type: 'START_SEND' }
  | { type: 'SEND_COMPLETE' };
```

**useReducer hook usage** (VocalRetourPanel.tsx line 18):
```typescript
const [state, dispatch] = useReducer(annotationReducer, { status: 'list', annotations: initialAnnotations });
```

**Panel ref + GSAP entrance** (VocalRetourPanel.tsx lines 16, 58-63):
```typescript
const panelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (panelRef.current) {
    gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
  }
}, []);
```

**Conditional view rendering by state** (VocalRetourPanel.tsx lines 149-178):
```tsx
<div ref={panelRef} className="annotation-panel">
  {state.status === 'list' && (
    <AnnotationList annotations={state.annotations} onSeek={onSeek} onCompose={...} />
  )}
  {state.status === 'composing' && (
    <AnnotationComposer timestamp={state.timestampS} onSave={...} onCancel={...} />
  )}
  {(state.status === 'sending' || state.status === 'sent') && (
    <AnnotationSendFooter status={state.status} />
  )}
</div>
```

**Async fetch with try/catch** (VocalRetourPanel.tsx lines 102-128):
```typescript
try {
  const res = await fetch('/api/coach/voice/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed' }));
    dispatch({ type: 'ERROR', message: (data as { error?: string }).error ?? 'Failed' });
    return;
  }
  const data = await res.json();
  dispatch({ type: 'SUCCESS', ... });
} catch {
  dispatch({ type: 'ERROR', message: 'Failed' });
}
```

---

### `apps/web/src/components/coach/videos/ClientNotesPanelConditional.tsx` (new — usePathname wrapper)

**Analog:** `apps/web/src/components/coach/NavItem.tsx` (lines 1-17)

**usePathname + conditional render pattern** (NavItem.tsx lines 1-3, 14-16):
```typescript
'use client';
import { usePathname } from 'next/navigation';
// ...

export function ClientNotesPanelConditional(props: ClientNotesPanelProps) {
  const pathname = usePathname();
  if (pathname.includes('/videos')) return null;
  return <ClientNotesPanel {...props} />;
}
```

**Required imports** (NavItem.tsx lines 1-4):
```typescript
'use client';
import { usePathname } from 'next/navigation';
import { ClientNotesPanel } from '@/components/coach/ClientNotesPanel';
```

---

### `backend/api/src/coach/videos/service.ts` (modify — add annotation + signed-url + send-feedback routes)

**Analog:** self (lines 1-129, `C:/ziko-platform/backend/api/src/coach/videos/service.ts`)

**Router registration + auth middleware pattern** (service.ts lines 1-18):
```typescript
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../../middleware/auth.js';
import { notificationService } from '../../services/notificationService.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const videosRouter = new Hono();
videosRouter.use('*', authMiddleware);
```

**Route handler pattern with auth + guard** (service.ts lines 77-129):
```typescript
videosRouter.post('/:videoId/complete', async (c) => {
  const { userId: athleteId } = c.get('auth');  // auth from middleware
  const { videoId } = c.req.param();

  let body: CompleteVideoBody;
  try {
    body = await c.req.json<CompleteVideoBody>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Guard: verify caller owns resource
  if (!body.title || typeof body.title !== 'string') {
    return c.json({ error: 'title is required' }, 400);
  }

  // ... business logic ...
  return c.json({ ok: true });
});
```

**Push notification pattern** (service.ts lines 115-128):
```typescript
await notificationService.send({
  recipientUserId: coachId,
  category: 'coach',
  type: 'video_uploaded',
  title: '📹 Nouvelle vidéo',
  body: `${coachName || 'Un athlète'} a uploadé une nouvelle vidéo : ${title}`,
  data: {
    url: `/coach/clients/${athleteId}/videos`,
    videoId,
  },
  idempotencyKey: `video_uploaded_${videoId}`,
});
```

**For the send-feedback endpoint**, use same pattern with:
- `recipientUserId: athleteId`
- `type: 'video_annotated'`
- `body: \`📹 [coachName] a analysé votre vidéo : [video.title]\``
- `idempotencyKey: \`video_annotated_${videoId}\``

**Signed read URL pattern** (different from Phase 45 `createSignedUploadUrl`):
```typescript
// READ signed URL (not upload):
const { data, error } = await supabaseAdmin.storage
  .from('coach-videos')
  .createSignedUrl(storagePath, 15 * 60); // 900 seconds
// Returns: { signedUrl: string }
```

---

### `backend/api/src/coach/videos/db.ts` (modify — add annotation DB queries)

**Analog:** self (lines 1-88, `C:/ziko-platform/backend/api/src/coach/videos/db.ts`)

**Service client factory pattern** (db.ts lines 5-10):
```typescript
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

**Insert pattern** (db.ts lines 72-87):
```typescript
export async function insertAnnotation(params: {
  id: string;
  videoId: string;
  coachId: string;
  timestampS: number;
  content: string;
}): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from('coach_video_annotations').insert({
    id: params.id,
    video_id: params.videoId,
    coach_id: params.coachId,
    timestamp_s: params.timestampS,
    type: 'text',
    content: params.content,
  });
  if (error) {
    throw new Error(`[coach/videos] insertAnnotation error: ${error.message}`);
  }
}
```

**Query + order pattern** (db.ts lines 19-58):
```typescript
export async function getAnnotationsForVideo(videoId: string): Promise<AnnotationRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('coach_video_annotations')
    .select('id, timestamp_s, content, coach_id, created_at')
    .eq('video_id', videoId)
    .order('timestamp_s', { ascending: true });

  if (error) {
    console.warn('[coach/videos] getAnnotationsForVideo error:', error.message);
    return [];
  }
  return (data ?? []) as AnnotationRow[];
}
```

**Update/delete pattern** (modeled after existing insert structure):
```typescript
export async function updateAnnotation(annotId: string, coachId: string, content: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from('coach_video_annotations')
    .update({ content })
    .eq('id', annotId)
    .eq('coach_id', coachId); // ownership guard
  if (error) throw new Error(`[coach/videos] updateAnnotation error: ${error.message}`);
}

export async function deleteAnnotation(annotId: string, coachId: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from('coach_video_annotations')
    .delete()
    .eq('id', annotId)
    .eq('coach_id', coachId); // ownership guard
  if (error) throw new Error(`[coach/videos] deleteAnnotation error: ${error.message}`);
}
```

---

### `apps/mobile/app/(app)/(plugins)/coach/video-player.tsx` (new — route wrapper)

**Analog:** `apps/mobile/app/(app)/(plugins)/coach/videos.tsx` (all 7 lines)

**Route wrapper pattern** (videos.tsx lines 1-7):
```typescript
import React from 'react';
import VideoListScreen from '@ziko/plugin-coach/screens/VideoListScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachVideosRoute() {
  return <VideoListScreen supabase={supabase} />;
}
```

**For the video-player route** — same pattern:
```typescript
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import VideoPlayerScreen from '@ziko/plugin-coach/screens/VideoPlayerScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachVideoPlayerRoute() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  return <VideoPlayerScreen supabase={supabase} videoId={videoId ?? ''} />;
}
```

Note: `useLocalSearchParams` from `expo-router` picks up `?videoId=xxx` from the navigation call:
```typescript
// In VideoListScreen.tsx (Phase 45 modification):
router.push(`/(plugins)/coach/video-player?videoId=${video.id}`);
```

---

### Plugin `VideoPlayerScreen` (Mon coach plugin, new screen)

**Analog:** `plugins/coach/src/screens/VideoListScreen.tsx` (lines 1-256)

**Imports pattern** (VideoListScreen.tsx lines 1-16):
```typescript
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../../apps/mobile/src/stores/authStore';
```

**Additional imports for VideoPlayerScreen**:
```typescript
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useRouter } from 'expo-router';
```

**Screen scaffold pattern** (VideoListScreen.tsx lines 79-113):
```typescript
export default function VideoPlayerScreen({ supabase, videoId }: { supabase: any; videoId: string }) {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  // Fetch signed URL on mount (D-11 from CONTEXT.md — 15 min expiry)
  const { data: signedUrl, isLoading: urlLoading } = useQuery<string>({
    queryKey: ['coach-video-signed-url', videoId],
    queryFn: async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
      const session = await supabase.auth.getSession();
      const jwt = session.data.session?.access_token ?? '';
      const res = await fetch(`${apiUrl}/coach/videos/${videoId}/signed-url`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('Failed to get signed URL');
      return (await res.json()).signedUrl;
    },
    enabled: !!videoId,
    staleTime: 10 * 60 * 1000, // 10 min (URL expires in 15, refresh before)
  });
```

**SafeAreaView + paddingBottom: 100 pattern** (VideoListScreen.tsx lines 112-134):
```tsx
return (
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
      {/* content */}
    </ScrollView>
  </SafeAreaView>
);
```

**expo-video player pattern** (from RESEARCH.md):
```typescript
const player = useVideoPlayer(signedUrl ?? '', (p) => {
  p.loop = false;
  p.timeUpdateEventInterval = 0.25;
});

const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: player.currentTime });

// Annotation timeline overlay uses:
// (timestamp_s / player.duration) * 100  → percentage position
// player.currentTime = timestamp_s         → seek on tap

return (
  <VideoView
    player={player}
    style={{ width: '100%', aspectRatio: 16/9 }}
    contentFit="contain"
    nativeControls={true}
    allowsPictureInPicture={false}
  />
);
```

**Theme access pattern** (VideoListScreen.tsx line 80):
```typescript
const theme = useThemeStore((s) => s.theme);
// Use: theme.primary (#FF5C1A), theme.text, theme.muted, theme.surface, theme.border, theme.background
```

**showAlert instead of Alert.alert** (VideoListScreen.tsx line 14):
```typescript
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
// Never use: import { Alert } from 'react-native';
```

---

## Shared Patterns

### Authentication — Hono API Calls (web client components)
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx` (lines 70-83)
**Apply to:** `VideoListClient.tsx`, `VideoPlayerClient.tsx`, `AnnotationPanel.tsx`
```typescript
await fetch(`${apiUrl}/coach/videos/${videoId}/annotations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ timestamp_s, content }),
});
```

### Authentication — SSR Fetch from page.tsx
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` (lines 46-65)
**Apply to:** `videos/page.tsx`, `videos/[videoId]/page.tsx`
```typescript
const {
  data: { session },
} = await supabase.auth.getSession();
const jwt = session?.access_token ?? '';

const res = await fetch(`${apiUrl}/coach/...`, {
  headers: { Authorization: `Bearer ${jwt}` },
  cache: 'no-store',
});
```

### GSAP Entrance Animation
**Source:** `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` (lines 16, 58-63)
**Apply to:** `AnnotationPanel.tsx`, `VideoPlayerClient.tsx`
```typescript
const panelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (panelRef.current) {
    gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
  }
}, []);
```

### Hono Route Handler Error Pattern
**Source:** `backend/api/src/coach/videos/service.ts` (lines 52-65, 77-99)
**Apply to:** all new annotation routes in `service.ts`
```typescript
if (error || !data) {
  console.error('[coach/videos] operationName error:', error);
  return c.json({ error: 'Failed to ...' }, 500);
}
```

### Supabase Service Client
**Source:** `backend/api/src/coach/videos/db.ts` (lines 5-10)
**Apply to:** all new functions in `db.ts`
```typescript
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

### Tailwind Design Tokens (web)
**Source:** `apps/web/src/app/globals.css` (lines 3-20)
**Apply to:** all new web components
```
bg-primary / text-primary    → #FF5C1A (orange dots, active states, buttons)
bg-background                → #F7F6F3 (page background)
border-border                → #E2E0DA (card borders, dividers)
text-text                    → #1C1A17 (primary text)
text-muted                   → #6B6963 (secondary text, timestamps)
bg-white border border-border rounded-2xl p-6 shadow-sm → standard card
```

### Vidstack CSS Global Import
**Source:** RESEARCH.md (no codebase analog — new pattern)
**Apply to:** `apps/web/src/app/globals.css` (add after line 1)
```css
@plugin '@vidstack/react/tailwind.cjs';
@import '@vidstack/react/player/styles/default/theme.css';
@import '@vidstack/react/player/styles/default/layouts/video.css';
```

### Mobile Screen paddingBottom + theme
**Source:** `plugins/coach/src/screens/VideoListScreen.tsx` (lines 130-134)
**Apply to:** `VideoPlayerScreen.tsx`
```typescript
contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
// All plugin screens MUST have paddingBottom: 100 for tab bar clearance
```

---

## No Analog Found

No files fall into this category — all 14 files have usable analogs. The Vidstack and expo-video integration sections rely on patterns from RESEARCH.md (not codebase analogs) due to being new package installations.

---

## Metadata

**Analog search scope:** `apps/web/src/components/coach/`, `apps/web/src/app/[locale]/(coach)/`, `backend/api/src/coach/videos/`, `plugins/coach/src/screens/`, `apps/mobile/app/(app)/(plugins)/coach/`
**Files scanned:** 13 source files read directly
**Pattern extraction date:** 2026-05-27
