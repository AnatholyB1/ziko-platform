import React from 'react';
import JournalDashboard from '@ziko/plugin-journal/screens/JournalDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function JournalDashboardRoute() {
  return <JournalDashboard supabase={supabase} />;
}
