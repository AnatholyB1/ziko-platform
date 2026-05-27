import React from 'react';
import GamificationPlugin from '@ziko/plugin-gamification/screens/GamificationPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function GamificationDashboardRoute() {
  return <GamificationPlugin supabase={supabase} />;
}
