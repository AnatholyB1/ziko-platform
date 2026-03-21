import React from 'react';
import CommunityDashboard from '@ziko/plugin-community/screens/CommunityDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function CommunityDashboardRoute() {
  return <CommunityDashboard supabase={supabase} />;
}
