import { clientForUser } from './db.js';

// ── Tool: timer_get_presets ──────────────────────────────────────────
export async function timer_get_presets(
  _params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);

  const { data, error } = await db
    .from('ziko_timer_presets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // Also include default presets
  const defaults = [
    { name: 'Tabata Classic', type: 'tabata', work_sec: 20, rest_sec: 10, rounds: 8 },
    { name: 'HIIT 30/30', type: 'hiit', work_sec: 30, rest_sec: 30, rounds: 10 },
    { name: 'EMOM 10min', type: 'emom', work_sec: 60, rest_sec: 0, rounds: 10 },
  ];

  return {
    custom_presets: data ?? [],
    default_presets: defaults,
  };
}

// ── Tool: timer_create_preset ──────────────────────────────
export async function timer_create_preset(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const { name, type, work_seconds, rest_seconds = 0, rounds, warmup_seconds = 0, sets = 1, round_rest_seconds = 0 } = params as {
    name: string;
    type: string;
    work_seconds: number;
    rest_seconds?: number;
    rounds: number;
    warmup_seconds?: number;
    sets?: number;
    round_rest_seconds?: number;
  };

  if (!name) throw new Error('name is required');
  if (!type) throw new Error('type is required');
  if (!work_seconds) throw new Error('work_seconds is required');
  if (!rounds) throw new Error('rounds is required');
  if (warmup_seconds < 0 || round_rest_seconds < 0) throw new Error('warmup_seconds and round_rest_seconds must be >= 0');
  if (sets < 1 || rounds < 1) throw new Error('sets and rounds must be >= 1');

  const db = clientForUser(userToken);
  const { data, error } = await db
    .from('ziko_timer_presets')
    .insert({
      user_id: userId,
      name,
      type,
      work_sec: work_seconds,
      rest_sec: rest_seconds,
      rounds,
      warmup_sec: warmup_seconds,
      sets,
      round_rest_sec: round_rest_seconds,
    })
    .select('id, name, type, work_sec, rest_sec, rounds, warmup_sec, sets, round_rest_sec')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, preset: data };
}
