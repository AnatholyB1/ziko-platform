import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../../middleware/auth.js';
import { getActiveCoachForAthlete, insertVideoRecord } from './db.js';
import { notificationService } from '../../services/notificationService.js';
import type { UploadUrlResponse, CompleteVideoBody } from './types.js';

// Service-role client for storage signing (D-02).
// createSignedUploadUrl requires service role; publishable key lacks storage.admin.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const videosRouter = new Hono();
videosRouter.use('*', authMiddleware);

/**
 * POST /coach/videos/upload-url
 * Returns a signed PUT URL for direct upload to Supabase Storage.
 * Video bytes never pass through Hono (INFRA-03).
 *
 * Security (T-45-04, T-45-05):
 * - Requires active coach_client_links row with revoked_at IS NULL
 * - Path is scoped to athleteId/ prefix (path ownership guard)
 */
videosRouter.post('/upload-url', async (c) => {
  const { userId: athleteId } = c.get('auth');

  // T-45-05: reject athlete with no active coach link
  const coachResult = await getActiveCoachForAthlete(athleteId);
  if (!coachResult) {
    return c.json({ error: 'NOT_LINKED' }, 403);
  }

  const videoId = randomUUID();
  const path = `${athleteId}/${videoId}.mp4`;

  // T-45-04: validate path ownership (guards against future refactor regression)
  if (!path.startsWith(`${athleteId}/`)) {
    return c.json({ error: 'Invalid path' }, 403);
  }

  // D-03: 15 minutes target expiry.
  // Note: @supabase/storage-js createSignedUploadUrl options only support { upsert }.
  // The TTL is controlled server-side in the Supabase bucket config (set to 900s there).
  // This mirrors the existing pattern in backend/api/src/routes/storage.ts.
  const { data, error } = await supabaseAdmin.storage
    .from('coach-videos')
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[coach/videos] createSignedUploadUrl error:', error);
    return c.json({ error: 'Failed to generate upload URL' }, 500);
  }

  const response: UploadUrlResponse = {
    signedUrl: data.signedUrl,
    videoId,
    path,
  };

  return c.json(response);
});

/**
 * POST /coach/videos/:videoId/complete
 * Called by mobile after successful PUT to Supabase Storage.
 * Inserts DB row and sends push notification to the coach.
 *
 * Security (T-45-06, T-45-07):
 * - Re-verifies active link so stale links are rejected
 * - idempotencyKey prevents duplicate push notifications
 */
videosRouter.post('/:videoId/complete', async (c) => {
  const { userId: athleteId } = c.get('auth');
  const { videoId } = c.req.param();

  let body: CompleteVideoBody;
  try {
    body = await c.req.json<CompleteVideoBody>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // D-10: title is required (UI enforces, API validates)
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return c.json({ error: 'title is required' }, 400);
  }

  const title = body.title.trim();
  const durationS = typeof body.duration_s === 'number' ? body.duration_s : null;

  // T-45-07: re-verify active link (prevents stale-link spoofing)
  const coachResult = await getActiveCoachForAthlete(athleteId);
  if (!coachResult) {
    return c.json({ error: 'NOT_LINKED' }, 403);
  }

  const { coachId, coachName } = coachResult;
  const storagePath = `${athleteId}/${videoId}.mp4`;

  await insertVideoRecord({
    id: videoId,
    athleteId,
    coachId,
    storagePath,
    title,
    durationS,
  });

  // T-45-06: idempotencyKey prevents duplicate push notifications
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

  return c.json({ ok: true });
});
