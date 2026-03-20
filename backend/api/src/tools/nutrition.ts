import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

function admin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const today = () => new Date().toISOString().split('T')[0];

// ── Tool: nutrition_get_today ──────────────────────────────
export async function nutrition_get_today(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = admin();
  const date = (params.date as string | undefined) ?? today();

  const { data, error } = await db
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at');

  if (error) throw new Error(error.message);

  const logs = data ?? [];
  const totals = logs.reduce(
    (acc: any, l: any) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein_g: acc.protein_g + (l.protein_g ?? 0),
      carbs_g: acc.carbs_g + (l.carbs_g ?? 0),
      fat_g: acc.fat_g + (l.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return { date, entries: logs, totals };
}

// ── Tool: nutrition_log_meal ───────────────────────────────
export async function nutrition_log_meal(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const { meal_type, food_name, calories, protein_g = 0, carbs_g = 0, fat_g = 0, serving_g } =
    params as any;

  if (!food_name) throw new Error('food_name is required');
  if (calories == null) throw new Error('calories is required');
  if (!meal_type) throw new Error('meal_type is required (breakfast|lunch|dinner|snack)');

  const db = admin();
  const { data, error } = await db
    .from('nutrition_logs')
    .insert({
      user_id: userId,
      date: today(),
      meal_type,
      food_name,
      calories: Math.round(calories),
      protein_g: Math.round(protein_g),
      carbs_g: Math.round(carbs_g),
      fat_g: Math.round(fat_g),
      serving_g: serving_g ?? null,
    })
    .select('id, food_name, calories')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, entry: data };
}

// ── Tool: nutrition_get_summary ────────────────────────────
export async function nutrition_get_summary(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = admin();
  const date = (params.date as string | undefined) ?? today();

  // Get logs + user profile for goals
  const [logsRes, profileRes] = await Promise.all([
    db.from('nutrition_logs').select('calories,protein_g,carbs_g,fat_g').eq('user_id', userId).eq('date', date),
    db.from('user_profiles').select('weight_kg,height_cm,goal').eq('id', userId).single(),
  ]);

  const logs = logsRes.data ?? [];
  const profile = profileRes.data as any;

  const actual = logs.reduce(
    (acc: any, l: any) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein_g: acc.protein_g + (l.protein_g ?? 0),
      carbs_g: acc.carbs_g + (l.carbs_g ?? 0),
      fat_g: acc.fat_g + (l.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  // Simple goal estimate from profile
  const weightKg = profile?.weight_kg ?? 75;
  const goal = profile?.goal ?? 'maintenance';
  const calorieGoal =
    goal === 'fat_loss' ? Math.round(weightKg * 28) :
    goal === 'muscle_gain' ? Math.round(weightKg * 38) :
    Math.round(weightKg * 33);
  const proteinGoal = goal === 'muscle_gain'
    ? Math.round(weightKg * 2.2)
    : Math.round(weightKg * 1.8);

  return {
    date,
    actual,
    goals: { calories: calorieGoal, protein_g: proteinGoal },
    remaining: {
      calories: calorieGoal - actual.calories,
      protein_g: proteinGoal - actual.protein_g,
    },
  };
}

// ── Tool: nutrition_delete_entry ───────────────────────────
export async function nutrition_delete_entry(
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const { entry_id } = params as { entry_id: string };
  if (!entry_id) throw new Error('entry_id is required');

  const db = admin();
  const { error } = await db
    .from('nutrition_logs')
    .delete()
    .eq('id', entry_id)
    .eq('user_id', userId); // RLS double-check

  if (error) throw new Error(error.message);
  return { success: true, deleted_id: entry_id };
}
