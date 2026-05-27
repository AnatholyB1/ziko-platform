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
  getVideosForClient: vi.fn(),
  getVideoById: vi.fn(),
  getAnnotationsForVideo: vi.fn(),
  insertAnnotation: vi.fn(),
  updateAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  updateVideoStatus: vi.fn(),
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
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.supabase.co/read-signed-url' },
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
const mockGetVideosForClient = vi.mocked(dbModule.getVideosForClient);
const mockGetVideoById = vi.mocked(dbModule.getVideoById);
const mockGetAnnotationsForVideo = vi.mocked(dbModule.getAnnotationsForVideo);
const mockInsertAnnotation = vi.mocked(dbModule.insertAnnotation);
const mockUpdateAnnotation = vi.mocked(dbModule.updateAnnotation);
const mockDeleteAnnotation = vi.mocked(dbModule.deleteAnnotation);
const mockUpdateVideoStatus = vi.mocked(dbModule.updateVideoStatus);

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

// ── Phase 46: DB query function unit tests ────────────────────────────────────

describe('DB: getAnnotationsForVideo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rows sorted by timestamp_s ascending', async () => {
    const rows = [
      { id: 'ann-1', video_id: 'vid-1', coach_id: 'coach-uuid-test', timestamp_s: 5, content: 'A', created_at: '' },
      { id: 'ann-2', video_id: 'vid-1', coach_id: 'coach-uuid-test', timestamp_s: 2, content: 'B', created_at: '' },
    ];
    mockGetAnnotationsForVideo.mockResolvedValue(rows as any);

    const result = await dbModule.getAnnotationsForVideo('vid-1');
    expect(result).toEqual(rows);
    expect(mockGetAnnotationsForVideo).toHaveBeenCalledWith('vid-1');
  });
});

describe('DB: insertAnnotation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when DB returns an error', async () => {
    mockInsertAnnotation.mockRejectedValue(new Error('[coach/videos] insertAnnotation error: duplicate key'));

    await expect(
      dbModule.insertAnnotation({ id: 'ann-id', videoId: 'vid-id', coachId: 'coach-id', timestampS: 10, content: 'text' }),
    ).rejects.toThrow('[coach/videos]');
  });
});

describe('DB: updateAnnotation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is called with both annotId and coachId guards', async () => {
    mockUpdateAnnotation.mockResolvedValue(undefined);

    await dbModule.updateAnnotation('ann-id', 'coach-uuid-test', 'new text');

    expect(mockUpdateAnnotation).toHaveBeenCalledWith('ann-id', 'coach-uuid-test', 'new text');
  });
});

describe('DB: deleteAnnotation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is called with both annotId and coachId guards', async () => {
    mockDeleteAnnotation.mockResolvedValue(undefined);

    await dbModule.deleteAnnotation('ann-id', 'coach-uuid-test');

    expect(mockDeleteAnnotation).toHaveBeenCalledWith('ann-id', 'coach-uuid-test');
  });
});

describe('DB: getVideosForClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by both coachId and clientId', async () => {
    const rows = [
      { id: 'vid-1', title: 'Test', status: 'ready', created_at: '', duration_s: 30 },
    ];
    mockGetVideosForClient.mockResolvedValue(rows as any);

    const result = await dbModule.getVideosForClient('client-id', 'coach-uuid-test');
    expect(result).toEqual(rows);
    expect(mockGetVideosForClient).toHaveBeenCalledWith('client-id', 'coach-uuid-test');
  });
});

// ── Phase 46: Route handler tests ─────────────────────────────────────────────

const VIDEO_ID = 'video-uuid-1234';
const ANNOT_ID = 'annot-uuid-5678';
const COACH_ID = 'athlete-uuid-test'; // auth mock always sets userId to this

const BASE_VIDEO = {
  id: VIDEO_ID,
  athlete_id: 'athlete-uuid-test',
  coach_id: 'athlete-uuid-test', // same as auth userId so coach guards pass
  storage_path: 'athlete-uuid-test/video-uuid-1234.mp4',
  title: 'Squat Test',
  duration_s: 60,
  status: 'ready',
  created_at: '2026-05-27T00:00:00Z',
};

describe('GET /coach/clients/:clientId/videos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with video list for a valid coach', async () => {
    const videos = [BASE_VIDEO];
    mockGetVideosForClient.mockResolvedValue(videos as any);

    const req = makeRequest('/clients/client-abc/videos', { method: 'GET', auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    expect(json[0].id).toBe(VIDEO_ID);
  });

  it('returns 401 when no auth', async () => {
    const req = makeRequest('/clients/client-abc/videos', { method: 'GET', auth: false });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(401);
  });
});

describe('GET /coach/videos/:videoId/annotations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with annotations sorted asc for coach', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);
    const annotations = [
      { id: 'ann-1', video_id: VIDEO_ID, coach_id: COACH_ID, timestamp_s: 3, content: 'A', created_at: '' },
    ];
    mockGetAnnotationsForVideo.mockResolvedValue(annotations as any);

    const req = makeRequest(`/${VIDEO_ID}/annotations`, { method: 'GET', auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
  });

  it('returns 404 when video does not exist', async () => {
    mockGetVideoById.mockResolvedValue(null);

    const req = makeRequest(`/non-existent-vid/annotations`, { method: 'GET', auth: true });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is neither coach nor athlete', async () => {
    mockGetVideoById.mockResolvedValue({
      ...BASE_VIDEO,
      coach_id: 'other-coach-id',
      athlete_id: 'other-athlete-id',
    } as any);

    const req = makeRequest(`/${VIDEO_ID}/annotations`, { method: 'GET', auth: true });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(403);
  });
});

