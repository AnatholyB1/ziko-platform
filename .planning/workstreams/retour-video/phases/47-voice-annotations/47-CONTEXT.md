# Phase 47: Voice Annotations — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

The coach can switch to voice mode in the annotation composer (via a mode toggle in the existing AnnotationPanel), record a short voice comment at the current timecode, receive a Whisper transcription cleaned by Claude into 1-2 natural coaching sentences, and see the result saved as a voice annotation in the panel. The audio blob is stored in `coach-videos/annotations/` and the inline audio player renders the raw recording alongside the cleaned transcript in the annotation list.

**This phase does NOT include:** mobile voice recording (athlete sees cleaned transcript text on mobile — no audio player on mobile), re-record after annotation is saved, resend notifications for voice annotations (unless trivial to add).

</domain>

<decisions>
## Implementation Decisions

### Voice Composer Integration (AnnotationPanel)
- **D-01:** Voice mode is a **mode toggle inside the existing `composing` state** — the parent reducer stays at 5 states (`list`, `composing`, `editing`, `sending`, `sent`). The `composing` state gains a `mode: 'text' | 'voice'` field. A `[Text] [Mic]` toggle appears at the top of the composing view. When voice mode is active, a **VoiceComposer child component** mounts and owns the full recording lifecycle (record → upload blob → transcribe → preview). When VoiceComposer finishes, it calls `onVoiceReady({ transcript, audioPath })` — the parent captures timestamp_s + transcript + audioPath and saves the annotation via the existing CRUD.
- **D-02:** Transcription failure in VoiceComposer → inline error message + **[Ré-enregistrer] button** resets to idle state. No navigation change. `timestamp_s` is preserved. No manual text fallback offered.

### VoiceComposer Architecture
- **D-03:** VoiceComposer mirrors `VocalRetourPanel.tsx` pattern: `useReducer` for internal states (`idle` → `recording` → `transcribing` → `review` → `error`), `useVocalRecorder` for MIME negotiation + blob, GSAP entrance animation optional. After stopping: uploads blob to Hono `POST /coach/videos/annotations/transcribe` as multipart (audio blob + mimeType + videoId + timestamp_s). Hono route uploads blob to storage, calls `transcribeAudio()` + Claude cleaning, returns `{ transcript, audioPath }`. VoiceComposer shows transcript preview → coach clicks [Sauvegarder] → parent saves annotation.
- **D-04:** Audio upload goes **through Hono as multipart** (same as v1.9 `/coach/voice/transcribe` pattern). Audio clips are 1–5 MB — well under the 20 MB Hono body limit. No signed PUT URL needed for audio.

### Claude Cleaning
- **D-05:** Claude produces **1-2 clean natural coaching sentences** — observation + action. Example: _"Ton dos arrondit à la montante — pense à garder les omoplates serrées."_ No section labels, no structured card, no tags. Max 2 sentences. Preserves the coaching intent without turning it into a formal card. System prompt instructs: remove fillers + lightly reformat as a clear timecoded observation.
- **D-06:** The new Hono route `POST /coach/videos/annotations/transcribe` handles the full pipeline: blob upload to storage → Whisper (via `lib/whisper.ts`) → Claude cleaning (via `generateText` or `generateObject` with simple string schema) → returns `{ transcript: string, audioPath: string }`.

### lib/whisper.ts Extraction
- **D-07:** `lib/whisper.ts` is a **full utility module** at `backend/api/src/lib/whisper.ts`. Exports:
  - `ALLOWED_MIME_TYPES: string[]`
  - `validateMimeType(mimeType: string): boolean`
  - `transcribeAudio(buffer: Buffer, mimeType: string): Promise<string>`
  - OpenAI client initialized once at module scope inside the file.
- **D-08:** `backend/api/src/coach/voice/service.ts` (v1.9) is **refactored** to import `transcribeAudio` and `validateMimeType` from `lib/whisper.ts` — no behavior change, just a DRY refactor. The v1.9 route endpoints and their responses remain byte-identical.

