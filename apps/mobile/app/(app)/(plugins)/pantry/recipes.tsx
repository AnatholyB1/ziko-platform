import React from 'react';
import PantryRecipes from '@ziko/plugin-pantry/screens/PantryRecipes';
import { supabase } from '../../../../src/lib/supabase';

export default function PantryRecipesRoute() {
  return <PantryRecipes supabase={supabase} />;
}
