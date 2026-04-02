import { clientForUser } from './db.js';
import { nutrition_log_meal } from './nutrition.js';

// ── Tool: pantry_get_items ────────────────────────────────────
export async function pantry_get_items(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);
  const { storage_location } = params as { storage_location?: string };

  let query = db.from('pantry_items').select('*').eq('user_id', userId).order('name');
  if (storage_location) query = query.eq('storage_location', storage_location);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { items: data ?? [], count: (data ?? []).length };
}

// ── Tool: pantry_update_item ──────────────────────────────────
export async function pantry_update_item(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);
  const { item_id, name, quantity, unit } = params as {
    item_id?: string;
    name?: string;
    quantity?: number;
    unit?: string;
  };

  // Find item: by ID if provided, else by name ILIKE match
  let targetId = item_id;
  if (!targetId && name) {
    const { data: matches } = await db
      .from('pantry_items')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', `%${name}%`)
      .limit(1);
    if (matches && matches.length > 0) {
      targetId = matches[0].id;
    } else {
      // No existing item found — create new item (handles "Add 500g chicken breast")
      const newItem: Record<string, unknown> = {
        user_id: userId,
        name,
        quantity: quantity ?? 0,
        unit: unit ?? 'g',
        storage_location: 'fridge',
        food_category: 'other',
        low_stock_threshold: 1,
      };
      const { data, error } = await db.from('pantry_items').insert(newItem).select().single();
      if (error) throw new Error(error.message);
      return { action: 'created', item: data };
    }
  }

  if (!targetId) throw new Error('Provide item_id or name to identify the item');

  // Build update object
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (quantity !== undefined) updates.quantity = quantity;
  if (unit) updates.unit = unit;
  if (name && item_id) updates.name = name; // Only update name if explicitly targeting by ID

  const { data, error } = await db
    .from('pantry_items')
    .update(updates)
    .eq('id', targetId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { action: 'updated', item: data };
}

// ── Tool: pantry_log_recipe_cooked ──────────────────────────
export async function pantry_log_recipe_cooked(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const { recipe: recipeStr, servings, meal_type, macros_override: overrideStr } = params as {
    recipe: string;
    servings: number;
    meal_type: string;
    macros_override?: string;
  };

  const recipe = JSON.parse(recipeStr);
  const ratio = servings / recipe.base_servings;
  const override = overrideStr ? JSON.parse(overrideStr) : {};

  // 1. Log nutrition via direct function call (no HTTP round-trip, per D-06)
  await nutrition_log_meal(
    {
      meal_type,
      food_name: recipe.name,
      calories: override.calories ?? Math.round(recipe.macros.calories * ratio),
      protein_g: override.protein_g ?? Math.round(recipe.macros.protein_g * ratio),
      carbs_g: override.carbs_g ?? Math.round(recipe.macros.carbs_g * ratio),
      fat_g: override.fat_g ?? Math.round(recipe.macros.fat_g * ratio),
    },
    userId,
    userToken,
  );

  // 2. Pantry decrement — best-effort per-ingredient (mirrors RecipeConfirm.tsx logic)
  const db = clientForUser(userToken);
  const { data: pantryItems } = await db
    .from('pantry_items')
    .select('id, name, quantity, unit')
    .eq('user_id', userId);

  const items = pantryItems ?? [];
  for (const ingredient of recipe.ingredients ?? []) {
    const ingName = ingredient.name.toLowerCase();
    const match = items.find((item: any) => {
      if (ingredient.pantry_item_id && item.id === ingredient.pantry_item_id) return true;
      const itemName = item.name.toLowerCase();
      return itemName === ingName || ingName.includes(itemName) || itemName.includes(ingName);
    });
    if (!match) continue;
    const rawIngQty = ingredient.quantity * ratio;
    // Simple unit conversion: kg->g, L->ml
    const toBase = (qty: number, unit: string) => {
      const u = unit.toLowerCase();
      if (u === 'kg') return { qty: qty * 1000, unit: 'g' };
      if (u === 'l') return { qty: qty * 1000, unit: 'ml' };
      return { qty, unit: u };
    };
    const ingBase = toBase(rawIngQty, ingredient.unit);
    const pantryBase = toBase(match.quantity, match.unit);
    const deductQty = ingBase.unit === pantryBase.unit ? ingBase.qty : rawIngQty;
    const newQty = Math.max(0, pantryBase.qty - deductQty);
    // Convert back to pantry item's original unit
    const finalQty = match.unit.toLowerCase() === 'kg' ? newQty / 1000
      : match.unit.toLowerCase() === 'l' ? newQty / 1000
      : newQty;
    try {
      await db.from('pantry_items').update({ quantity: finalQty }).eq('id', match.id);
    } catch {
      // Best-effort: continue on individual ingredient failure
    }
  }

  return { success: true, recipe_name: recipe.name, servings };
}
