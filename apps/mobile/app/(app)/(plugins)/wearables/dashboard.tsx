import React from 'react';
import WearablesDashboard from '@ziko/plugin-wearables/screens/WearablesDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function WearablesDashboardRoute() {
  return <WearablesDashboard supabase={supabase} />;
}
