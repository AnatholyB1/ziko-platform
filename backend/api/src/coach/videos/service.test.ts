/**
 * Unit tests for coach/videos Hono router (service.ts).
 * All external dependencies (db, notificationService, supabaseAdmin) are mocked.
 *
 * Covers the 5 behavior cases defined in the plan:
 * 1. POST /upload-url with valid linked athlete JWT → 200 { signedUrl, videoId, path }
 * 2. POST /upload-url with unlinked athlete JWT → 403 { error: 'NOT_LINKED' }
 * 3. POST /upload-url with no auth → 401
 * 4. POST /:videoId/complete with valid body → 200 { ok: true }, notificationService.send called
 * 5. POST /:videoId/complete with missing title → 400
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock: auth middleware ─────────────────────────────────────────────────────
// Hoisted first to avoid circular dependency issues
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing Authorization header' }, 401);
    }
    c.set('auth', { userId: 'athlete-uuid-test', email: 'athlete@test.com' });
    await next();
  }),
}));

// ── Mock: db module ───────────────────────────────────────────────────────────
// Use vi.fn() directly in factory (no external variable references — vi.mock is hoisted)
vi.mock('./db.js', () => ({
  getActiveCoachForAthlete: vi.fn(),
  insertVideoRecord: vi.fn(),
}));

// ── Mock: notificationService ─────────────────────────────────────────────────
vi.mock('../../services/notificationService.js', () => ({
  notificationService: {
    send: vi.fn(),
  },
}));

// ── Mock: @supabase/supabase-js ───────────────────────────────────────────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: {
            signedUrl: 'https://storage.supabase.co/signed-url',
            path: 'athlete-uuid-test/some-video-id.mp4',
            token: 'tok',
          },
          error: null,
        }),
      })),
    },
  })),
}));

// Import AFTER mocks are registered
import { videosRouter } from './service.js';
import * as dbModule from './db.js';
import { notificationService } from '../../services/notificationService.js';

// ── Typed references to mocks ─────────────────────────────────────────────────
const mockGetActiveCoachForAthlete = vi.mocked(dbModule.getActiveCoachForAthlete);
const mockInsertVideoRecord = vi.mocked(dbModule.insertVideoRecord);
const mockNotificationSend = vi.mocked(notificationService.send);

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(
  path: string,
  options: { method?: string; auth?: boolean; body?: object } = {},
) {
  const { method = 'POST', auth = true, body } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    headers['Authorization'] = 'Bearer valid-jwt-token';
  }

  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /coach/videos/upload-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with { signedUrl, videoId, path } for a linked athlete', async () => {
    mockGetActiveCoachForAthlete.mockResolvedValue({
      coachId: 'coach-uuid-test',
      coachName: 'Coach Test',
    });

    const req = makeRequest('/upload-url', { auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('signedUrl');
    expect(json).toHaveProperty('videoId');
    expect(json).toHaveProperty('path');
    expect(json.path).toMatch(/^athlete-uuid-test\/.+\.mp4$/);
  });

  it('returns 403 NOT_LINKED for an athlete with no active coach link', async () => {
    mockGetActiveCoachForAthlete.mockResolvedValue(null);

    const req = makeRequest('/upload-url', { auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(403);
    expect(json.error).toBe('NOT_LINKED');
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const req = makeRequest('/upload-url', { auth: false });
    const res = await videosRouter.fetch(req);

    expect(res.status).toBe(401);
  });
});

describe('POST /coach/videos/:videoId/complete', () => {
  const videoId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 { ok: true } and calls notificationService.send with correct idempotencyKey', async () => {
    mockGetActiveCoachForAthlete.mockResolvedValue({
      coachId: 'coach-uuid-test',
      coachName: 'Coach Test',
    });
    mockInsertVideoRecord.mockResolvedValue(undefined);
    mockNotificationSend.mockResolvedValue({ sent: true });

    const req = makeRequest(`/${videoId}/complete`, {
      auth: true,
      body: { title: 'Squat 2026-05-26', duration_s: 45 },
    });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    expect(mockNotificationSend).toHaveBeenCalledOnce();
    const sendArg = mockNotificationSend.mock.calls[0][0];
    expect(sendArg.idempotencyKey).toBe(`video_uploaded_${videoId}`);
    expect(sendArg.recipientUserId).toBe('coach-uuid-test');
    expect(sendArg.category).toBe('coach');
    expect(sendArg.type).toBe('video_uploaded');
  });

  it('returns 400 when title is missing from the body', async () => {
    mockGetActiveCoachForAthlete.mockResolvedValue({
      coachId: 'coach-uuid-test',
      coachName: 'Coach Test',
    });

    const req = makeRequest(`/${videoId}/complete`, {
      auth: true,
      body: { duration_s: 45 }, // no title
    });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(400);
    expect(json.error).toContain('title');
  });
});
