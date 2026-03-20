import React from 'react';
import SessionDetail from '@ziko/plugin-stats/screens/SessionDetail';
import { supabase } from '../../../../src/lib/supabase';

export default function SessionDetailRoute() {
  return <SessionDetail supabase={supabase} />;
}
