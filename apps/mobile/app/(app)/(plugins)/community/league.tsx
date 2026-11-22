import React from 'react';
import LeagueScreen from '@ziko/plugin-community/screens/LeagueScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function LeagueRoute() {
  return <LeagueScreen supabase={supabase} />;
}