describe('POST /coach/videos/:videoId/annotations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with {id, timestamp_s, content} for valid body', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);
    mockInsertAnnotation.mockResolvedValue(undefined);

    const req = makeRequest(`/${VIDEO_ID}/annotations`, {
      method: 'POST',
      auth: true,
      body: { timestamp_s: 12.5, content: 'Good form' },
    });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(201);
    expect(json).toHaveProperty('id');
    expect(json.timestamp_s).toBe(12.5);
    expect(json.content).toBe('Good form');
  });

  it('returns 400 when content exceeds 2000 chars', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);

    const req = makeRequest(`/${VIDEO_ID}/annotations`, {
      method: 'POST',
      auth: true,
      body: { timestamp_s: 5, content: 'x'.repeat(2001) },
    });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(400);
    expect(json.error).toContain('content');
  });

  it('returns 400 when timestamp_s is negative', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);

    const req = makeRequest(`/${VIDEO_ID}/annotations`, {
      method: 'POST',
      auth: true,
      body: { timestamp_s: -1, content: 'some text' },
    });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(400);
    expect(json.error).toContain('timestamp_s');
  });

  it('returns 403 when caller is not the coach', async () => {
    mockGetVideoById.mockResolvedValue({
      ...BASE_VIDEO,
      coach_id: 'other-coach-id',
    } as any);

    const req = makeRequest(`/${VIDEO_ID}/annotations`, {
      method: 'POST',
      auth: true,
      body: { timestamp_s: 5, content: 'text' },
    });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /coach/videos/:videoId/annotations/:annotId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 {ok:true} for valid coach edit', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);
    mockUpdateAnnotation.mockResolvedValue(undefined);

    const req = makeRequest(`/${VIDEO_ID}/annotations/${ANNOT_ID}`, {
      method: 'PATCH',
      auth: true,
      body: { content: 'Updated text' },
    });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it('returns 400 when content exceeds 2000 chars', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);

    const req = makeRequest(`/${VIDEO_ID}/annotations/${ANNOT_ID}`, {
      method: 'PATCH',
      auth: true,
      body: { content: 'x'.repeat(2001) },
    });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when caller is not the coach', async () => {
    mockGetVideoById.mockResolvedValue({
      ...BASE_VIDEO,
      coach_id: 'other-coach-id',
    } as any);

    const req = makeRequest(`/${VIDEO_ID}/annotations/${ANNOT_ID}`, {
      method: 'PATCH',
      auth: true,
      body: { content: 'text' },
    });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /coach/videos/:videoId/annotations/:annotId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 {ok:true} for valid coach delete', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);
    mockDeleteAnnotation.mockResolvedValue(undefined);

    const req = makeRequest(`/${VIDEO_ID}/annotations/${ANNOT_ID}`, {
      method: 'DELETE',
      auth: true,
    });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});

describe('GET /coach/videos/:videoId/signed-url', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 {signedUrl} for coach', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);

    const req = makeRequest(`/${VIDEO_ID}/signed-url`, { method: 'GET', auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('signedUrl');
    // Must NOT expose storage_path (V6)
    expect(json).not.toHaveProperty('storage_path');
  });

  it('returns 403 (IDOR) when caller is neither coach nor athlete', async () => {
    mockGetVideoById.mockResolvedValue({
      ...BASE_VIDEO,
      coach_id: 'other-coach-id',
      athlete_id: 'other-athlete-id',
    } as any);

    const req = makeRequest(`/${VIDEO_ID}/signed-url`, { method: 'GET', auth: true });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(403);
  });
});

describe('POST /coach/videos/:videoId/send-feedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 {ok:true} and sends push when annotations exist', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);
    mockGetAnnotationsForVideo.mockResolvedValue([
      { id: 'ann-1', video_id: VIDEO_ID, coach_id: COACH_ID, timestamp_s: 5, content: 'A', created_at: '' },
    ] as any);
    mockUpdateVideoStatus.mockResolvedValue(undefined);
    mockNotificationSend.mockResolvedValue({ sent: true } as any);
    // Mock user_profiles query (for coach name) via supabase — not needed as notificationService is mocked

    const req = makeRequest(`/${VIDEO_ID}/send-feedback`, { method: 'POST', auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockUpdateVideoStatus).toHaveBeenCalled();
    expect(mockNotificationSend).toHaveBeenCalled();
  });

  it('returns 400 when no annotations exist', async () => {
    mockGetVideoById.mockResolvedValue(BASE_VIDEO as any);
    mockGetAnnotationsForVideo.mockResolvedValue([] as any);

    const req = makeRequest(`/${VIDEO_ID}/send-feedback`, { method: 'POST', auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(400);
    expect(json.error).toContain('annotation');
  });

  it('returns 400 when video status is already annotated (resend guard T-46-03)', async () => {
    mockGetVideoById.mockResolvedValue({ ...BASE_VIDEO, status: 'annotated' } as any);
    mockGetAnnotationsForVideo.mockResolvedValue([
      { id: 'ann-1', video_id: VIDEO_ID, coach_id: COACH_ID, timestamp_s: 5, content: 'A', created_at: '' },
    ] as any);

    const req = makeRequest(`/${VIDEO_ID}/send-feedback`, { method: 'POST', auth: true });
    const res = await videosRouter.fetch(req);
    const json = await res.json() as any;

    expect(res.status).toBe(400);
    expect(json.error).toContain('already');
  });

  it('returns 403 when caller is not the coach', async () => {
    mockGetVideoById.mockResolvedValue({
      ...BASE_VIDEO,
      coach_id: 'other-coach-id',
    } as any);

    const req = makeRequest(`/${VIDEO_ID}/send-feedback`, { method: 'POST', auth: true });
    const res = await videosRouter.fetch(req);
    expect(res.status).toBe(403);
  });
});
