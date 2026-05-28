// ARCH-03: per-request JWT client — no admin keys (SUPABASE_PUBLISHABLE_KEY only)
import { createClient } from '@supabase/supabase-js';
import type {
  CoachExercise,
  CreateExerciseBody,
  UpdateExerciseBody,
} from './types.js';

export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}

// Admin client — used ONLY for coach-exercises signed URL generation.
// Service key bypasses RLS so the backend can generate signed URLs for
// cross-owner storage paths on behalf of the athlete (T-44-02-03).
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ----- GET /:id/media-url — generate signed URLs for athlete (EXLIB-06) -----
// Security:
//   - coach_id derived server-side from coach_exercises (T-44-02-02: no IDOR)
//   - coach-athlete relationship validated via coach_client_links (T-44-02-01)
//   - returns { video_url: null, photo_url: null } on any missing/invalid condition (D-13)
export async function getMediaUrls(
  exerciseId: string,
  athleteUserId: string,
): Promise<{ video_url: string | null; photo_url: string | null; gif_url: string | null }> {
  const adminDb = createAdminClient();

  // Step 1: Fetch the exercise row — coach_id derived server-side (IDOR prevention)
  const { data: exercise, error: exerciseErr } = await adminDb
    .from('coach_exercises')
    .select('coach_id, video_path, photo_path')
    .eq('id', exerciseId)
    .maybeSingle();

  if (exerciseErr) {
    console.warn('[coach/exercises] getMediaUrls exercise fetch error:', exerciseErr.message);
    return { video_url: null, photo_url: null, gif_url: null };
  }
  if (!exercise) {
    return { video_url: null, photo_url: null, gif_url: null };
  }

  // Step 2: Validate active coach-athlete relationship via coach_client_links
  const { data: link, error: linkErr } = await adminDb
    .from('coach_client_links')
    .select('id')
    .eq('coach_id', exercise.coach_id)
    .eq('client_id', athleteUserId)
    .is('revoked_at', null)
    .maybeSingle();

  if (linkErr) {
    console.warn('[coach/exercises] getMediaUrls link validation error:', linkErr.message);
    return { video_url: null, photo_url: null, gif_url: null };
  }
  if (!link) {
    return { video_url: null, photo_url: null, gif_url: null };
  }

  // Step 3: Generate signed URLs (3600s = 1 hour) for non-null paths
  let video_url: string | null = null;
  let photo_url: string | null = null;
  let gif_url: string | null = null;

  if (exercise.video_path) {
    const { data: videoSigned, error: videoErr } = await adminDb.storage
      .from('coach-exercises')
      .createSignedUrl(exercise.video_path, 3600);
    if (videoErr) {
      console.warn('[coach/exercises] getMediaUrls video sign error:', videoErr.message);
    } else {
      video_url = videoSigned?.signedUrl ?? null;
    }
  }

  if (exercise.photo_path) {
    const { data: photoSigned, error: photoErr } = await adminDb.storage
      .from('coach-exercises')
      .createSignedUrl(exercise.photo_path, 3600);
    if (photoErr) {
      console.warn('[coach/exercises] getMediaUrls photo sign error:', photoErr.message);
    } else {
      photo_url = photoSigned?.signedUrl ?? null;
    }
  }

  if ((exercise as any).gif_path) {
    const { data: gifSigned, error: gifErr } = await adminDb.storage
      .from('coach-exercises')
      .createSignedUrl((exercise as any).gif_path, 3600);
    if (gifErr) {
      console.warn('[coach/exercises] getMediaUrls gif sign error:', gifErr.message);
    } else {
      gif_url = gifSigned?.signedUrl ?? null;
    }
  }

  return { video_url, photo_url, gif_url };
}

// ----- GET / — list coach's custom exercises (RLS + explicit coach_id filter) -----
export async function listExercises(
  jwt: string,
  coachId: string,
): Promise<{ exercises: CoachExercise[] }> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_exercises')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return { exercises: data ?? [] };
}

// ----- POST / — create a new exercise -----
export async function createExercise(
  jwt: string,
  coachId: string,
  body: CreateExerciseBody,
): Promise<CoachExercise> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_exercises')
    .insert({
      coach_id: coachId,
      name: body.name,
      description: body.description ?? null,
      category: body.category,
      muscle_groups: body.muscle_groups ?? [],
      video_path: body.video_path ?? null,
      photo_path: body.photo_path ?? null,
      gif_path: body.gif_path ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ----- PATCH /:id — update only provided fields -----
export async function updateExercise(
  jwt: string,
  coachId: string,
  id: string,
  body: UpdateExerciseBody,
): Promise<CoachExercise | null> {
  const db = createUserClient(jwt);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;
  if (body.muscle_groups !== undefined) updates.muscle_groups = body.muscle_groups;
  if (body.video_path !== undefined) updates.video_path = body.video_path;
  if (body.photo_path !== undefined) updates.photo_path = body.photo_path;
  if (body.gif_path !== undefined) updates.gif_path = body.gif_path;

  const { data, error } = await db
    .from('coach_exercises')
    .update(updates)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

// ----- DELETE /:id — remove storage files then DB row -----
export async function deleteExercise(
  jwt: string,
  coachId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  const db = createUserClient(jwt);

  // Step 1: Fetch the row to get storage paths (IDOR guard: coach_id filter)
  const { data: row, error: fetchErr } = await db
    .from('coach_exercises')
    .select('video_path, photo_path, gif_path')
    .eq('id', id)
    .eq('coach_id', coachId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  // Step 2: If not found, return early
  if (!row) return { deleted: false };

  // Step 3: Delete storage files if paths exist (user JWT — RLS allows own-prefix DELETE)
  if (row.video_path) {
    await db.storage.from('coach-exercises').remove([row.video_path]);
  }
  if (row.photo_path) {
    await db.storage.from('coach-exercises').remove([row.photo_path]);
  }
  if ((row as any).gif_path) {
    await db.storage.from('coach-exercises').remove([(row as any).gif_path]);
  }

  // Step 4: Delete the DB row
  const { error: deleteErr } = await db
    .from('coach_exercises')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId);
  if (deleteErr) throw new Error(deleteErr.message);

  return { deleted: true };
}
