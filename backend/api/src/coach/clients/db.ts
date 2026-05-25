import { createClient } from '@supabase/supabase-js';
import type {
  RedeemPayload,
  CoachPreviewPayload,
  LinkRow,
  PeekRpcReturn,
  RedeemRpcReturn,
  ClientRosterRow,
  ClientTag,
  ClientNote,
  ClientSummary,
} from './types.js';

const COACH_PHOTO_BUCKET = 'coach-kyc';
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes per RESEARCH.md §Don't Hand-Roll

// Service client for storage signing — coach-kyc bucket restricts reads to owner,
// so signed URLs must be generated with the service key (server-side only).
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

async function signCoachPhoto(
  _db: ReturnType<typeof createUserClient>,
  bucketPath: string | null,
): Promise<string | null> {
  if (!bucketPath) return null;
  const { data, error } = await createServiceClient().storage
    .from(COACH_PHOTO_BUCKET)
    .createSignedUrl(bucketPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn('[coach/clients] failed to sign coach photo:', error?.message);
    return null;
  }
  return data.signedUrl;
}

// ----- GET /coach/clients/links/me ----------------------------------------
export async function getActiveLink(
  jwt: string,
  clientId: string,
): Promise<{
  link: LinkRow | null;
  preview: CoachPreviewPayload | null;
}> {
  const db = createUserClient(jwt);
  const { data: linkRow, error: linkErr } = await db
    .from('coach_client_links')
    .select(
      'id, coach_id, client_id, created_at',
    )
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkErr) throw new Error(linkErr.message);
  if (!linkRow) return { link: null, preview: null };

  // Fetch coach profile — readable by all authenticated users via migration 042 policy.
  const { data: cp, error: cpErr } = await db
    .from('coach_profiles')
    .select('display_name, bio, specialties, photo_url, kyc_status')
    .eq('user_id', linkRow.coach_id)
    .maybeSingle();

  if (cpErr) throw new Error(cpErr.message);

  const photoSignedUrl = await signCoachPhoto(db, cp?.photo_url ?? null);

  return {
    link: {
      id: linkRow.id,
      coach_id: linkRow.coach_id,
      client_id: linkRow.client_id,
      created_at: linkRow.created_at,
    },
    preview: cp
      ? {
          coach_id: linkRow.coach_id,
          display_name: cp.display_name,
          bio: cp.bio,
          specialties: cp.specialties,
          photo_signed_url: photoSignedUrl,
          kyc_status: cp.kyc_status as CoachPreviewPayload['kyc_status'],
        }
      : null,
  };
}

// ----- POST /coach/clients/links/preview ----------------------------------
export async function peekInvitation(
  jwt: string,
  payload: RedeemPayload,
): Promise<
  | { ok: true; error_code: null; preview: CoachPreviewPayload }
  | { ok: false; error_code: 'INVALID_OR_EXPIRED'; preview: null }
> {
  const db = createUserClient(jwt);
  const { data, error } = await db.rpc('peek_invitation', {
    code_input: payload.code,
  });
if (error) {
    console.warn('[coach/clients] peek_invitation rpc error:', error.message);
    return { ok: false, error_code: 'INVALID_OR_EXPIRED', preview: null };
  }
  const rpc = data as PeekRpcReturn;
  if (!rpc.ok) {
    // Collapse 6 DB error codes to single wire code; log original for ops (INVITE-07, T-25-01)
    console.warn('[coach/clients] peek_invitation collapsed:', rpc.error_code);
    return { ok: false, error_code: 'INVALID_OR_EXPIRED', preview: null };
  }
  const photoSignedUrl = await signCoachPhoto(db, rpc.preview.photo_url);
  return {
    ok: true,
    error_code: null,
    preview: {
      coach_id: rpc.preview.coach_id,
      display_name: rpc.preview.display_name,
      bio: rpc.preview.bio,
      specialties: rpc.preview.specialties,
      photo_signed_url: photoSignedUrl,
      kyc_status: rpc.preview.kyc_status as CoachPreviewPayload['kyc_status'],
    },
  };
}

// ----- POST /coach/clients/links/redeem -----------------------------------
export async function redeemInvitation(
  jwt: string,
  payload: RedeemPayload,
  _clientId: string,
): Promise<
  | { ok: true; error_code: null; link: LinkRow; preview: CoachPreviewPayload }
  | { ok: false; error_code: 'INVALID_OR_EXPIRED'; link: null; preview: null }
