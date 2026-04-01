// Shopping list types for Phase 9

export type ShoppingItemSource = 'low_stock' | 'recipe';

export interface ShoppingListItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  /** FK → pantry_items.id — null for recipe-sourced items that have no pantry match */
  pantry_item_id: string | null;
  source: ShoppingItemSource;
  recipe_name: string | null;
  created_at: string;
}
