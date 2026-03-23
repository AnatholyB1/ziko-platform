import React from 'react';
import SupplementDetailScreen from '@ziko/plugin-supplements/screens/SupplementDetail';
import { supabase } from '../../../../src/lib/supabase';

export default function SupplementDetailRoute() {
  return <SupplementDetailScreen supabase={supabase} />;
}
