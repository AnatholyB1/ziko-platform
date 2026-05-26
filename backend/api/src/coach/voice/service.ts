// Coach Voice bounded module — Phase 01-03 (Retour Vocal).
// Exposes: POST /coach/voice/transcribe
// Full Whisper transcription implementation.

// Vercel: allow up to 60s for audio transcription operations
export const maxDuration = 60;

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import OpenAI, { toFile } from 'openai';
import { authMiddleware } from '../../middleware/auth.js';

// OpenAI client at module scope — avoid re-instantiation on every request
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Allowed audio MIME types (T-01-04: mimeType whitelist validation)
const ALLOWED_MIME_TYPES = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4'];

export const voiceRouter = new Hono();

// All voice routes require a valid Supabase JWT (D-07 / T-01-02 security requirement)
voiceRouter.use('*', authMiddleware);

// POST /transcribe — accepts multipart/form-data with an "audio" File field + optional "mimeType" field
// Returns { transcript: string } on success
voiceRouter.post(
  '/transcribe',
  bodyLimit({
    maxSize: 20 * 1024 * 1024, // 20 MB max (T-01-03)
    onError: (c) => c.json({ error: 'Audio file too large (max 20 MB)' }, 413),
  }),
  async (c) => {
    // 1. Parse multipart body
    const body = await c.req.parseBody();

    // 2. Validate audio field
    const audioFile = body['audio'];
    if (!(audioFile instanceof File)) {
      return c.json({ error: 'audio field is required' }, 400);
    }

    // 3. Validate mimeType against whitelist (T-01-04)
    const mimeType = (body['mimeType'] as string) ?? 'audio/webm';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return c.json({ error: 'Unsupported audio format. Use webm or mp4.' }, 400);
    }

    try {
      // 4. Convert File to Buffer
      const buffer = Buffer.from(await audioFile.arrayBuffer());

      // 5. Derive filename extension from mimeType
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

      // 6. Wrap in OpenAI-compatible File object
      const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

      // 7. Call Whisper-1 with language: 'fr' hardcoded (D-06 — never auto-detect)
      const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'fr',
      });

      // 8. Return transcript
      return c.json({ transcript: response.text });
    } catch (err: any) {
      console.error('[coach/voice] transcribe error:', err.message);
      return c.json({ error: err.message ?? 'Transcription failed' }, 500);
    }
  },
);
