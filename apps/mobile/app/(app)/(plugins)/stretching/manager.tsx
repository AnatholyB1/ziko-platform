import React from 'react';
import RoutineManager from '@ziko/plugin-stretching/screens/RoutineManager';
import { supabase } from '../../../../src/lib/supabase';

export default function RoutineManagerRoute() {
  return <RoutineManager supabase={supabase} />;
}
