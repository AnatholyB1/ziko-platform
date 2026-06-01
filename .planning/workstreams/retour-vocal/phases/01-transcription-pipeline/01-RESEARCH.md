# Phase 01: Transcription Pipeline — Research

**Researched:** 2026-05-26
**Domain:** Browser MediaRecorder API, OpenAI Whisper-1, Hono v4 multipart, React state machines
**Confidence:** HIGH

---

## Summary

This phase introduces the first voice recording surface in the Ziko Coach web app. The core flow
is: browser mic → MediaRecorder → webm blob → POST multipart to Hono backend → Whisper-1
transcription → transcript displayed for validation.

Three technical areas require careful handling. First, the existing Next.js coach proxy route
(`/api/coach/[...path]/route.ts`) uses `req.text()` for all POST bodies — this **corrupts binary
multipart data** and must be patched before the vocal route will work. Second, the `openai`
package is not yet installed in `backend/api/` — it is a new dependency. Third, Safari
pre-18.4 does not produce `audio/webm` — it produces `audio/mp4` — so the frontend must use
`MediaRecorder.isTypeSupported()` to negotiate the actual MIME type, and the Hono route must
accept both. Whisper-1 natively accepts both `webm` and `mp4`, so no server-side conversion is
required.

The Vercel 4.5 MB request body limit is a hard constraint: a 5-minute webm/opus recording at
64 kbps is approximately 2.4 MB, comfortably within limits. A worst-case mp4/aac recording at
128 kbps reaches ~4.8 MB — dangerously close. The body limit middleware in Hono should be set
to 20 MB (cap by Whisper, not Vercel) but the Vercel constraint means any upload from Safari
over ~4 min may be rejected at the infrastructure level before reaching Hono.

