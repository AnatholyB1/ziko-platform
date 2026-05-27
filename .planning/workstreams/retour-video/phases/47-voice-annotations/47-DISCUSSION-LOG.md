# Phase 47: Voice Annotations — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 47-voice-annotations
**Areas discussed:** Voice composer in panel, Claude cleaning scope, lib/whisper.ts extraction scope

---

## Voice Composer in Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Mode toggle in composing | Add mode: 'text' \| 'voice' to composing state. VoiceComposer child component owns recording lifecycle. Parent reducer stays at 5 states. Calls back via onVoiceReady({ transcript, audioPath }). | ✓ |
| Extend reducer with voice states | Rename composing → composing_text, add recording, transcribing, voice_review states (8 total). Unified but coupled machine. | |

**User's choice:** Mode toggle in composing (Recommended)
**Notes:** VoiceComposer mirrors VocalRetourPanel architecture pattern. [Text][Mic] toggle tabs in composing view.

---

## Transcription Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show error + Re-record | Inline error in VoiceComposer, [Ré-enregistrer] resets to idle. Timestamp preserved. No navigation change. | ✓ |
| Show error + manual text fallback | On failure: offer 'Saisir manuellement' — switches back to text mode, pre-fills textarea with raw transcript if available. | |

**User's choice:** Show error + Re-record (Recommended)
**Notes:** Keeps the flow simple. Coach retries or cancels from the same composing context.

---

## Claude Cleaning Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Filler removal only | Strip euh, hmm, ben, voilà, repetitions. Return cleaned transcript verbatim. Fast, cheap, preserves coach phrasing. | |
| Light coaching reformat | Claude lightly reformats as a clear action note: observation + correction in 1-2 sentences. | ✓ |

**User's choice:** Light coaching reformat
**Notes:** User overrode the recommended option. Annotation content should read as a polished coaching note, not raw speech.

### Follow-up: Claude output format

| Option | Description | Selected |
|--------|-------------|----------|
| 1-2 clean sentences | Natural observation + action. No labels. Max 2 sentences. E.g. "Ton dos arrondit — pense à garder les omoplates serrées." | ✓ |
| Observation + action label | Two labeled lines: Observation: [...] / Correction: [...]. More clinical. | |

**User's choice:** 1-2 clean sentences (Recommended)

---

## lib/whisper.ts Extraction Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full utility module | Exports ALLOWED_MIME_TYPES, validateMimeType(), transcribeAudio(). OpenAI client at module scope. Both voice/service.ts and new route import it. | ✓ |
| Minimal: just transcribeAudio() | Only exports transcribeAudio(buffer, mimeType). MIME validation and OpenAI init left to each caller. | |

**User's choice:** Full utility module (Recommended)
**Notes:** Avoids duplication of MIME validation across routes. v1.9 voice/service.ts refactored to import from lib/whisper.ts (behavior unchanged).

---

## Claude's Discretion

- Audio upload path: Hono multipart (same as v1.9, audio 1–5MB) — not discussed, recommended approach
- Audio player: native `<audio controls>` with signed read URL — standard approach
- Storage path convention: `{athleteId}/annotations/{annotationId}.webm` — consistent with video path pattern

## Deferred Ideas

- Re-record / replace audio on existing voice annotation → post-v1.13
- Audio player on mobile (athlete listens to raw voice) → post-v1.13
- Multi-language transcription (currently hardcoded `language: 'fr'`) → post-v1.13
