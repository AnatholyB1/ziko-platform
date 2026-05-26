import React from 'react';
import AIProgramsPlugin from '@ziko/plugin-ai-programs/screens/AIProgramsPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function AIProgramsDashboardRoute() {
  return <AIProgramsPlugin supabase={supabase} />;
}
