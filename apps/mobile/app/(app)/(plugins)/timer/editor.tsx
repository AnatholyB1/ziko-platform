import React from 'react';
import TimerEditor from '@ziko/plugin-timer/screens/TimerEditor';
import { supabase } from '../../../../src/lib/supabase';

export default function TimerEditorRoute() {
  return <TimerEditor supabase={supabase} />;
}
