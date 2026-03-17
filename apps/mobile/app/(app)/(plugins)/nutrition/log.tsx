import React from 'react';
import LogMealScreen from '@ziko/plugin-nutrition/src/screens/LogMealScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function NutritionLogRoute() {
  return <LogMealScreen supabase={supabase} />;
}