**Primary recommendation:** Patch the proxy to pass multipart as `arrayBuffer`, use
`MediaRecorder.isTypeSupported()` on the client to negotiate format, set `bodyLimit` on the Hono
route to 20 MB (soft; Vercel enforces 4.5 MB hard), and install `openai@6.x` in `backend/api/`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New tab "Retour vocal" in `ClientTabStrip.tsx` (9th tab). Page: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/vocal/page.tsx`
- **D-02:** Initial state = mic button centered, no history section (Phase 03 will add that)
- **D-03:** 4 inline states on same page, no modal: `idle` → `recording` → `transcribing` → `review`
- **D-04:** `beforeunload` warning during `recording` state. Upload interruption returns to `idle` (no recovery)
- **D-05:** Whisper failure → inline error + [Ressayer] (blob stays in memory) + [Relancer] (re-record)
- **D-06:** `language: 'fr'` forced in Whisper-1 call. No auto-detect.
- **D-07:** New Hono route `POST /coach/voice/transcribe`. Module `backend/api/src/coach/voice/service.ts` mounted via `app.route('/coach/voice', voiceRouter)` in `app.ts`
- **D-08:** Payload: `multipart/form-data` with audio blob (webm/opus from MediaRecorder) — Whisper-1 accepts webm natively, no server conversion needed

### Claude's Discretion

- Format of transcript block in `review` state (padding, muted background, scroll if long)
- Timer format `mm:ss`, red color above 4 min
- Exact filename sent to Whisper (e.g., `recording.webm`)
- State after "Relancer" — return to `recording` or `idle` directly

### Deferred Ideas (OUT OF SCOPE)

- Sharing feedback with athlete (email / push) — post-v1.9
- PDF export — post-v1.9
- Streaming Whisper (real-time) — explicitly excluded from REQUIREMENTS
- Multi-language auto-detect (FR/EN) — excluded, FR forced
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOICE-01 | Coach can start/stop audio recording (browser mic, max 5 min) from client sheet web CRM | MediaRecorder API + useVocalRecorder hook + auto-stop at 300s |
| VOICE-02 | Audio uploaded and transcribed via OpenAI Whisper API (whisper-1, FR) | `openai` package `toFile` + `audio.transcriptions.create` + Hono multipart route |
| VOICE-03 | Transcript displayed read-only before structuring — coach can validate or re-record | `VocalReview` component + `review` / `error` state branches |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mic recording + blob capture | Browser (client component) | — | MediaRecorder is a browser API; no server involvement during recording |
| State machine (idle/recording/transcribing/review/error) | Browser (client component) | — | All state is ephemeral, no persistence in Phase 01 |
| Timer display + auto-stop | Browser (client component) | — | `setInterval` in `useVocalTimer` hook, client-side only |
| `beforeunload` guard | Browser (client component) | — | `window.addEventListener('beforeunload')` — browser event |
| Audio upload + transcription | API (Hono backend) | — | Whisper API key must not be exposed to browser; backend owns the OpenAI call |
| JWT auth on upload route | API middleware | — | `authMiddleware` is consistent with all other coach routes |
| Multipart proxy passthrough | Frontend Server (Next.js API route) | — | Existing `/api/coach/[...path]/route.ts` proxy needs patch for binary passthrough |
| Tab registration | Browser (ClientTabStrip.tsx) | — | Static `TABS` array extension |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | `6.39.0` | Whisper-1 transcription via `audio.transcriptions.create` | Official OpenAI SDK; `toFile` helper handles Buffer→multipart without disk I/O |
| `hono/body-limit` | (bundled with hono 4.x) | Limit audio upload size before parsing | Built-in Hono middleware, zero deps |
| MediaRecorder (native) | Web API | Capture microphone audio as webm/mp4 blob | No package needed — browser-native |
| `useReducer` (React) | bundled with React 19 | State machine for 5 states | Discriminated union type safety; cleaner than `useState` chains |
| `gsap` | `3.15.0` (already installed) | State crossfades, pulse ring, shake animation | Already in `apps/web/package.json`; required by UI-SPEC |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | already installed | `mic`, `square`, `alert-triangle` icons | Required by UI-SPEC; already project standard |
| `hono/body-limit` | (hono 4.7.0) | Guard against oversized audio before parsing | Always on the transcribe route |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `openai` SDK `toFile` | Raw `FormData` + `fetch` | SDK handles multipart encoding correctly; raw approach risks incorrect boundary handling |
| `useReducer` | Multiple `useState` | Reducer enforces valid state transitions; prevents impossible states like recording+transcribing simultaneously |
| Hono `parseBody` (File) | `c.req.raw.formData()` | `parseBody` is the Hono-idiomatic approach; both work |

**Installation (backend/api only):**

```bash
cd backend/api && npm install openai
```

**Version verification:** `npm view openai version` → `6.39.0` [VERIFIED: npm registry]

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `openai` | npm | ~4 yrs | ~3M/wk | github.com/openai/openai-node | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (VocalRetourPanel)
│
├── [idle] User clicks "Nouveau retour"
│      │
│      ▼
├── [recording] navigator.mediaDevices.getUserMedia()
│      │         MediaRecorder(stream, { mimeType })
│      │         ondataavailable → push chunks
│      │         onstop → new Blob(chunks, { type: mimeType })
│      │
│      │  Auto-stop at 300s OR user clicks Stop
│      ▼
├── [transcribing] FormData with audio blob
│      │            POST /api/coach/voice/transcribe
│      │                 │
│      │           Next.js proxy route (patched for binary)
│      │                 │ arrayBuffer passthrough + inject JWT
│      │                 ▼
│      │           Hono route POST /coach/voice/transcribe
│      │                 │ authMiddleware → bodyLimit(20MB) → parseBody
│      │                 │ file instanceof File → buffer → toFile
│      │                 │ openai.audio.transcriptions.create({ model: 'whisper-1', language: 'fr', file })
│      │                 │ → { text: "..." }
│      │                 ▼
│      │           return { transcript: text }
│      │
│      ▼
├── [review] transcript displayed read-only
│      │     [Valider] → parent callback (Phase 02 consumes)
│      │     [Relancer] → back to idle (D-discretion)
│      │
└── [error] Whisper failed
           [Ressayer] → reuse same blob → back to transcribing
           [Relancer] → back to idle
```

### Recommended Project Structure

