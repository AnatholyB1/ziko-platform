// Shared Whisper transcription utility — Phase 47 (lib/whisper.ts).
// Imported by both coach/voice/service.ts (v1.9) and coach/videos/service.ts (voice annotations).

import OpenAI, { toFile } from 'openai';

// OpenAI client at module scope — avoid re-instantiation on every request
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/** Allowed audio MIME types (T-47-01: whitelist validation) */
export const ALLOWED_MIME_TYPES: string[] = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
];

/**
 * Returns true if the given MIME type is in the allowed whitelist.
 * Use this to validate client-supplied mimeType fields before transcription.
 */
export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Transcribes a raw audio buffer using OpenAI Whisper-1.
 * Language is hardcoded to 'fr' (D-06 — never auto-detect).
 *
 * @param buffer  Raw audio bytes
 * @param mimeType  Must be one of ALLOWED_MIME_TYPES
 * @returns  The transcription text
 */
export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'fr',
  });

  return response.text;
}
