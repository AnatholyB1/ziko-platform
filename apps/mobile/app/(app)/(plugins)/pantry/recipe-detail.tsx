import React from 'react';
import RecipeDetail from '@ziko/plugin-pantry/screens/RecipeDetail';
import { supabase } from '../../../../src/lib/supabase';

export default function RecipeDetailRoute() {
  return <RecipeDetail supabase={supabase} />;
}
