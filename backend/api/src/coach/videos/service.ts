import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../../middleware/auth.js';
import {
  getActiveCoachForAthlete,
  insertVideoRecord,
  getVideosForClient,
  getVideoById,
  getAnnotationsForVideo,
  insertAnnotation,
  updateAnnotation,
  deleteAnnotation,
  updateVideoStatus,
} from './db.js';
import { notificationService } from '../../services/notificationService.js';
import type {
  UploadUrlResponse,
  CompleteVideoBody,
  CreateAnnotationBody,
  UpdateAnnotationBody,
} from './types.js';

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

// ── Phase 46: video list + annotation CRUD + signed-url + send-feedback ───────

/**
 * GET /coach/clients/:clientId/videos
 * Returns videos uploaded by the given client for the calling coach.
 * Coach ownership is enforced via getVideosForClient filter (coach_id = auth.userId).
 */
videosRouter.get('/clients/:clientId/videos', async (c) => {
  const { userId: coachId } = c.get('auth');
  const { clientId } = c.req.param();

  const videos = await getVideosForClient(clientId, coachId);
  return c.json(videos);
});

/**
 * GET /coach/videos/:videoId/annotations
 * Returns annotations sorted by timestamp_s ASC.
 * Accessible by coach AND linked athlete of this video (dual-role read, Risk 8).
 */
videosRouter.get('/:videoId/annotations', async (c) => {
  const { userId: callerId } = c.get('auth');
  const { videoId } = c.req.param();

  const video = await getVideoById(videoId);
  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }

  // Access guard: caller must be coach or athlete of this specific video (T-46-IDOR)
  if (callerId !== video.coach_id && callerId !== video.athlete_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const annotations = await getAnnotationsForVideo(videoId);
  return c.json(annotations);
});

/**
 * POST /coach/videos/:videoId/annotations
 * Creates a new text annotation. Coach-only write (T-46-01, T-46-02).
 * Validates: content <= 2000 chars (T-46-04), timestamp_s >= 0 (T-46-04).
 */
videosRouter.post('/:videoId/annotations', async (c) => {
  const { userId: coachId } = c.get('auth');
  const { videoId } = c.req.param();

  const video = await getVideoById(videoId);
  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }

  // T-46-01: coach-only write
  if (coachId !== video.coach_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  let body: CreateAnnotationBody;
  try {
    body = await c.req.json<CreateAnnotationBody>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // T-46-04: validate content length
  if (typeof body.content !== 'string' || body.content.length > 2000) {
    return c.json({ error: 'content too long (max 2000 chars)' }, 400);
  }

  // T-46-04: validate timestamp_s is a non-negative number
  if (typeof body.timestamp_s !== 'number' || body.timestamp_s < 0) {
    return c.json({ error: 'timestamp_s must be a non-negative number' }, 400);
  }

  const id = randomUUID();
  await insertAnnotation({
    id,
    videoId,
    coachId,
    timestampS: body.timestamp_s,
    content: body.content,
  });

  return c.json({ id, timestamp_s: body.timestamp_s, content: body.content }, 201);
});

/**
 * PATCH /coach/videos/:videoId/annotations/:annotId
 * Edits annotation text. Coach-only (T-46-01).
 * Validates: content <= 2000 chars (T-46-04).
 */
videosRouter.patch('/:videoId/annotations/:annotId', async (c) => {
  const { userId: coachId } = c.get('auth');
  const { videoId, annotId } = c.req.param();

  const video = await getVideoById(videoId);
  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }

  // T-46-01: coach-only write
  if (coachId !== video.coach_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  let body: UpdateAnnotationBody;
  try {
    body = await c.req.json<UpdateAnnotationBody>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // T-46-04: validate content length
  if (typeof body.content !== 'string' || body.content.length > 2000) {
    return c.json({ error: 'content too long (max 2000 chars)' }, 400);
  }

  await updateAnnotation(annotId, coachId, body.content);
  return c.json({ ok: true });
});

/**
 * DELETE /coach/videos/:videoId/annotations/:annotId
 * Removes an annotation. Coach-only (T-46-01).
 */
videosRouter.delete('/:videoId/annotations/:annotId', async (c) => {
  const { userId: coachId } = c.get('auth');
  const { videoId, annotId } = c.req.param();

  const video = await getVideoById(videoId);
  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }

  // T-46-01: coach-only write
  if (coachId !== video.coach_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await deleteAnnotation(annotId, coachId);
  return c.json({ ok: true });
});

/**
 * GET /coach/videos/:videoId/signed-url
 * Returns a 15-min read URL for playback. Accessible by coach OR athlete (T-46-IDOR).
 * Never exposes storage_path to the client (V6).
 */
videosRouter.get('/:videoId/signed-url', async (c) => {
  const { userId: callerId } = c.get('auth');
  const { videoId } = c.req.param();

  const video = await getVideoById(videoId);
  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }

  // T-46-IDOR: only coach or linked athlete may obtain a read URL
  if (callerId !== video.coach_id && callerId !== video.athlete_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Use createSignedUrl (read), not createSignedUploadUrl (write) — V6 / D-11
  const { data, error } = await supabaseAdmin.storage
    .from('coach-videos')
    .createSignedUrl(video.storage_path, 900); // 900s = 15 minutes

  if (error || !data) {
    console.error('[coach/videos] createSignedUrl error:', error);
    return c.json({ error: 'Failed to generate signed URL' }, 500);
  }

  // Return only signedUrl — never expose storage_path (V6)
  return c.json({ signedUrl: data.signedUrl });
});

/**
 * POST /coach/videos/:videoId/send-feedback
 * Updates video status → 'annotated' and sends a push notification to the athlete.
 * Coach-only. Guards:
 *   - At least one annotation must exist (else 400)
 *   - Status must not already be 'annotated' (T-46-03 — idempotency resend guard)
 */
videosRouter.post('/:videoId/send-feedback', async (c) => {
  const { userId: coachId } = c.get('auth');
  const { videoId } = c.req.param();

  const video = await getVideoById(videoId);
  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }

  // Coach-only write
  if (coachId !== video.coach_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Must have at least one annotation
  const annotations = await getAnnotationsForVideo(videoId);
  if (annotations.length === 0) {
    return c.json({ error: 'no annotations — add at least one before sending feedback' }, 400);
  }

  // T-46-03: idempotency resend guard — prevent duplicate push to athlete
  if (video.status === 'annotated') {
    return c.json({ error: 'feedback already sent for this video' }, 400);
  }

  // Update status → 'annotated'
  await updateVideoStatus(videoId, coachId, 'annotated');

  // Resolve coach display name for push body (D-08)
  let coachName = '';
  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('name')
      .eq('id', coachId)
      .maybeSingle();
    coachName = (profile?.name as string | null) ?? '';
  } catch {
    // Non-fatal: push body degrades gracefully without coach name
  }

  // D-08: push notification to athlete
  await notificationService.send({
    recipientUserId: video.athlete_id,
    category: 'coach',
    type: 'video_feedback',
    title: 'Retour vidéo disponible',
    body: `📹 ${coachName || 'Votre coach'} a analysé votre vidéo : ${video.title}`,
    data: { type: 'video_feedback', videoId },
    idempotencyKey: `video_annotated_${videoId}`,
  });

  return c.json({ ok: true });
});
