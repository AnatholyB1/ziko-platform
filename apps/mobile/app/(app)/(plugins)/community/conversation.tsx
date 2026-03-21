import React from 'react';
import ConversationScreen from '@ziko/plugin-community/screens/ConversationScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function ConversationRoute() {
  return <ConversationScreen supabase={supabase} />;
}
