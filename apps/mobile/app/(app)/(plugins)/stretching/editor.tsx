import React from 'react';
import RoutineEditor from '@ziko/plugin-stretching/screens/RoutineEditor';
import { supabase } from '../../../../src/lib/supabase';

export default function RoutineEditorRoute() {
  return <RoutineEditor supabase={supabase} />;
}
