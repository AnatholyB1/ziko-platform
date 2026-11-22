import React from 'react';
import PantryRecipes from '@ziko/plugin-pantry/screens/PantryRecipes';
import { supabase } from '../../../../src/lib/supabase';
import { CREDIT_COSTS } from '../../../../src/lib/creditCosts';

export default function PantryRecipesRoute() {
  return <PantryRecipes supabase={supabase} recipeCreditCost={CREDIT_COSTS.recipes} />;
}
