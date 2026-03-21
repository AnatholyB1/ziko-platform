import React from 'react';
import SleepDashboard from '@ziko/plugin-sleep/screens/SleepDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function SleepDashboardRoute() {
  return <SleepDashboard supabase={supabase} />;
}
