// Shopping list types (Phase 9 + v1.20 Phase 10)

/** `manual` = ligne ajoutee par l'utilisateur (migration 20261201100100 : valeur d'enum + colonnes reason/checked). */
export type ShoppingItemSource = 'low_stock' | 'recipe' | 'manual';

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
  /** Pourquoi la ligne est dans la liste (absent tant que la migration n'est pas appliquee). */
  reason?: string | null;
  /** Coche = pret a ranger (absent tant que la migration n'est pas appliquee). */
  checked?: boolean;
  created_at: string;
}
