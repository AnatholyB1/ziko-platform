import React from 'react';
import ChallengesScreen from '@ziko/plugin-community/screens/ChallengesScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function ChallengesRoute() {
  return <ChallengesScreen supabase={supabase} />;
}
