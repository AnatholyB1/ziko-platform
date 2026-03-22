import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

function admin() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const today = () => new Date().toISOString().split('T')[0];

// ── Tool: hydration_log ────────────────────────────────────
export async function hydration_log(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const { amount_ml } = params as { amount_ml: number };
  if (!amount_ml) throw new Error('amount_ml is required');

  const db = admin();
  const { data, error } = await db
    .from('hydration_logs')
    .insert({
      user_id: userId,
      amount_ml,
      date: today(),
    })
    .select('id, amount_ml, date')
    .single();

  if (error) throw new Error(error.message);

  // Get updated total for today
  const { data: todayLogs } = await db
    .from('hydration_logs')
    .select('amount_ml')
    .eq('user_id', userId)
    .eq('date', today());

  const totalToday = (todayLogs ?? []).reduce((s: number, l: any) => s + l.amount_ml, 0);

  return { success: true, entry: data, total_today_ml: totalToday };
}

// ── Tool: hydration_get_today ──────────────────────────────
export async function hydration_get_today(
  _params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = admin();

  const [logsRes, profileRes] = await Promise.all([
    db
      .from('hydration_logs')
      .select('id, amount_ml, created_at')
      .eq('user_id', userId)
      .eq('date', today())
      .order('created_at'),
    db.from('user_profiles').select('weight_kg').eq('id', userId).single(),
  ]);

  if (logsRes.error) throw new Error(logsRes.error.message);

  const logs = logsRes.data ?? [];
  const totalMl = logs.reduce((s: number, l: any) => s + l.amount_ml, 0);
  const weightKg = profileRes.data?.weight_kg ?? 75;
  const goalMl = Math.round(weightKg * 33); // ~33ml per kg

  return {
    date: today(),
    total_ml: totalMl,
    goal_ml: goalMl,
    percentage: Math.round((totalMl / goalMl) * 100),
    entries: logs,
  };
}

// ── Tool: hydration_set_goal ───────────────────────────────
export async function hydration_set_goal(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const { goal_ml } = params as { goal_ml: number };
  if (!goal_ml) throw new Error('goal_ml is required');

  // Store goal in user_plugins settings for the hydration plugin
  const db = admin();
  const { error } = await db
    .from('user_plugins')
    .update({ settings: { daily_goal_ml: goal_ml } })
    .eq('user_id', userId)
    .eq('plugin_id', 'hydration');

  if (error) throw new Error(error.message);
  return { success: true, daily_goal_ml: goal_ml };
}
