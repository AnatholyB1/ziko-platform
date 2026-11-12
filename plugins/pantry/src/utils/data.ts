import {
  remainingFromSettings, planRanger, type MacroBudgetLike, type MissingEntry, type PantryRow, type ShoppingRow, type RangerPlan,
} from './pantryLogic';
import type { ShoppingListItem } from '../types/shopping';

// Acces Supabase du Garde-manger (client mobile, RLS). Chaque fonction prend le client en argument
// pour rester testable avec un faux client.

export async function fetchPantryItems(supabase: any, userId: string): Promise<PantryRow[]> {
  const { data, error } = await supabase.from('ziko_pantry_items').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as PantryRow[];
}

/** Lignes persistees de la liste. Une erreur (table absente tant que la migration n'est pas appliquee) = liste vide. */
export async function fetchShoppingRows(supabase: any, userId: string): Promise<ShoppingListItem[]> {
  const { data, error } = await supabase
    .from('ziko_shopping_list_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as ShoppingListItem[];
}

/** Macros restantes AVANT generation : objectifs du plugin nutrition moins les repas du jour (date locale). */
export async function fetchRemainingMacros(supabase: any, userId: string, todayISO: string): Promise<MacroBudgetLike> {
  const [settingsRes, mealsRes] = await Promise.all([
    supabase.from('ziko_user_plugins').select('settings').eq('user_id', userId).eq('plugin_id', 'nutrition').maybeSingle(),
    supabase.from('ziko_nutrition_logs').select('calories, protein_g, carbs_g, fat_g').eq('user_id', userId).eq('date', todayISO),
  ]);
  return remainingFromSettings(settingsRes?.data?.settings, (mealsRes?.data ?? []) as Array<Record<string, unknown>>);
}

/** Execute un RangerPlan. Leve en cas d'erreur Supabase (l'appelant affiche showAlert et recharge). */
export async function executeRanger(supabase: any, userId: string, plan: RangerPlan): Promise<void> {
  for (const u of plan.updates) {
    const patch: Record<string, unknown> = { quantity: u.quantity };
    if (u.clearExpiry) patch.expiration_date = null;
    const { error } = await supabase.from('ziko_pantry_items').update(patch).eq('id', u.id);
    if (error) throw error;
  }
  if (plan.inserts.length) {
    const { error } = await supabase
      .from('ziko_pantry_items')
      .insert(plan.inserts.map((i) => ({ ...i, user_id: userId })));
    if (error) throw error;
  }
  for (const id of plan.deleteShoppingIds) {
    const { error } = await supabase.from('ziko_shopping_list_items').delete().eq('id', id);
    if (error) throw error;
  }
}

export async function putAway(
  supabase: any,
  userId: string,
  args: { autoChecked: MissingEntry[]; rows: ShoppingRow[]; pantry: PantryRow[] },
): Promise<RangerPlan> {
  const plan = planRanger(args);
  await executeRanger(supabase, userId, plan);
  return plan;
}
