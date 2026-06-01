import React from 'react';
import HydrationPlugin from '@ziko/plugin-hydration/screens/HydrationPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function HydrationDashboardRoute() {
  return <HydrationPlugin supabase={supabase} />;
}
