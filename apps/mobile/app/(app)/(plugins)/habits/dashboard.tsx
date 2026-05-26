import React from 'react';
import HabitsPlugin from '@ziko/plugin-habits/screens/HabitsPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function HabitsDashboardRoute() {
  return <HabitsPlugin supabase={supabase} />;
}
