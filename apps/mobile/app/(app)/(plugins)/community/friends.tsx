import React from 'react';
import FriendsScreen from '@ziko/plugin-community/screens/FriendsScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function FriendsRoute() {
  return <FriendsScreen supabase={supabase} />;
}
