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

/**
 * Execute un RangerPlan avec compensation (revue A #19) : pas de transaction cote client, donc en cas d'erreur
 * a mi-chemin on ANNULE ce qui a deja ete ecrit (quantites/dates restaurees depuis `before`, lignes inserees
 * supprimees), puis on leve. Ordre : maj stock -> ajout stock -> suppression des courses (derniere : tant
 * qu'elle n'a pas reussi, l'article reste a ranger, le stock n'est jamais compte deux fois apres un retry).
 * Leve en cas d'erreur Supabase (l'appelant affiche showAlert et recharge). Limite : si l'annulation echoue
 * elle-meme (reseau coupe), un ecart reste possible ; une vraie RPC transactionnelle reste preferable.
 */
export async function executeRanger(supabase: any, userId: string, plan: RangerPlan, before: PantryRow[] = []): Promise<void> {
  const applied: Array<{ id: string; prev: PantryRow | undefined }> = [];
  let insertedIds: string[] = [];
  try {
    for (const u of plan.updates) {
      const patch: Record<string, unknown> = { quantity: u.quantity };
      if (u.clearExpiry) patch.expiration_date = null;
      const { error } = await supabase.from('ziko_pantry_items').update(patch).eq('id', u.id);
      if (error) throw error;
      applied.push({ id: u.id, prev: before.find((r) => r.id === u.id) });
    }
    if (plan.inserts.length) {
      const { data, error } = await supabase
        .from('ziko_pantry_items')
        .insert(plan.inserts.map((i) => ({ ...i, user_id: userId })))
        .select('id');
      if (error) throw error;
      insertedIds = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    for (const id of plan.deleteShoppingIds) {
      const { error } = await supabase.from('ziko_shopping_list_items').delete().eq('id', id);
      if (error) throw error;
    }
  } catch (err) {
    await rollbackRanger(supabase, applied, insertedIds);
    throw err;
  }
}

/** Annulation au mieux : ne leve jamais (l'erreur d'origine prime). */
async function rollbackRanger(
  supabase: any,
  applied: Array<{ id: string; prev: PantryRow | undefined }>,
  insertedIds: string[],
): Promise<void> {
  if (insertedIds.length) {
    try { await supabase.from('ziko_pantry_items').delete().in('id', insertedIds); } catch { /* best effort */ }
  }
  for (const a of applied) {
    if (!a.prev) continue;
    try {
      await supabase
        .from('ziko_pantry_items')
        .update({ quantity: a.prev.quantity, expiration_date: a.prev.expiration_date })
        .eq('id', a.id);
    } catch { /* best effort */ }
  }
}

export async function putAway(
  supabase: any,
  userId: string,
  args: { autoChecked: MissingEntry[]; rows: ShoppingRow[]; pantry: PantryRow[] },
): Promise<RangerPlan> {
  const plan = planRanger(args);
  await executeRanger(supabase, userId, plan, args.pantry);
  return plan;
}
