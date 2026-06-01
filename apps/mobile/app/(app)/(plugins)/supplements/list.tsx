import React from 'react';
import SupplementsPlugin from '@ziko/plugin-supplements/screens/SupplementsPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function SupplementsListRoute() {
  return <SupplementsPlugin supabase={supabase} />;
}
