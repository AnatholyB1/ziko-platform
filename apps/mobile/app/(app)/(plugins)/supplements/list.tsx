import React from 'react';
import SupplementsListScreen from '@ziko/plugin-supplements/screens/SupplementsList';
import { supabase } from '../../../../src/lib/supabase';

export default function SupplementsListRoute() {
  return <SupplementsListScreen supabase={supabase} />;
}
