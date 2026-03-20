import React from 'react';
import ExerciseStats from '@ziko/plugin-stats/screens/ExerciseStats';
import { supabase } from '../../../../src/lib/supabase';

export default function ExerciseStatsRoute() {
  return <ExerciseStats supabase={supabase} />;
}