```
apps/web/src/app/[locale]/(coach)/coach/clients/[id]/vocal/
  page.tsx                    ← thin server wrapper (params → clientId, no data fetch)

apps/web/src/components/coach/vocal/
  VocalRetourPanel.tsx        ← 'use client' state machine root (useReducer)
  VocalIdle.tsx               ← idle state view
  VocalRecording.tsx          ← recording state view + timer
  VocalTranscribing.tsx       ← spinner state
  VocalReview.tsx             ← review + error sub-states
  useVocalRecorder.ts         ← MediaRecorder hook: getUserMedia, blob collection, mimeType negotiation
  useVocalTimer.ts            ← mm:ss interval hook, auto-stop at 300s

apps/web/src/app/api/coach/[...path]/route.ts  ← PATCH: binary proxy for multipart

backend/api/src/coach/voice/
  service.ts                  ← voiceRouter: POST /transcribe
```

### Pattern 1: Hono Multipart Route (parseBody)

**What:** Parse a `multipart/form-data` POST in Hono v4 using built-in `parseBody`.
**When to use:** Whenever a Hono route receives file uploads.

```typescript
// Source: https://hono.dev/examples/file-upload [CITED: hono.dev]
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { authMiddleware } from '../../middleware/auth.js';

export const voiceRouter = new Hono();
voiceRouter.use('*', authMiddleware);

voiceRouter.post(
  '/transcribe',
  bodyLimit({
    maxSize: 20 * 1024 * 1024, // 20 MB soft (Whisper limit; Vercel enforces 4.5 MB hard)
    onError: (c) => c.json({ error: 'Audio file too large (max 20 MB)' }, 413),
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const file = body['audio'];
    if (!(file instanceof File)) {
      return c.json({ error: 'audio field is required (File)' }, 400);
    }
    // convert to Buffer for toFile
    const buffer = Buffer.from(await file.arrayBuffer());
    // ... call Whisper
  }
);
```

### Pattern 2: OpenAI Whisper via toFile (Buffer, no disk I/O)

**What:** Call Whisper-1 from a Buffer without writing to disk — mandatory on serverless.
**When to use:** Any serverless Whisper call where the audio comes in as a multipart blob.

```typescript
// Source: https://dev.to/ajones_codes/how-to-get-audio-transcriptions-from-whisper-without-a-file-system-21ek [CITED]
// Source: openai npm package v6 [VERIFIED: npm registry]
import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function transcribeBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  // filename extension must match the content type for Whisper to accept the file
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'fr', // D-06: forced FR, no auto-detect
  });
  return response.text; // response shape: { text: string }
}
```

**Response shape:** `{ text: string }` — the full transcript as a single string. [ASSUMED — based on training knowledge and community docs; OpenAI API reference was inaccessible during research]

### Pattern 3: MediaRecorder with mimeType negotiation (Safari compatibility)

**What:** Negotiate the recording format client-side before instantiating MediaRecorder.
**When to use:** Any browser mic recording that must work cross-browser including Safari.

```typescript
// Source: https://www.testmuai.com/learning-hub/mediarecorder-browser-support/ [CITED]
function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',  // Chrome, Firefox, Safari 18.4+
    'audio/webm',              // Fallback webm
    'audio/mp4',               // Safari < 18.4, iOS
    'audio/ogg;codecs=opus',   // Older Firefox
    '',                        // Browser default (last resort)
  ];
  return candidates.find((t) => t === '' || MediaRecorder.isTypeSupported(t)) ?? '';
}

// Usage in useVocalRecorder hook:
const mimeType = getSupportedMimeType();
const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
```

**Key:** The negotiated `mimeType` must be sent to the server alongside the blob so Whisper
receives the correct file extension. Send it as a separate form field:

```typescript
const formData = new FormData();
formData.append('audio', blob, `recording.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
// OR: send mimeType as a second field for the server to use in toFile
formData.append('mimeType', mimeType || 'audio/webm');
```

### Pattern 4: Proxy route patch for binary multipart passthrough

**What:** The existing `/api/coach/[...path]/route.ts` uses `req.text()` which corrupts binary.
**When to use:** Any coach route that sends binary (multipart) to Hono.

```typescript
// PATCH to apps/web/src/app/api/coach/[...path]/route.ts
// Replace line 20:  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();
// With:
const isMultipart = req.headers.get('Content-Type')?.includes('multipart/form-data');
const body = ['GET', 'HEAD'].includes(req.method)
  ? undefined
  : isMultipart
    ? await req.arrayBuffer()   // preserve binary; fetch accepts ArrayBuffer
    : await req.text();

