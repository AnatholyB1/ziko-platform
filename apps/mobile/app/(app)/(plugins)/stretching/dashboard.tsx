import React from 'react';
import StretchingDashboard from '@ziko/plugin-stretching/screens/StretchingDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function StretchingDashboardRoute() {
  return <StretchingDashboard supabase={supabase} />;
}
