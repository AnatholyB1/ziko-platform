import React from 'react';
import LogMealScreen from '@ziko/plugin-nutrition/screens/LogMealScreen';
import { supabase } from '../../../../src/lib/supabase';
import { queryClient } from '../../../../src/lib/queryClient';

export default function NutritionLogRoute() {
  // D-13 : apres un ajout, la tuile Repas de l'accueil (['nutrition','today',userId]) se rafraichit
  return (
    <LogMealScreen
      supabase={supabase}
      onSaved={() => { queryClient.invalidateQueries({ queryKey: ['nutrition'] }); }}
    />
  );
}
