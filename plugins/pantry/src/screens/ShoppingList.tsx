import React from 'react';
import PantryPlugin from './PantryPlugin';

// Ecran historique conserve pour la route /pantry/shopping : il ouvre le Garde-manger sur l'onglet Courses.
export default function ShoppingList({ supabase, recipeCreditCost }: { supabase: any; recipeCreditCost?: number }) {
  return <PantryPlugin supabase={supabase} initialTab="shopping" recipeCreditCost={recipeCreditCost} />;
}
