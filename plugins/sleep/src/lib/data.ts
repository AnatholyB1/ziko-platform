/**
 * Acces base du sommeil (client Supabase injecte). Partage entre l'ecran Sommeil et la carte d'accueil
 * pour garantir le meme chiffre (SLP-06). Dates = jour du reveil, en date locale de l'appareil.
 */
import {
  parseSettings,
  resolveNight,
  settingsToJson,
  EMPTY_SETTINGS,
  type HealthNight,
  type ManualNight,
  type ResolvedNight,
  type SleepSettings,
} from './sleep';

const HEALTH_COLS =
  'date, sleep_hours, sleep_bedtime, sleep_wake_time, sleep_deep_min, sleep_light_min, sleep_rem_min, sleep_awake_min';
const MANUAL_COLS = 'date, bedtime, wake_time, duration_hours, quality, awakenings, notes';

export async function fetchSleepSettings(supabase: any, userId: string): Promise<SleepSettings> {
  const { data, error } = await supabase
    .from('ziko_user_plugins')
    .select('settings')
    .eq('user_id', userId)
    .eq('plugin_id', 'sleep')
    .maybeSingle();
  if (error) throw error;
  return data ? parseSettings(data.settings) : EMPTY_SETTINGS;
}

/** Fusionne dans `settings` sans ecraser les autres cles du plugin. */
export async function saveSleepSettings(supabase: any, userId: string, next: SleepSettings): Promise<void> {
  const { data } = await supabase
    .from('ziko_user_plugins')
    .select('settings')
    .eq('user_id', userId)
    .eq('plugin_id', 'sleep')
    .maybeSingle();
  const merged = { ...((data?.settings as Record<string, unknown>) ?? {}), ...settingsToJson(next) };
  const { error } = await supabase
    .from('ziko_user_plugins')
    .upsert({ user_id: userId, plugin_id: 'sleep', settings: merged }, { onConflict: 'user_id,plugin_id' });
  if (error) throw error;
}

export async function fetchManualNight(supabase: any, userId: string, date: string): Promise<ManualNight | null> {
  const { data, error } = await supabase
    .from('ziko_sleep_logs')
    .select(MANUAL_COLS)
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchHealthNight(supabase: any, userId: string, date: string): Promise<HealthNight | null> {
  const { data, error } = await supabase
    .from('ziko_wearable_daily_summary')
    .select(HEALTH_COLS)
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Nuit affichee pour `date` (source connectee prioritaire sauf reglage 'manual'). */
export async function fetchSleepNight(
  supabase: any,
  userId: string,
  date: string,
  settings?: SleepSettings,
): Promise<ResolvedNight | null> {
  const [manual, health, s] = await Promise.all([
    fetchManualNight(supabase, userId, date),
    fetchHealthNight(supabase, userId, date),
    settings ? Promise.resolve(settings) : fetchSleepSettings(supabase, userId),
  ]);
  return resolveNight(manual, health, s.source);
}

/** Derniere nuit connue (la plus recente, saisie ou source). Utilisee par l'ecran "Cette nuit". */
export async function fetchLatestNight(
  supabase: any,
  userId: string,
  settings?: SleepSettings,
): Promise<ResolvedNight | null> {
  const [m, h] = await Promise.all([
    supabase.from('ziko_sleep_logs').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from('ziko_wearable_daily_summary')
      .select('date')
      .eq('user_id', userId)
      .not('sleep_hours', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (m.error) throw m.error;
  const dates = [m.data?.date, h.data?.date].filter(Boolean) as string[];
  if (!dates.length) return null;
  dates.sort();
  return fetchSleepNight(supabase, userId, dates[dates.length - 1], settings);
}

/** Durees (h) par date sur [from, to] : resolution identique a fetchSleepNight pour chaque jour. */
export async function fetchWeekDurations(
  supabase: any,
  userId: string,
  from: string,
  to: string,
  settings: SleepSettings,
): Promise<Record<string, number>> {
  const [m, h] = await Promise.all([
    supabase.from('ziko_sleep_logs').select(MANUAL_COLS).eq('user_id', userId).gte('date', from).lte('date', to),
    supabase.from('ziko_wearable_daily_summary').select(HEALTH_COLS).eq('user_id', userId).gte('date', from).lte('date', to),
  ]);
  if (m.error) throw m.error;
  if (h.error) throw h.error;
  const out: Record<string, number> = {};
  const dates = new Set<string>([...(m.data ?? []).map((r: any) => r.date), ...(h.data ?? []).map((r: any) => r.date)]);
  for (const d of dates) {
    const r = resolveNight(
      (m.data ?? []).find((x: any) => x.date === d) ?? null,
      (h.data ?? []).find((x: any) => x.date === d) ?? null,
      settings.source,
    );
    if (r) out[d] = r.durationH;
  }
  return out;
}

export interface SaveNightInput {
  date: string;
  bedtime: string;
  wake_time: string;
  duration_hours: number;
  quality: number;
  awakenings: number;
}

/** Upsert sur (user_id, date) : re-saisir une nuit la modifie, jamais de doublon (D-08). */
export async function saveManualNight(supabase: any, userId: string, input: SaveNightInput): Promise<void> {
  const { error } = await supabase.from('ziko_sleep_logs').upsert(
    { user_id: userId, ...input, source: 'manual' },
    { onConflict: 'user_id,date' },
  );
  if (error) throw error;
}
