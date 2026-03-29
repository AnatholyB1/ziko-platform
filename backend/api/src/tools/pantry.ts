import { clientForUser } from './db.js';

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
