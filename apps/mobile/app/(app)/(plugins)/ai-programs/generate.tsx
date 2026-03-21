import React from 'react';
import GenerateProgram from '@ziko/plugin-ai-programs/screens/GenerateProgram';
import { supabase } from '../../../../src/lib/supabase';

export default function GenerateProgramRoute() {
  return <GenerateProgram supabase={supabase} />;
}
