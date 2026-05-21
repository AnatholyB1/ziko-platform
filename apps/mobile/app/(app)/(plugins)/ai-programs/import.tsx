import React from 'react';
import ImportFileScreen from '@ziko/plugin-ai-programs/screens/ImportFileScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function ImportFileRoute() {
  return <ImportFileScreen supabase={supabase} />;
}
