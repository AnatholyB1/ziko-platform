import React from 'react';
import PantryDashboard from '@ziko/plugin-pantry/screens/PantryDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function PantryDashboardRoute() {
  return <PantryDashboard supabase={supabase} />;
}