// When body is an ArrayBuffer, don't override Content-Type header —
// let the original Content-Type (with boundary) pass through:
const headers: Record<string, string> = {};
if (!isMultipart) {
  headers['Content-Type'] = req.headers.get('Content-Type') ?? 'application/json';
}
if (session?.access_token) {
  headers['Authorization'] = `Bearer ${session.access_token}`;
}
```

**Critical note:** When forwarding multipart, the `Content-Type` header including the
`boundary=` parameter must be forwarded verbatim. If you set a new `Content-Type: multipart/form-data`
without the boundary, the upstream server cannot parse the body.

### Pattern 5: useReducer state machine for 5 states

**What:** Discriminated union + useReducer for the vocal state machine.
**When to use:** Any UI with 4+ states where invalid transitions must be prevented.

```typescript
// Source: UI-SPEC.md Implementation Notes [CITED: 01-UI-SPEC.md]
type VocalState =
  | { status: 'idle' }
  | { status: 'recording'; startedAt: number }
  | { status: 'transcribing'; blob: Blob; mimeType: string }
  | { status: 'review'; transcript: string }
  | { status: 'error'; blob: Blob; mimeType: string; message: string };

type VocalAction =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING'; blob: Blob; mimeType: string }
  | { type: 'TRANSCRIPTION_SUCCESS'; transcript: string }
  | { type: 'TRANSCRIPTION_ERROR'; message: string }
  | { type: 'RETRY' }       // error → transcribing (reuse blob)
  | { type: 'RELAUNCH' }    // review/error → idle
  | { type: 'VALIDATE' };   // review → idle (Phase 02 will intercept this)

