import React from 'react';
import AIProgramsDashboard from '@ziko/plugin-ai-programs/screens/AIProgramsDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function AIProgramsDashboardRoute() {
  return <AIProgramsDashboard supabase={supabase} />;
}
