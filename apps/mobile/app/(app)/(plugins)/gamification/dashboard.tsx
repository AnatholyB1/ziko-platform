import React from 'react';
import GamificationDashboard from '@ziko/plugin-gamification/screens/GamificationDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function GamificationDashboardRoute() {
  return <GamificationDashboard supabase={supabase} />;
}
