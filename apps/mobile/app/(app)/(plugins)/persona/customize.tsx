import React from 'react';
import CoachIAPlugin from '@ziko/plugin-persona/screens/CoachIAPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function PersonaCustomizeRoute() {
  return <CoachIAPlugin supabase={supabase} />;
}
