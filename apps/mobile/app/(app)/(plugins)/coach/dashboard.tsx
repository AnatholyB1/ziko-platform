import React from 'react';
import CoachScreen from '@ziko/plugin-coach/screens/CoachScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachDashboardRoute() {
  return <CoachScreen supabase={supabase} />;
}
