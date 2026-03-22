import React from 'react';
import TimerManager from '@ziko/plugin-timer/screens/TimerManager';
import { supabase } from '../../../../src/lib/supabase';

export default function TimerManagerRoute() {
  return <TimerManager supabase={supabase} />;
}
