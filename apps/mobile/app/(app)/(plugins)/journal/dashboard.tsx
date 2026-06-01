import React from 'react';
import JournalPlugin from '@ziko/plugin-journal/screens/JournalPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function JournalDashboardRoute() {
  return <JournalPlugin supabase={supabase} />;
}
