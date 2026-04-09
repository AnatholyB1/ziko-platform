import { clientForUser } from './db.js';
import { earnCredits } from '../services/creditService.js';

const today = () => new Date().toISOString().split('T')[0];

// ── Tool: measurements_log ─────────────────────────────────────
export async function measurements_log(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const { weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, thigh_cm, hip_cm } = params as {
    weight_kg?: number;
    body_fat_pct?: number;
    waist_cm?: number;
    chest_cm?: number;
    arm_cm?: number;
    thigh_cm?: number;
    hip_cm?: number;
  };

  // At least one measurement required
  if (!weight_kg && !body_fat_pct && !waist_cm && !chest_cm && !arm_cm && !thigh_cm && !hip_cm) {
    throw new Error('At least one measurement is required');
  }

  const db = clientForUser(userToken);
  const entry: Record<string, unknown> = {
    user_id: userId,
    date: today(),
  };
  if (weight_kg != null) entry.weight_kg = weight_kg;
  if (body_fat_pct != null) entry.body_fat_pct = body_fat_pct;
  if (waist_cm != null) entry.waist_cm = waist_cm;
  if (chest_cm != null) entry.chest_cm = chest_cm;
  if (arm_cm != null) entry.arm_cm = arm_cm;
  if (thigh_cm != null) entry.thigh_cm = thigh_cm;
  if (hip_cm != null) entry.hip_cm = hip_cm;

  const { data, error } = await db
    .from('body_measurements')
    .insert(entry)
    .select('id, date, weight_kg, body_fat_pct')
    .single();

  if (error) throw new Error(error.message);

  // Fire-and-forget earn (D-03): measurement.id is the idempotency key
  earnCredits(userId, 'measurement', (data as any).id).catch(() => {});

  return { success: true, measurement: data };
}

// ── Tool: measurements_get_history ─────────────────────────
export async function measurements_get_history(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const days = (params.days as number) ?? 30;
  const db = clientForUser(userToken);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return { days, entries: data ?? [] };
}

// ── Tool: measurements_get_progress ────────────────────────
export async function measurements_get_progress(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const compareDays = (params.compare_days as number) ?? 30;
  const db = clientForUser(userToken);

  // Get latest measurement
  const { data: latest } = await db
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  // Get measurement from ~N days ago
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - compareDays);
  const { data: pastEntries } = await db
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .lte('date', pastDate.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(1);

  const past = pastEntries && pastEntries.length > 0 ? pastEntries[0] : null;

  if (!latest) return { message: 'No measurements found' };

  const diff = (curr: number | null, prev: number | null) => {
    if (curr == null || prev == null) return null;
    return parseFloat((curr - prev).toFixed(1));
  };

  return {
    current: latest,
    compare_date: past?.date ?? null,
    changes: past
      ? {
          weight_kg: diff(latest.weight_kg, past.weight_kg),
          body_fat_pct: diff(latest.body_fat_pct, past.body_fat_pct),
          waist_cm: diff(latest.waist_cm, past.waist_cm),
          chest_cm: diff(latest.chest_cm, past.chest_cm),
          arm_cm: diff(latest.arm_cm, past.arm_cm),
          thigh_cm: diff(latest.thigh_cm, past.thigh_cm),
          hip_cm: diff(latest.hip_cm, past.hip_cm),
        }
      : null,
  };
}
