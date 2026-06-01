import React from 'react';
import TimerPlugin from '@ziko/plugin-timer/screens/TimerPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function TimerDashboardRoute() {
  return <TimerPlugin supabase={supabase} />;
}
