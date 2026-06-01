import React from 'react';
import StretchingPlugin from '@ziko/plugin-stretching/screens/StretchingPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function StretchingDashboardRoute() {
  return <StretchingPlugin supabase={supabase} />;
}