> {
  const db = createUserClient(jwt);
  const { data, error } = await db.rpc('redeem_invitation_code', {
    code_input: payload.code,
  });
  if (error) {
    console.warn(
      '[coach/clients] redeem_invitation_code rpc error:',
      error.message,
    );
    return {
      ok: false,
      error_code: 'INVALID_OR_EXPIRED',
      link: null,
      preview: null,
    };
  }
  const rpc = data as RedeemRpcReturn;
  if (!rpc.ok) {
    console.warn(
      '[coach/clients] redeem_invitation_code collapsed:',
      rpc.error_code,
    );
    return {
      ok: false,
      error_code: 'INVALID_OR_EXPIRED',
      link: null,
      preview: null,
    };
  }

  // Fetch the inserted link row + coach preview in one round-trip each.
  const { data: linkRow, error: linkErr } = await db
    .from('coach_client_links')
    .select('id, coach_id, client_id, created_at')
    .eq('id', rpc.link_id)
    .single();
  if (linkErr || !linkRow) {
    console.warn(
      '[coach/clients] redeem post-fetch link error:',
      linkErr?.message,
    );
    return {
      ok: false,
      error_code: 'INVALID_OR_EXPIRED',
      link: null,
      preview: null,
    };
  }

  const { data: cp } = await db
    .from('coach_profiles')
    .select('display_name, bio, specialties, photo_url, kyc_status')
    .eq('user_id', linkRow.coach_id)
    .maybeSingle();

  const photoSignedUrl = cp
    ? await signCoachPhoto(db, cp.photo_url ?? null)
    : null;
  return {
    ok: true,
    error_code: null,
    link: linkRow as LinkRow,
    preview: {
      coach_id: linkRow.coach_id,
      display_name: cp?.display_name ?? '',
      bio: cp?.bio ?? null,
      specialties: cp?.specialties ?? null,
      photo_signed_url: photoSignedUrl,
      kyc_status: (cp?.kyc_status ?? null) as CoachPreviewPayload['kyc_status'],
    },
  };
}

// ----- DELETE /coach/clients/links/:id ------------------------------------
export async function revokeLink(
  jwt: string,
  clientId: string,
  id: string,
): Promise<{ id: string; revoked_at: string | null }> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_client_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', clientId) // belt + suspenders; RLS enforces
    .is('revoked_at', null)
    .select('id, revoked_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { id, revoked_at: null };
}

// Unused-export guard for the helper (it's used internally only).
export { signCoachPhoto as _signCoachPhoto };

// ----- GET / — list all linked clients with signal flags (CLIENT-01, CLIENT-02) -----
export async function listCoachClients(
  jwt: string,
  coachId: string,
): Promise<ClientRosterRow[]> {
  const db = createUserClient(jwt);

  // Step 1: get all active client UUIDs for this coach
  const { data: links, error: linkErr } = await db
    .from('coach_client_links')
    .select('client_id')
    .eq('coach_id', coachId)
    .is('revoked_at', null);
  if (linkErr) throw new Error(linkErr.message);
  if (!links || links.length === 0) return [];

  const clientIds = links.map((l: any) => l.client_id as string);
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday start
  const weekStartIso = weekStart.toISOString();

  const rows: ClientRosterRow[] = [];

  for (const clientId of clientIds) {
    // Profile
    const { data: profile } = await db
      .from('user_profiles')
      .select('id, name, avatar_url')
      .eq('id', clientId)
      .maybeSingle();

    // Last active (latest workout session)
    const { data: lastSession } = await db
      .from('workout_sessions')
      .select('created_at')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Signal: missed sessions (no session in last 14 days)
    const { data: recentSessions } = await db
      .from('workout_sessions')
      .select('id')
      .eq('user_id', clientId)
      .gte('created_at', fourteenDaysAgo)
      .limit(1);

    // Signal: stale measurements (no body_measurements in last 28 days)
    const { data: recentMeasurements } = await db
      .from('body_measurements')
      .select('id')
      .eq('user_id', clientId)
      .gte('created_at', twentyEightDaysAgo)
      .limit(1);

    // Signal: mood declining (last-3 avg < prev-3 avg)
    const { data: moodEntries } = await db
      .from('journal_entries')
      .select('mood')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(6);

    let signalMood = false;
    if (moodEntries && moodEntries.length >= 6) {
      const last3 = moodEntries.slice(0, 3).map((e: any) => Number(e.mood));
      const prev3 = moodEntries.slice(3, 6).map((e: any) => Number(e.mood));
      const last3Avg = last3.reduce((a, b) => a + b, 0) / 3;
      const prev3Avg = prev3.reduce((a, b) => a + b, 0) / 3;
      signalMood = last3Avg < prev3Avg;
    }

    // Sessions this week
    const { data: thisWeekSessions } = await db
      .from('workout_sessions')
      .select('id')
      .eq('user_id', clientId)
      .gte('created_at', weekStartIso);

    // Habits % (7d avg)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0];
    const { data: habits } = await db
      .from('habits')
      .select('id')
      .eq('user_id', clientId);
    const { data: habitLogs } = await db
      .from('habit_logs')
      .select('date, value')
      .eq('user_id', clientId)
      .gte('date', sevenDaysAgoDate);

    let habitsPct: number | null = null;
    if (habits && habits.length > 0 && habitLogs) {
      const totalPossible = habits.length * 7;
      const completed = habitLogs.filter((l: any) => l.value > 0).length;
      habitsPct = Math.round((completed / totalPossible) * 100);
    }

    rows.push({
      id: clientId,
      name: profile?.name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      last_active: lastSession?.created_at ?? null,
      signal_missed: !recentSessions || recentSessions.length === 0,
      signal_stale: !recentMeasurements || recentMeasurements.length === 0,
      signal_mood: signalMood,
      sessions_this_week: thisWeekSessions?.length ?? 0,
      habits_pct: habitsPct,
    });
  }

  return rows;
}

