import React from 'react';
import RecipeConfirm from '@ziko/plugin-pantry/screens/RecipeConfirm';
import { supabase } from '../../../../src/lib/supabase';

export default function RecipeConfirmRoute() {
  return <RecipeConfirm supabase={supabase} />;
}