function vocalReducer(state: VocalState, action: VocalAction): VocalState {
  switch (action.type) {
    case 'START_RECORDING': return { status: 'recording', startedAt: Date.now() };
    case 'STOP_RECORDING':  return { status: 'transcribing', blob: action.blob, mimeType: action.mimeType };
    case 'TRANSCRIPTION_SUCCESS': return { status: 'review', transcript: action.transcript };
    case 'TRANSCRIPTION_ERROR':
      if (state.status !== 'transcribing') return state;
      return { status: 'error', blob: state.blob, mimeType: state.mimeType, message: action.message };
    case 'RETRY':
      if (state.status !== 'error') return state;
      return { status: 'transcribing', blob: state.blob, mimeType: state.mimeType };
    case 'RELAUNCH':
    case 'VALIDATE':        return { status: 'idle' };
    default:                return state;
  }
}
```

### Anti-Patterns to Avoid

- **Passing `language: undefined` to Whisper:** The OpenAI SDK historically had a bug where
  undefined properties corrupted the multipart form data. Always pass `language: 'fr'` explicitly
  (per D-06) — never conditionally pass it.
- **Setting `Content-Type: multipart/form-data` manually in fetch:** When you pass a `FormData`
  object to `fetch`, the browser sets `Content-Type` with the correct `boundary` automatically.
  Never override this header client-side.
- **Using `fs.createReadStream()` in Hono:** The Hono serverless runtime on Vercel has no
  persistent filesystem. Always use `toFile(buffer, ...)` — never write to disk.
- **Forwarding Content-Type without boundary in proxy:** The multipart boundary is part of the
  Content-Type header. Stripping it breaks body parsing on the upstream.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Buffer → multipart file for Whisper | Custom FormData construction | `toFile` from `openai` package | Handles content-type inference, encoding edge cases, SDK typing |
| MIME type negotiation | Static string | `MediaRecorder.isTypeSupported()` | Browser codec support varies; hard-coding causes Safari failures |
| Request body size guard | Manual `content-length` check | `bodyLimit` from `hono/body-limit` | Built-in, handles streaming, correct 413 response |
| Auth token injection in proxy | Custom cookie parser | Existing Next.js proxy + `createServerSupabase().auth.getSession()` | Session is server-side only; already implemented in the proxy |

**Key insight:** The openai SDK's `toFile` helper is the only reliable way to send audio Buffers
to Whisper in a serverless environment. It is technically undocumented in official API reference
pages but is a first-class export of the `openai` npm package.

---

## Common Pitfalls

### Pitfall 1: Proxy corrupts binary multipart body
**What goes wrong:** `req.text()` decodes binary bytes as UTF-8, corrupting audio data.
**Why it happens:** The existing proxy was written for JSON-only coach endpoints.
**How to avoid:** Branch on `Content-Type: multipart/form-data` → use `req.arrayBuffer()`.
**Warning signs:** Hono `parseBody()` returns no file, or `file instanceof File` is false even
though the client clearly sent a file.

### Pitfall 2: Safari / iOS produces audio/mp4 not audio/webm
**What goes wrong:** Safari pre-18.4 silently ignores `{ mimeType: 'audio/webm;codecs=opus' }`
and records as `audio/mp4`. The blob arrives at the server with the wrong MIME type.
**Why it happens:** WebKit historically only supported AAC in MP4 containers for MediaRecorder.
Safari 18.4 (March 2025) added WebM/Opus support but older devices won't have it.
**How to avoid:** Use `getSupportedMimeType()` (Pattern 3) and pass the negotiated type as a
form field. Hono service uses that type in `toFile`. Whisper accepts both `webm` and `mp4`.
**Warning signs:** Blob MIME type is `audio/mp4` but filename is `recording.webm` → Whisper
may reject or misprocess the file.

### Pitfall 3: Vercel 4.5 MB hard request body limit
**What goes wrong:** Audio blob larger than 4.5 MB returns `413 FUNCTION_PAYLOAD_TOO_LARGE`
from Vercel before the Hono route even executes. This can happen with Safari's mp4/aac at
higher bitrates for recordings near 5 minutes.
**Why it happens:** Vercel enforces a hard 4.5 MB request body limit on serverless functions.
**How to avoid:** The 5-min webm/opus at 64 kbps is ~2.4 MB — safe. For Safari mp4/aac at
128 kbps, 5 min = ~4.8 MB — unsafe. Mitigation: consider enforcing a 4-minute max on Safari
(detected via `mimeType.includes('mp4')`), or add a client-side blob size check before upload
with a user-facing warning.
**Warning signs:** `fetch` response status `413` with no Hono log (Vercel rejects before Hono).

### Pitfall 4: `beforeunload` during `transcribing` state
**What goes wrong:** D-04 states that upload interruption during `transcribing` returns to
`idle` without recovery. The `beforeunload` warning is only for `recording`, not `transcribing`.
**Why it happens:** If the developer adds the `beforeunload` listener for both states, the
user is blocked from leaving even after stopping recording.
**How to avoid:** Guard the `beforeunload` listener strictly on `state.status === 'recording'`
(as shown in UI-SPEC.md).

### Pitfall 5: Content-Type boundary stripping in proxy
**What goes wrong:** When the proxy overwrites `Content-Type` without preserving the boundary
parameter, `hono/body-limit` and `parseBody` fail to parse the multipart body. The upstream
receives malformed content.
**Why it happens:** Developers often set `'Content-Type': 'multipart/form-data'` manually,
forgetting that the browser auto-appends `; boundary=----XYZ`.
**How to avoid:** When body is multipart, forward the `Content-Type` header from `req.headers`
verbatim — do not construct a new one.

### Pitfall 6: `toFile` filename extension must match content type
**What goes wrong:** Whisper uses the filename extension to determine audio codec. If the
blob is `audio/mp4` but the file is named `recording.webm`, Whisper may return an error or
produce garbage output.
**Why it happens:** The filename is the only codec hint Whisper receives when content-type
is not verified end-to-end.
**How to avoid:** Derive the extension from the negotiated `mimeType` field:
`mimeType.includes('mp4') ? 'recording.mp4' : 'recording.webm'`.

### Pitfall 7: maxDuration not exported for Vercel on the voice route
**What goes wrong:** Whisper transcription can take 10–30 seconds for long recordings. Without
`export const maxDuration = 60`, Vercel may time out the function at the default (10 s on Hobby).
**Why it happens:** Vercel default function timeout is 10 s on Hobby tier.
**How to avoid:** Export `maxDuration = 60` from `backend/api/src/coach/voice/service.ts`,
following the precedent of `importsRouter` (which already exports `maxDuration = 60`).

---

## Code Examples

### Complete voiceRouter service.ts skeleton

```typescript
// backend/api/src/coach/voice/service.ts
// [ASSUMED pattern — based on importsRouter precedent in this codebase]
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import OpenAI, { toFile } from 'openai';
import { authMiddleware } from '../../middleware/auth.js';

