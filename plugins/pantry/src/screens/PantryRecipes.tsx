import React from 'react';
import PantryPlugin from './PantryPlugin';

// Ecran historique conserve pour la route /pantry/recipes : il ouvre le Garde-manger sur l'onglet Recettes.
export default function PantryRecipes({ supabase, recipeCreditCost }: { supabase: any; recipeCreditCost?: number }) {
  return <PantryPlugin supabase={supabase} initialTab="recipes" recipeCreditCost={recipeCreditCost} />;
}
