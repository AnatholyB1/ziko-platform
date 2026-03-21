import React from 'react';
import InviteScreen from '@ziko/plugin-community/screens/InviteScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function InviteRoute() {
  return <InviteScreen supabase={supabase} />;
}
