import React from 'react';
import CreateChallengeScreen from '@ziko/plugin-community/screens/CreateChallengeScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CreateChallengeRoute() {
  return <CreateChallengeScreen supabase={supabase} />;
}