export const maxDuration = 60; // Vercel: allow up to 60s for Whisper

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const voiceRouter = new Hono();
voiceRouter.use('*', authMiddleware);

voiceRouter.post(
  '/transcribe',
  bodyLimit({
    maxSize: 20 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Audio file too large (max 20 MB)' }, 413),
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const audioFile = body['audio'];
    const mimeType = (body['mimeType'] as string) ?? 'audio/webm';

    if (!(audioFile instanceof File)) {
      return c.json({ error: 'audio field is required' }, 400);
    }

    try {
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

      const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'fr',
      });

      return c.json({ transcript: response.text });
    } catch (err: any) {
      console.error('[coach/voice] transcribe error:', err.message);
      return c.json({ error: err.message ?? 'Transcription failed' }, 500);
    }
  },
);
```

### useVocalRecorder hook skeleton

```typescript
// apps/web/src/components/coach/vocal/useVocalRecorder.ts
// [ASSUMED — based on MediaRecorder Web API; source: MDN Web Docs]
import { useRef, useCallback } from 'react';

function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    '',
  ];
  return candidates.find((t) => t === '' || MediaRecorder.isTypeSupported(t)) ?? '';
}

export function useVocalRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');

  const startRecording = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    mimeTypeRef.current = mimeType || 'audio/webm';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start(250); // collect data every 250ms
  }, []);

  const stopRecording = useCallback((): Promise<{ blob: Blob; mimeType: string }> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current!;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        // Stop all tracks to release mic
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve({ blob, mimeType: mimeTypeRef.current });
      };
      recorder.stop();
    });
  }, []);

  return { startRecording, stopRecording };
}
```

### Proxy route patch (binary passthrough)

```typescript
// apps/web/src/app/api/coach/[...path]/route.ts — replace body handling section
const isMultipart = req.headers.get('Content-Type')?.includes('multipart/form-data') ?? false;

const headers: Record<string, string> = {};
// For multipart: forward original Content-Type verbatim (preserves boundary parameter)
// For all others: set Content-Type explicitly
if (!isMultipart) {
  headers['Content-Type'] = req.headers.get('Content-Type') ?? 'application/json';
}
if (session?.access_token) {
  headers['Authorization'] = `Bearer ${session.access_token}`;
}

const body = ['GET', 'HEAD'].includes(req.method)
  ? undefined
  : isMultipart
    ? await req.arrayBuffer()
    : await req.text();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `recorder.start()` with no timeslice | `recorder.start(250)` with timeslice | MDN best practice | Prevents large single chunk on mobile; smoother stop |
| `fileFromPath()` (openai SDK v3) | `toFile(buffer, filename, {type})` (openai SDK v4+) | openai v4.0 | No filesystem required; works on serverless |
| Safari WebM not supported | Safari 18.4 supports WebM/Opus | March 2025 | Still must negotiate — older devices in field |
| Vercel body limit bypass via streaming | Not applicable for synchronous Whisper upload | — | Must stay under 4.5 MB per request |

**Deprecated/outdated:**

