import React from 'react';
import SleepPlugin from '@ziko/plugin-sleep/screens/SleepPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function SleepDashboardRoute() {
  return <SleepPlugin supabase={supabase} />;
}
