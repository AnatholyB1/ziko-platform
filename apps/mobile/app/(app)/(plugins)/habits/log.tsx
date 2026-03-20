import React from 'react';
import HabitLogScreen from '@ziko/plugin-habits/screens/HabitLogScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function HabitLogRoute() {
  return <HabitLogScreen supabase={supabase} />;
}
