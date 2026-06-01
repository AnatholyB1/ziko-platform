import React from 'react';
import WearablesPlugin from '@ziko/plugin-wearables/screens/WearablesPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function WearablesDashboardRoute() {
  return <WearablesPlugin supabase={supabase} />;
}
