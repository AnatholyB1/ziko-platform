import React from 'react';
import StretchingSession from '@ziko/plugin-stretching/screens/StretchingSession';
import { supabase } from '../../../../src/lib/supabase';

export default function StretchingSessionRoute() {
  return <StretchingSession supabase={supabase} />;
}
