import React from 'react';
import HydrationDashboard from '@ziko/plugin-hydration/screens/HydrationDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function HydrationDashboardRoute() {
  return <HydrationDashboard supabase={supabase} />;
}
