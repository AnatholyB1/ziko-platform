import React from 'react';
import HabitsDashboardScreen from '@ziko/plugin-habits/screens/HabitsDashboardScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function HabitsDashboardRoute() {
  return <HabitsDashboardScreen supabase={supabase} />;
}