- `openai.createTranscription()` — v3 API, removed in v4. Use `openai.audio.transcriptions.create()`.
- `fileFromPath()` from `openai/uploads` — still works but disk-based; not usable on serverless.
- `MediaRecorder.isTypeSupported` not available — was briefly a Safari gap, now available in all modern browsers.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `openai.audio.transcriptions.create()` response shape is `{ text: string }` | Code Examples | Service returns different field name → `response.text` is undefined, transcript is empty string |
| A2 | `toFile` is exported as a named export from the `openai` package in v6 | Standard Stack / Code Examples | Import fails → build error |
| A3 | Whisper-1 accepts `audio/mp4` MIME type for Safari recordings | Common Pitfalls / Architecture | Safari recordings fail transcription silently |
| A4 | `hono/body-limit` is importable from `hono` v4.7.0 without additional packages | Standard Stack | Build error if sub-path export doesn't exist |
| A5 | Passing `req.arrayBuffer()` as the `body` to `fetch()` in the proxy correctly forwards binary data | Proxy pattern | Audio corrupted despite patch; Hono parseBody still fails |

**Verification steps for each assumption before implementation:**

- A1: `npm view openai` or check `openai/src/resources/audio/transcriptions.ts` type definitions
- A2: `import { toFile } from 'openai'` — check TypeScript resolves; no runtime check needed
- A3: Confirmed `mp4` is in Whisper's supported format list per OpenAI community docs [MEDIUM confidence]
- A4: `import { bodyLimit } from 'hono/body-limit'` — verify in Hono 4.7.0 package.json exports map
- A5: Standard `fetch` API accepts `ArrayBuffer` as body — well-established [HIGH confidence]

---

## Open Questions (RESOLVED)

1. **OPENAI_API_KEY environment variable name** — RESOLVED: Plan 01-02 Task 1 verifies/adds `OPENAI_API_KEY` to `backend/api/.env.example` and warns executor if absent from `.env.local`. `service.ts` references `process.env.OPENAI_API_KEY`.

2. **Safari mp4 blob size at 5 minutes** — RESOLVED: Plan 01-04 Task 2 adds a client-side `blob.size > 4_000_000` guard with a user-facing warning "Fichier trop volumineux. Réenregistrez avec une durée plus courte." before upload.

3. **`hono/body-limit` sub-path export availability** — RESOLVED: Plans 01-02 and 01-03 include runtime verification (`node -e "require('hono/body-limit')"`) with documented fallback to `import { bodyLimit } from 'hono'` main export.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai` npm package | Whisper transcription | ✗ | — | None — must install |
| `OPENAI_API_KEY` env var | `new OpenAI({apiKey})` | Unknown | — | Must add to `.env` |
| `hono/body-limit` | Route size guard | ✓ (bundled with hono 4.7.0) | 4.7.0 | Import from `hono` main |
| `gsap` | UI animations (UI-SPEC) | ✓ | 3.15.0 | — |
| `lucide-react` | Icons (UI-SPEC) | ✓ | project standard | — |
| MediaRecorder Web API | Browser recording | ✓ | Web API (all modern browsers) | — |
| `navigator.mediaDevices.getUserMedia` | Mic access | ✓ | Web API (HTTPS required) | — |

**Missing dependencies with no fallback:**
- `openai` package — must be installed in `backend/api/` before any Whisper code runs
- `OPENAI_API_KEY` — must be present in `backend/api/.env` and `backend/api/.env.example`

**Missing dependencies with fallback:**
- None

**HTTPS requirement note:** `navigator.mediaDevices.getUserMedia()` requires a secure context
(HTTPS or `localhost`). The production Vercel deployment is HTTPS. Local dev uses `localhost`
(also secure context). No issue anticipated.

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to false — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already configured in backend/api and apps/web) |
| Config file | `backend/api/vitest.config.ts` (or vitest defaults via package.json) |
| Quick run command | `npm run test --workspace=backend/api` |
| Full suite command | `npm run test` (Turborepo) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | MediaRecorder starts/stops and produces a non-empty blob | unit (hook) | `vitest run apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` | ❌ Wave 0 |
| VOICE-01 | Auto-stop triggers at 300s | unit (timer hook) | `vitest run apps/web/src/components/coach/vocal/useVocalTimer.test.ts` | ❌ Wave 0 |
| VOICE-02 | POST /coach/voice/transcribe returns `{ transcript: string }` for valid audio | integration (API) | `vitest run backend/api/test/voice.test.ts` | ❌ Wave 0 |
| VOICE-02 | POST /coach/voice/transcribe returns 401 without JWT | unit | same file | ❌ Wave 0 |
| VOICE-02 | POST /coach/voice/transcribe returns 400 if no audio field | unit | same file | ❌ Wave 0 |
| VOICE-03 | VocalReview renders transcript text and both buttons | unit (component) | `vitest run apps/web/src/components/coach/vocal/VocalReview.test.tsx` | ❌ Wave 0 |
| VOICE-03 | State machine transitions: STOP_RECORDING → transcribing, SUCCESS → review | unit (reducer) | `vitest run apps/web/src/components/coach/vocal/vocalReducer.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test --workspace=backend/api` (backend tests only, ~5s)
- **Per wave merge:** `npm run test` (full Turborepo suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/src/components/coach/vocal/useVocalRecorder.test.ts` — mock `getUserMedia`, test blob output
- [ ] `apps/web/src/components/coach/vocal/useVocalTimer.test.ts` — fake timers, test auto-stop at 300s
- [ ] `apps/web/src/components/coach/vocal/vocalReducer.test.ts` — all state transitions
- [ ] `apps/web/src/components/coach/vocal/VocalReview.test.tsx` — render + buttons
- [ ] `backend/api/test/voice.test.ts` — route unit tests with mocked OpenAI client

