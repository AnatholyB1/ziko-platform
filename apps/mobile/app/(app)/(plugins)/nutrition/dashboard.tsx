import React from 'react';
import { View, Text } from 'react-native';
import NutritionPlugin from '@ziko/plugin-nutrition/screens/NutritionPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function NutritionDashboardRoute() {
  return <NutritionPlugin supabase={supabase} />;
}
