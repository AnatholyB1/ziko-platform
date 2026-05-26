import { createClient } from '@supabase/supabase-js';

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