---

## Security Domain

> `security_enforcement` not explicitly set to false — included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authMiddleware` (Supabase JWT) — already in pattern |
| V3 Session Management | no | Route is stateless (no session created) |
| V4 Access Control | yes | JWT-scoped access — coach can only upload audio for their own use; no client_id in route body |
| V5 Input Validation | yes | `bodyLimit` (size), `instanceof File` check (type), mimeType field validation |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized audio payload (DoS) | DoS | `bodyLimit(20MB)` in Hono; Vercel 4.5MB hard limit |
| Unauthenticated transcription (API cost abuse) | Elevation of Privilege | `authMiddleware` before all `/coach/voice/*` routes |
| Arbitrary file upload via audio field | Tampering | `instanceof File` check; filename-derived extension only; Whisper rejects non-audio |
| OPENAI_API_KEY exposure | Information Disclosure | Key only in `backend/api/.env` (server-side); never in `apps/web/.env` or response bodies |
| Client-side mimeType spoofing | Tampering | Server should validate mimeType field against a whitelist: `['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4']` |

---

## Sources

### Primary (HIGH confidence)

- Hono official docs — `https://hono.dev/examples/file-upload` — `parseBody`, `bodyLimit` middleware API
- npm registry — `npm view openai version` → `6.39.0` — package exists and is current
- Vercel official docs — `https://vercel.com/docs/functions/limitations` — 4.5 MB body size limit confirmed
- Project codebase — `backend/api/src/coach/ai/service.ts` — auth middleware usage pattern
- Project codebase — `backend/api/src/app.ts` — route mounting pattern
- Project codebase — `apps/web/src/app/api/coach/[...path]/route.ts` — proxy bug identified
- Project codebase — `apps/web/src/components/coach/ChatInputBar.tsx` — GSAP pattern confirmed in use
- Project codebase — `backend/api/package.json` — `openai` confirmed absent, `hono@4.7.0` confirmed

### Secondary (MEDIUM confidence)

- OpenAI community / `transcribetube.com` — Whisper-1 supported formats (mp3, mp4, mpeg, mpga, m4a, wav, webm); 25 MB limit; 429 rate limiting
- Safari WebM support — `testmuai.com/learning-hub/mediarecorder-browser-support/` — Safari 18.4 added WebM/Opus; older Safari produces audio/mp4
- `dev.to/ajones_codes` — `toFile` helper for serverless Whisper without disk I/O

### Tertiary (LOW confidence)

- Whisper-1 response shape `{ text: string }` — training knowledge, official OpenAI API reference was inaccessible (403 during research)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — openai v6.39.0 verified on npm; Hono bodyLimit verified in official docs
- Architecture: HIGH — based on reading actual codebase files (proxy, auth middleware, route mounting)
- Pitfalls: HIGH — proxy bug, Vercel limit, and Safari codec issue all verified with official sources
- Whisper response shape: LOW — OpenAI docs returned 403; based on training + community sources

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — Hono and openai are stable; Vercel limits rarely change)