// ----- Tags CRUD (CLIENT-05) -----
export async function listClientTags(jwt: string, coachId: string, clientId: string): Promise<ClientTag[]> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_client_tags')
    .select('id, coach_id, client_id, tag, created_at')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientTag[];
}

export async function createClientTag(
  jwt: string,
  coachId: string,
  clientId: string,
  tag: string,
): Promise<ClientTag> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_client_tags')
    .insert({ coach_id: coachId, client_id: clientId, tag: tag.trim() })
    .select('id, coach_id, client_id, tag, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as ClientTag;
}

export async function deleteClientTag(
  jwt: string,
  coachId: string,
  tagId: string,
): Promise<void> {
  const db = createUserClient(jwt);
  const { error } = await db
    .from('coach_client_tags')
    .delete()
    .eq('id', tagId)
    .eq('coach_id', coachId); // belt + suspenders; RLS also enforces
  if (error) throw new Error(error.message);
}

// ----- Notes CRUD (CLIENT-06) -----
export async function getClientNote(
  jwt: string,
  coachId: string,
  clientId: string,
): Promise<ClientNote | null> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_client_notes')
    .select('id, coach_id, client_id, content, updated_at')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ClientNote) ?? null;
}

export async function upsertClientNote(
  jwt: string,
  coachId: string,
  clientId: string,
  content: string,
): Promise<ClientNote> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_client_notes')
    .upsert(
      { coach_id: coachId, client_id: clientId, content, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,client_id' },
    )
    .select('id, coach_id, client_id, content, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as ClientNote;
}

// ----- Coach-side revoke (CLIENT-08, D-20) -----
// DIFFERENT from the Phase 25 athlete-revoke revokeLink(). This one checks coach_id = coachId.
export async function revokeClientLinkByCoach(
  jwt: string,
  coachId: string,
  clientId: string,
): Promise<{ revoked_at: string }> {
  const db = createUserClient(jwt);
  const revokedAt = new Date().toISOString();
  const { error } = await db
    .from('coach_client_links')
    .update({ revoked_at: revokedAt })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .is('revoked_at', null);
  if (error) throw new Error(error.message);
  return { revoked_at: revokedAt };
}

// ----- GET /:id/summary — executive summary aggregates (CLIENT-04) -----
export async function getClientSummary(
  jwt: string,
  coachId: string,
  clientId: string,
): Promise<ClientSummary> {
  const db = createUserClient(jwt);
  const now = new Date();

  // Sessions this week
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday start
  const { data: weekSessions } = await db
    .from('workout_sessions')
    .select('id')
    .eq('user_id', clientId)
    .gte('created_at', weekStart.toISOString());

  // Last workout
  const { data: lastSession } = await db
    .from('workout_sessions')
    .select('created_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Latest weight
  const { data: latestMeasurement } = await db
    .from('body_measurements')
    .select('weight_kg, created_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Habits % (7d avg)
  const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const { data: habits } = await db
    .from('habits').select('id').eq('user_id', clientId);
  const { data: habitLogs } = await db
    .from('habit_logs').select('date, value')
    .eq('user_id', clientId).gte('date', sevenDaysAgoDate);
  let habitsPct: number | null = null;
  if (habits && habits.length > 0 && habitLogs) {
    const totalPossible = habits.length * 7;
    const completed = habitLogs.filter((l: any) => l.value > 0).length;
    habitsPct = Math.round((completed / totalPossible) * 100);
  }

  // Mood trend: last 7d avg vs prev 7d avg (D-10)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: moodRows } = await db
    .from('journal_entries')
    .select('mood, created_at')
    .eq('user_id', clientId)
    .gte('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false });

  let moodDelta: number | null = null;
  let moodCurrAvg: number | null = null;
  let moodPrevAvg: number | null = null;

  if (moodRows && moodRows.length >= 6) {
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const curr = moodRows.filter((r: any) => r.created_at >= cutoff).map((r: any) => Number(r.mood));
    const prev = moodRows.filter((r: any) => r.created_at < cutoff).map((r: any) => Number(r.mood));
    if (curr.length >= 3 && prev.length >= 3) {
      moodCurrAvg = Math.round((curr.reduce((a: number, b: number) => a + b, 0) / curr.length) * 10) / 10;
      moodPrevAvg = Math.round((prev.reduce((a: number, b: number) => a + b, 0) / prev.length) * 10) / 10;
      moodDelta = Math.round((moodCurrAvg - moodPrevAvg) * 10) / 10;
    }
  }

  // suppress unused coachId (defense-in-depth: RLS already filters via JWT)
  void coachId;

  return {
    sessions_this_week: weekSessions?.length ?? 0,
    habits_pct: habitsPct,
    last_workout_at: lastSession?.created_at ?? null,
    latest_weight_kg: latestMeasurement?.weight_kg ?? null,
    mood_delta: moodDelta,
    mood_prev_avg: moodPrevAvg,
    mood_curr_avg: moodCurrAvg,
  };
}

// ----- Tab data queries (CLIENT-03) — one function per tab -----
// All use is_coach_of RLS auto-applied via the coach's JWT.
// Each returns last `limit` rows DESC. Coach passes clientId from URL params.

export async function getClientSessions(jwt: string, clientId: string, limit = 30) {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('workout_sessions')
    .select('id, name, created_at, started_at, ended_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientMeasurements(jwt: string, clientId: string, limit = 30) {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('body_measurements')
    .select('id, weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, hip_cm, created_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientHabits(jwt: string, clientId: string) {
  const db = createUserClient(jwt);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [{ data: habits, error: hErr }, { data: logs, error: lErr }] = await Promise.all([
    db.from('habits').select('id, name, type, target, emoji, color').eq('user_id', clientId).limit(30),
    db.from('habit_logs').select('habit_id, date, value').eq('user_id', clientId).gte('date', thirtyDaysAgo).limit(30),
  ]);
  if (hErr) throw new Error(hErr.message);
  if (lErr) throw new Error(lErr.message);
  return { habits: habits ?? [], logs: logs ?? [] };
}

export async function getClientNutrition(jwt: string, clientId: string, limit = 30) {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('nutrition_logs')
    .select('id, meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_g, date')
    .eq('user_id', clientId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientSleep(jwt: string, clientId: string, limit = 30) {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('sleep_logs')
    .select('id, bedtime, wake_time, duration_hours, quality, date')
    .eq('user_id', clientId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientCardio(jwt: string, clientId: string, limit = 30) {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('cardio_sessions')
    .select('id, activity_type, duration_min, distance_km, calories_burned, avg_pace_sec_per_km, created_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientJournal(jwt: string, clientId: string, limit = 30) {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('journal_entries')
    .select('id, mood, energy, stress, context, notes, created_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ----- GET /compare — multi-client comparison data (CLIENT-07, D-17) -----
// Returns: { clientId: [ { date: string, value: number } ][] }
// Metric: 'weight' | 'sessions' | 'sleep' | 'mood'
// Days: 30 | 90 | 365
export async function listCompareData(
  jwt: string,
  coachId: string,
  clientIds: string[],
  metric: 'weight' | 'sessions' | 'sleep' | 'mood',
  days: 30 | 90 | 365 = 30,
): Promise<Record<string, Array<{ date: string; value: number }>>> {
  if (!clientIds.length) return {};
  const db = createUserClient(jwt);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Validate that the calling coach is linked to all requested clients (D-15 defense-in-depth)
  const { data: links } = await db
    .from('coach_client_links')
    .select('client_id')
    .eq('coach_id', coachId)
    .is('revoked_at', null)
    .in('client_id', clientIds);
  const linkedIds = new Set((links ?? []).map((l: any) => l.client_id as string));
  const validClientIds = clientIds.filter(id => linkedIds.has(id));
  if (!validClientIds.length) return {};

  const result: Record<string, Array<{ date: string; value: number }>> = {};

  for (const clientId of validClientIds) {
    if (metric === 'weight') {
      const { data } = await db
        .from('body_measurements')
        .select('created_at, weight_kg')
        .eq('user_id', clientId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      result[clientId] = (data ?? []).map((r: any) => ({ date: r.created_at.split('T')[0], value: r.weight_kg }));
    } else if (metric === 'sessions') {
      const { data } = await db
        .from('workout_sessions')
        .select('created_at')
        .eq('user_id', clientId)
        .gte('created_at', since);
      // Aggregate by week (Sunday start)
      const weekMap: Record<string, number> = {};
      for (const s of (data ?? [])) {
        const d = new Date(s.created_at);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay()); // week start Sunday
        const key = d.toISOString().split('T')[0];
        weekMap[key] = (weekMap[key] ?? 0) + 1;
      }
      result[clientId] = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));
    } else if (metric === 'sleep') {
      const { data } = await db
        .from('sleep_logs')
        .select('date, duration_hours')
        .eq('user_id', clientId)
        .gte('date', since.split('T')[0])
        .order('date', { ascending: true });
      result[clientId] = (data ?? []).map((r: any) => ({ date: r.date, value: r.duration_hours }));
    } else if (metric === 'mood') {
      const { data } = await db
        .from('journal_entries')
        .select('created_at, mood')
        .eq('user_id', clientId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      result[clientId] = (data ?? []).map((r: any) => ({ date: r.created_at.split('T')[0], value: r.mood }));
    }
  }

  return result;
}

// ----- GET /:id/programs — programs assigned to a client by this coach (PROG-06) -----
export async function getProgramsForClient(
  jwt: string,
  coachId: string,
  clientId: string,
): Promise<{ active: any | null; history: any[] }> {
  const db = createUserClient(jwt);

  const { data: programs, error } = await db
    .from('workout_programs')
    .select('id, name, description, goal, weeks_count, is_template, created_by_coach_id, assigned_to_user_id, template_source_id, start_date, weeks_data')
    .eq('assigned_to_user_id', clientId)
    .order('start_date', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);
  if (!programs || programs.length === 0) return { active: null, history: [] };

  // Compute week_number_current for the ISO week (Monday 00:00 UTC)
  const now = Date.now();
  const enriched: any[] = [];

  for (let i = 0; i < programs.length; i++) {
    const prog = programs[i] as any;
    let weekNumberCurrent: number | null = null;

    if (prog.start_date) {
      const raw = Math.floor((now - new Date(prog.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      weekNumberCurrent = Math.min(raw, prog.weeks_count as number);
    }

    // compliance_pct: only compute for the first (most recent / active) program
    let compliancePct: number | null = null;
    if (i === 0 && weekNumberCurrent !== null && prog.weeks_data) {
      // Monday 00:00 UTC of the current ISO week
      const nowDate = new Date();
      const dayOfWeek = nowDate.getUTCDay(); // 0=Sun, 1=Mon, …
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mondayMs = Date.UTC(
        nowDate.getUTCFullYear(),
        nowDate.getUTCMonth(),
        nowDate.getUTCDate() - daysToMonday,
      );
      const mondayIso = new Date(mondayMs).toISOString();

      // Count workout_sessions that reference this program and were logged this week
      const { count: doneCount } = await db
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('source_program_id', prog.id)
        .gte('created_at', mondayIso);

      // Denominator: number of sessions planned in weeks_data for weekNumberCurrent
      let denominator = 0;
      try {
        const weeksData: any[] = Array.isArray(prog.weeks_data) ? prog.weeks_data : JSON.parse(prog.weeks_data);
        const weekEntry = weeksData.find((w: any) => w.week_number === weekNumberCurrent);
        if (weekEntry && Array.isArray(weekEntry.sessions)) {
          denominator = weekEntry.sessions.length;
        }
      } catch {
        // weeks_data parse error — leave denominator 0
      }

      const done = doneCount ?? 0;
      compliancePct = denominator > 0 ? Math.round((done / denominator) * 100) : null;
    }

    enriched.push({
      ...prog,
      week_number_current: weekNumberCurrent,
      compliance_pct: i === 0 ? compliancePct : null,
    });
  }

  return { programs: enriched };
}

// ----- PUT /:clientId/shared-note — update shared note on the coach↔client link (PROG-07, PROG-09) -----
// IDOR guard: WHERE coach_id=coachId AND status='active' ensures coach can only update their own active link.
export async function upsertSharedNote(
  jwt: string,
  coachId: string,
  clientId: string,
  note: string,
): Promise<{ updated: true }> {
  const db = createUserClient(jwt);

  const { data, error } = await db
    .from('coach_client_links')
    .update({ shared_note: note })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('No active coach_client_links row found for this coach-client pair (IDOR guard)');
  }

  return { updated: true };
}
