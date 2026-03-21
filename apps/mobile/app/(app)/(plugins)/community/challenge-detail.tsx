import React from 'react';
import ChallengeDetailScreen from '@ziko/plugin-community/screens/ChallengeDetailScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function ChallengeDetailRoute() {
  return <ChallengeDetailScreen supabase={supabase} />;
}
