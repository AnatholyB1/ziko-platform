import React from 'react';
import CommunityPlugin from '@ziko/plugin-community/screens/CommunityPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function CommunityDashboardRoute() {
  return <CommunityPlugin supabase={supabase} />;
}
