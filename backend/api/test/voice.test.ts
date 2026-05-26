/**
 * voice.test.ts — RED stubs for POST /coach/voice/transcribe (Wave 0)
 *
 * Tests 1: 401 without JWT — PASSES once authMiddleware mock is wired
 * Tests 2–4: 400 / 413 / 200 — RED in Wave 0 (handler returns 501)
 *             Will go GREEN in Wave 1 (plan 01-03)
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ─── Mock OpenAI client (never hit real API in tests) ─────────────────────────
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({ text: 'mocked transcript' });
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockCreate,
      },
    },
  }));
  return {
    default: MockOpenAI,
    toFile: vi.fn().mockResolvedValue({ name: 'audio.webm', type: 'audio/webm' }),
  };
});

// ─── Mock authMiddleware — bypass Supabase JWT validation in unit tests ───────
vi.mock('../src/middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing Authorization header' }, 401);
    }
    c.set('auth', { userId: 'test-user-id', email: 'test@example.com' });
    await next();
  }),
}));

// ─── Import after mocks are registered ───────────────────────────────────────
import { voiceRouter } from '../src/coach/voice/service.js';

// ─── Helper: build a multipart FormData request with an audio file ────────────
function makeAudioRequest(opts: {
  authHeader?: string;
  includeAudio?: boolean;
  audioSize?: number;
} = {}) {
  const { authHeader = 'Bearer test-jwt-token', includeAudio = true, audioSize = 1024 } = opts;

  const formData = new FormData();
  if (includeAudio) {
    const audioBytes = new Uint8Array(audioSize);
    const blob = new Blob([audioBytes], { type: 'audio/webm' });
    formData.append('audio', blob, 'recording.webm');
  }

  const headers: Record<string, string> = {
    Authorization: authHeader,
  };

  return new Request('http://localhost/transcribe', {
    method: 'POST',
    headers,
    body: formData,
  });
}

describe('POST /transcribe', () => {
  // ── Test 1: 401 without Authorization header ────────────────────────────────
  it('returns 401 without Authorization header', async () => {
    const req = new Request('http://localhost/transcribe', {
      method: 'POST',
      body: new FormData(),
      // No Authorization header
    });

    const res = await voiceRouter.fetch(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  // ── Test 2: 400 when no audio field in multipart ────────────────────────────
  // RED in Wave 0 — handler returns 501 until Wave 1 adds real validation
  it('returns 400 when no audio field in multipart', async () => {
    const req = makeAudioRequest({ includeAudio: false });
    const res = await voiceRouter.fetch(req);
    // Wave 0: handler returns 501; Wave 1 will change this to 400
    expect(res.status).toBe(400);
  });

  // ── Test 3: 413 for oversized payload ───────────────────────────────────────
  // RED in Wave 0 — bodyLimit middleware only fires when Content-Length header
  // is present OR the body actually exceeds the limit during streaming
  it('returns 413 for oversized payload', async () => {
    // 21 MB > 20 MB limit
    const oversizedSize = 21 * 1024 * 1024;
    const req = makeAudioRequest({ audioSize: oversizedSize });

    const res = await voiceRouter.fetch(req);
    // Wave 0: handler may return 413 (bodyLimit) or 501 (stub) depending on runtime;
    // Wave 1 will ensure 413 is returned consistently for oversized files
    expect(res.status).toBe(413);
  });

  // ── Test 4: 200 with transcript when OpenAI mock resolves ───────────────────
  // RED in Wave 0 — handler returns 501 until Wave 1 wires Whisper call
  it('returns 200 with transcript when OpenAI mock resolves', async () => {
    const req = makeAudioRequest();
    const res = await voiceRouter.fetch(req);
    // Wave 0: handler returns 501; Wave 1 will return 200 { transcript: string }
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('transcript');
    expect(typeof json.transcript).toBe('string');
  });
});
