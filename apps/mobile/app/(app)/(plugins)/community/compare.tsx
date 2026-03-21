import React from 'react';
import CompareScreen from '@ziko/plugin-community/screens/CompareScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CompareRoute() {
  return <CompareScreen supabase={supabase} />;
}
