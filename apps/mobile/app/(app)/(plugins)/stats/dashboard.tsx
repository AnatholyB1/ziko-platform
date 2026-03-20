import React from 'react';
import StatsDashboard from '@ziko/plugin-stats/screens/StatsDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function StatsDashboardRoute() {
  return <StatsDashboard supabase={supabase} />;
}
