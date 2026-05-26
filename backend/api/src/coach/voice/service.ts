// Coach Voice bounded module — Wave 0 skeleton (Phase 01 — Retour Vocal).
// Exposes: POST /coach/voice/transcribe
// Wave 1 (plan 01-03) will replace the 501 stub with real Whisper transcription.

// Vercel: allow up to 60s for audio transcription operations
export const maxDuration = 60;

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
// OpenAI and toFile imported here so Wave 1 can use them without changing the import block
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import OpenAI, { toFile } from 'openai';
import { authMiddleware } from '../../middleware/auth.js';

export const voiceRouter = new Hono();

// All voice routes require a valid Supabase JWT (D-07 security requirement)
voiceRouter.use('*', authMiddleware);

// POST /transcribe — accepts multipart/form-data with an "audio" file field
// Returns 501 in Wave 0; Wave 1 (plan 01-03) wires the real Whisper call here
voiceRouter.post(
  '/transcribe',
  bodyLimit({
    maxSize: 20 * 1024 * 1024, // 20 MB max
    onError: (c) => c.json({ error: 'Audio file too large (max 20 MB)' }, 413),
  }),
  async (c) => {
    // Wave 1 (plan 01-03) will replace the 501 stub with real Whisper transcription
    return c.json({ error: 'not implemented' }, 501);
  },
);
