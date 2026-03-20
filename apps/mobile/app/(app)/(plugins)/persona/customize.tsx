import React from 'react';
import PersonaCustomizeScreen from '@ziko/plugin-persona/screens/PersonaCustomizeScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function PersonaCustomizeRoute() {
  return <PersonaCustomizeScreen supabase={supabase} />;
}
