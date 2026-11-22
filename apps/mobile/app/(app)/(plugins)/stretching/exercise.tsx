import React from 'react';
import ExerciseEditor from '@ziko/plugin-stretching/screens/ExerciseEditor';
import { supabase } from '../../../../src/lib/supabase';

export default function StretchingExerciseRoute() {
  return <ExerciseEditor supabase={supabase} />;
}
