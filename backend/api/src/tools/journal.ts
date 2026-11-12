import { clientForUser } from './db.js';

// Date calendaire du fuseau de l'app (Europe/Paris) et non UTC : evite le decalage pres de minuit.
const APP_TZ = 'Europe/Paris';
export const localDay = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = () => localDay();

const CONTEXTS = ['pre_workout', 'post_workout', 'morning', 'evening', 'general'];
export const normalizeContext = (c: unknown): string => (CONTEXTS.includes(c as string) ? (c as string) : 'general');

// ── Tool: journal_log_mood ─────────────────────────────────────────
export async function journal_log_mood(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const { mood, energy = 3, stress = 2, context = 'general', notes } = params as {
    mood: number;
    energy?: number;
    stress?: number;
    context?: string;
    notes?: string;
  };

  if (!mood) throw new Error('mood is required (1-5)');

  const db = clientForUser(userToken);
  const ctx = normalizeContext(context);
  const day = today();

  // Entree 'general' : 1 par jour (l'humeur de l'accueil), mise a jour sur place.
  if (ctx === 'general') {
    const { data: existing } = await db
      .from('ziko_journal_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('date', day)
      .eq('context', 'general')
      .order('created_at', { ascending: false })
      .limit(1);
    const row = (existing ?? [])[0] as { id: string } | undefined;
    if (row) {
      const { data: upd, error: updErr } = await db
        .from('ziko_journal_entries')
        .update({ mood, energy, stress, notes: notes ?? null })
        .eq('id', row.id)
        .eq('user_id', userId)
        .select('id, mood, energy, stress, context, date')
        .single();
      if (updErr) throw new Error(updErr.message);
      return { success: true, updated: true, entry: upd };
    }
  }

  const { data, error } = await db
    .from('ziko_journal_entries')
    .insert({
      user_id: userId,
      mood,
      energy,
      stress,
      context: ctx,
      notes: notes ?? null,
      date: day,
    })
    .select('id, mood, energy, stress, context, date')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, entry: data };
}

// ── Tool: journal_get_history ──────────────────────────────
export async function journal_get_history(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const days = (params.days as number) ?? 7;
  const db = clientForUser(userToken);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from('ziko_journal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', localDay(since))
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return { days, entries: data ?? [] };
}

// ── Tool: journal_get_trends ───────────────────────────────
export async function journal_get_trends(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const days = (params.days as number) ?? 30;
  const db = clientForUser(userToken);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from('ziko_journal_entries')
    .select('mood, energy, stress, context, date')
    .eq('user_id', userId)
    .gte('date', localDay(since))
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);

  const entries = data ?? [];
  if (entries.length === 0) return { days, message: 'No journal entries found' };

  const avg = (arr: number[]) =>
    parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));

  return {
    days,
    total_entries: entries.length,
    averages: {
      mood: avg(entries.map((e: any) => e.mood)),
      energy: avg(entries.map((e: any) => e.energy)),
      stress: avg(entries.map((e: any) => e.stress)),
    },
    daily: entries,
  };
}
