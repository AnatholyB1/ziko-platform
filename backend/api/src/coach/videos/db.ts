import { createClient } from '@supabase/supabase-js';
import type { VideoRow, AnnotationRow } from './types.js';

// Service client — uses SUPABASE_SERVICE_KEY for storage admin operations (D-02).
// createSignedUploadUrl requires service role; publishable key lacks storage.admin.
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Returns { coachId, coachName } for the active coach linked to the given athlete,
 * or null if no active link exists (missing, revoked, or expired).
 *
 * Security: revoked_at IS NULL guard prevents revoked links from yielding a coachId.
 * expires_at guard prevents expired links (Pitfall 8 from RESEARCH.md).
 */
export async function getActiveCoachForAthlete(
  athleteId: string,
): Promise<{ coachId: string; coachName: string } | null> {
  const db = createServiceClient();

  const now = new Date().toISOString();

  const { data: linkRow, error: linkErr } = await db
    .from('coach_client_links')
    .select('coach_id')
    .eq('client_id', athleteId)
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1)
    .maybeSingle();

  if (linkErr) {
    console.warn('[coach/videos] getActiveCoachForAthlete link query error:', linkErr.message);
    return null;
  }

  if (!linkRow) return null;

  const coachId = linkRow.coach_id as string;

  // Resolve coach name from user_profiles
  const { data: profile, error: profileErr } = await db
    .from('user_profiles')
    .select('name')
    .eq('id', coachId)
    .maybeSingle();

  if (profileErr) {
    console.warn('[coach/videos] getActiveCoachForAthlete profile query error:', profileErr.message);
  }

  return {
    coachId,
    coachName: (profile?.name as string | null) ?? '',
  };
}

/**
 * Inserts a new row into coach_client_videos with status='ready'.
 */
export async function insertVideoRecord(params: {
  id: string;
  athleteId: string;
  coachId: string;
  storagePath: string;
  title: string;
  durationS: number | null;
}): Promise<void> {
  const db = createServiceClient();
  const { id, athleteId, coachId, storagePath, title, durationS } = params;

  const { error } = await db.from('coach_client_videos').insert({
    id,
    athlete_id: athleteId,
    coach_id: coachId,
    storage_path: storagePath,
    title,
    duration_s: durationS,
    status: 'ready',
  });

  if (error) {
    throw new Error(`[coach/videos] insertVideoRecord error: ${error.message}`);
  }
}

// ── Phase 46: annotation + video read helpers ─────────────────────────────────

/**
 * Returns all videos for a client, filtered by both coach_id and athlete_id.
 * Ordered by created_at DESC (newest first).
 */
export async function getVideosForClient(
  clientId: string,
  coachId: string,
): Promise<VideoRow[]> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('coach_client_videos')
    .select('id, athlete_id, coach_id, storage_path, title, duration_s, status, created_at')
    .eq('coach_id', coachId)
    .eq('athlete_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`[coach/videos] getVideosForClient error: ${error.message}`);
  }

  return (data ?? []) as VideoRow[];
}

/**
 * Returns a single video row by ID, or null if not found.
 */
export async function getVideoById(videoId: string): Promise<VideoRow | null> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('coach_client_videos')
    .select('id, athlete_id, coach_id, storage_path, title, duration_s, status, created_at')
    .eq('id', videoId)
    .maybeSingle();

  if (error) {
    throw new Error(`[coach/videos] getVideoById error: ${error.message}`);
  }

  return (data as VideoRow | null) ?? null;
}

/**
 * Returns all annotations for a video, ordered by timestamp_s ASC.
 */
export async function getAnnotationsForVideo(videoId: string): Promise<AnnotationRow[]> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('coach_video_annotations')
    .select('id, video_id, coach_id, timestamp_s, content, type, audio_path, created_at')
    .eq('video_id', videoId)
    .order('timestamp_s', { ascending: true });

  if (error) {
    throw new Error(`[coach/videos] getAnnotationsForVideo error: ${error.message}`);
  }

  return (data ?? []) as AnnotationRow[];
}

/**
 * Inserts a new text annotation row.
 * Throws on DB error.
 */
export async function insertAnnotation(params: {
  id: string;
  videoId: string;
  coachId: string;
  timestampS: number;
  content: string;
}): Promise<void> {
  const db = createServiceClient();
  const { id, videoId, coachId, timestampS, content } = params;

  const { error } = await db.from('coach_video_annotations').insert({
    id,
    video_id: videoId,
    coach_id: coachId,
    timestamp_s: timestampS,
    type: 'text',
    content,
  });

  if (error) {
    throw new Error(`[coach/videos] insertAnnotation error: ${error.message}`);
  }
}

/**
 * Updates annotation content. Double-column guard (id + coach_id) prevents
 * cross-coach edits (T-46-01).
 */
export async function updateAnnotation(
  annotId: string,
  coachId: string,
  content: string,
): Promise<void> {
  const db = createServiceClient();

  const { error } = await db
    .from('coach_video_annotations')
    .update({ content })
    .eq('id', annotId)
    .eq('coach_id', coachId);

  if (error) {
    throw new Error(`[coach/videos] updateAnnotation error: ${error.message}`);
  }
}

/**
 * Deletes an annotation. Double-column guard (id + coach_id) prevents
 * cross-coach deletions (T-46-01).
 */
export async function deleteAnnotation(annotId: string, coachId: string): Promise<void> {
  const db = createServiceClient();

  const { error } = await db
    .from('coach_video_annotations')
    .delete()
    .eq('id', annotId)
    .eq('coach_id', coachId);

  if (error) {
    throw new Error(`[coach/videos] deleteAnnotation error: ${error.message}`);
  }
}

// ── Phase 47: voice annotation helpers ────────────────────────────────────────

/**
 * Returns a single annotation row by ID, or null if not found.
 * Selects type and audio_path so voice annotations carry their metadata.
 */
export async function getAnnotationById(annotationId: string): Promise<AnnotationRow | null> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('coach_video_annotations')
    .select('id, video_id, coach_id, timestamp_s, content, type, audio_path, created_at')
    .eq('id', annotationId)
    .maybeSingle();

  if (error) {
    throw new Error(`[coach/videos] getAnnotationById error: ${error.message}`);
  }

  return (data as AnnotationRow | null) ?? null;
}

/**
 * Inserts a new voice annotation row.
 * Sets type='voice' and stores the audio_path (storage path of the raw audio blob).
 * Throws on DB error.
 */
export async function insertVoiceAnnotation(params: {
  id: string;
  videoId: string;
  coachId: string;
  timestampS: number;
  content: string;
  audioPath: string;
}): Promise<void> {
  const db = createServiceClient();
  const { id, videoId, coachId, timestampS, content, audioPath } = params;

  const { error } = await db.from('coach_video_annotations').insert({
    id,
    video_id: videoId,
    coach_id: coachId,
    timestamp_s: timestampS,
    type: 'voice',
    content,
    audio_path: audioPath,
  });

  if (error) {
    throw new Error(`[coach/videos] insertVoiceAnnotation error: ${error.message}`);
  }
}

/**
 * Updates the status of a video. Double-column guard (id + coach_id) ensures
 * only the owning coach can change the status (T-46-03).
 */
export async function updateVideoStatus(
  videoId: string,
  coachId: string,
  status: 'uploading' | 'ready' | 'annotated',
): Promise<void> {
  const db = createServiceClient();

  const { error } = await db
    .from('coach_client_videos')
    .update({ status })
    .eq('id', videoId)
    .eq('coach_id', coachId);

  if (error) {
    throw new Error(`[coach/videos] updateVideoStatus error: ${error.message}`);
  }
}
