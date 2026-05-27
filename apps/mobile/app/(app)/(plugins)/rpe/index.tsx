import React from 'react';
import RPEPlugin from '@ziko/plugin-rpe/screens/RPEPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function RPEPluginRoute() {
  return <RPEPlugin supabase={supabase} />;
}
