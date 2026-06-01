import React from 'react';
import StatsPlugin from '@ziko/plugin-stats/screens/StatsPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function StatsDashboardRoute() {
  return <StatsPlugin supabase={supabase} />;
}
