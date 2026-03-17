import React from 'react';
import { View, Text } from 'react-native';
import NutritionDashboard from '@ziko/plugin-nutrition/src/screens/NutritionDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function NutritionDashboardRoute() {
  return <NutritionDashboard supabase={supabase} />;
}