### Inline Audio Player (Web Panel)
- **D-09:** Audio player in the annotation panel list renders as a native `<audio controls>` element with `preload="none"`. The audio URL is a Supabase signed URL fetched when the annotation panel mounts (or lazily on expand). Fetched from a new endpoint `GET /coach/videos/annotations/:annotationId/audio-url` which calls `createSignedUrl` on the audio_path in storage. Short expiry (15 min).
- **D-10:** Voice annotation entries in the panel list are visually distinguished: mic icon (`🎙` or Lucide `Mic` icon) before the timestamp chip, followed by the cleaned transcript text, followed by the `<audio>` player.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/workstreams/retour-video/ROADMAP.md` — Phase 47 goal, VOICE-01..04 success criteria, isolation rule (lib/whisper.ts shared, v1.9 route never modified)
- `.planning/workstreams/retour-video/REQUIREMENTS.md` — VOICE-01, VOICE-02, VOICE-03, VOICE-04 full definitions

### Prior Phase Context
- `.planning/workstreams/retour-video/phases/46-web-player-text-annotations/46-CONTEXT.md` — AnnotationPanel decisions (D-01..D-11), composing state structure, VocalRetourPanel as reference pattern, push notification pattern

### Existing Voice (v1.9 — MUST NOT BE MODIFIED except DRY refactor)
- `backend/api/src/coach/voice/service.ts` — v1.9 Whisper + Claude implementation; lib/whisper.ts is extracted from here; `POST /coach/voice/transcribe` and `POST /coach/voice/structure` routes stay byte-identical post-refactor
- `backend/api/src/app.ts` — v1.9 voice router mounted at `/coach/voice` (line 79)

### Web Components to Extend / Reuse
- `apps/web/src/components/coach/videos/AnnotationPanel.tsx` — existing 5-state panel to extend with voice mode toggle in composing state
- `apps/web/src/components/coach/vocal/useVocalRecorder.ts` — MediaRecorder hook: MIME negotiation, start/stop, blob return — drop-in for VoiceComposer
- `apps/web/src/components/coach/vocal/VocalRetourPanel.tsx` — reference architecture for VoiceComposer (useReducer lifecycle, useVocalRecorder integration, GSAP entrance)
- `apps/web/src/components/coach/vocal/vocalReducer.ts` — state machine pattern reference

### Design System
- `CLAUDE.md` — Design tokens: primary `#FF5C1A`, background `#F7F6F3`, border `#E2E0DA`, text `#1C1A17`, muted `#6B6963`; Lucide icons for web; no dark mode

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useVocalRecorder.ts` — `start()` / `stop(): Promise<{ blob, mimeType }>` — drop-in for VoiceComposer. No changes needed.
- `VocalRetourPanel.tsx` — full reference for VoiceComposer: internal useReducer + useVocalRecorder + useVocalTimer + GSAP panel entrance. VoiceComposer is a lighter version of this.
- `voice/service.ts` lines 7–76 — entire Whisper block to extract into lib/whisper.ts: OpenAI init, `ALLOWED_MIME_TYPES`, `toFile()` wrapping, `openai.audio.transcriptions.create({ language: 'fr' })`.

### Established Patterns
- **Hono multipart upload**: v1.9 `POST /coach/voice/transcribe` parses body with `c.req.parseBody()`, validates audio as `instanceof File`, extracts mimeType. Same pattern for new route.
- **Supabase storage upload**: `supabaseAdmin.storage.from('coach-videos').upload(path, buffer)` — same client already initialized in `videos/service.ts`.
- **Signed read URL**: `supabaseAdmin.storage.from('coach-videos').createSignedUrl(path, 900)` — 15 min expiry, same as video signed URL.
- **generateObject / generateText**: Claude call pattern from voice/service.ts lines 253–259. For simple string output (1-2 sentences), `generateText` is simpler than `generateObject`.

### Integration Points
- `AnnotationPanel.tsx` — add `mode: 'text' | 'voice'` to `composing` state type; mount `<VoiceComposer>` conditionally when mode is 'voice'; VoiceComposer calls `onVoiceReady` callback, parent then calls existing annotation save logic with `type: 'voice'`, `content: transcript`, `audio_path: audioPath`.
- `backend/api/src/app.ts` — new route file `coach/videos/annotations-voice.ts` (or extend `coach/videos/service.ts`) registered at `/coach/videos`.
- `lib/whisper.ts` — new file at `backend/api/src/lib/whisper.ts`; imported by both `voice/service.ts` (refactor) and new video annotations voice route.

</code_context>

<specifics>
## Specific Ideas

- VoiceComposer composing view layout: `[Text] [Mic]` mode toggle tabs at top, timestamp chip read-only below, then recording controls or transcript preview depending on state.
- After Whisper+Claude returns: show transcript in a read-only textarea style box with "Transcription IA — vous pouvez modifier avant de sauvegarder" label, then [Sauvegarder] [Ré-enregistrer] buttons.
- Voice annotation in panel list: `🎙 1:23 — "Ton dos arrondit à la montante — pense à garder les omoplates serrées."` then `<audio controls>` player below.
- On mobile (athlete VideoPlayerScreen): voice annotations show their cleaned `content` text exactly like text annotations. No audio player on mobile in Phase 47.
- Storage path convention: `{athleteId}/annotations/{annotationId}.webm` (or .mp4 based on mimeType). Consistent with video path `{athleteId}/{videoId}.mp4`.

</specifics>

<deferred>
## Deferred Ideas

- Re-record / replace audio on an existing voice annotation — post-v1.13
- Audio player on mobile (athlete hears the raw voice recording) — post-v1.13
- Voice annotation transcription in multiple languages (currently hardcoded `language: 'fr'`) — post-v1.13
- Auto-transcription of athlete video content (full video Whisper transcript) — explicitly out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 47 — Voice Annotations*
*Context gathered: 2026-05-27*
