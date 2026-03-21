import React from 'react';
import SleepLog from '@ziko/plugin-sleep/screens/SleepLog';
import { supabase } from '../../../../src/lib/supabase';

export default function SleepLogRoute() {
  return <SleepLog supabase={supabase} />;
}
