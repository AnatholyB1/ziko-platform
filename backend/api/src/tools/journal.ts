import { clientForUser } from './db.js';

const today = () => new Date().toISOString().split('T')[0];

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
  const { data, error } = await db
    .from('journal_entries')
    .insert({
      user_id: userId,
      mood,
      energy,
      stress,
      context,
      notes: notes ?? null,
      date: today(),
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
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().split('T')[0])
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
    .from('journal_entries')
    .select('mood, energy, stress, context, date')
    .eq('user_id', userId)
    .gte('date', since.toISOString().split('T')[0])
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
