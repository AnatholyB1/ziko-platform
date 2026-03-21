import React from 'react';
import TimerDashboard from '@ziko/plugin-timer/screens/TimerDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function TimerDashboardRoute() {
  return <TimerDashboard supabase={supabase} />;
}
