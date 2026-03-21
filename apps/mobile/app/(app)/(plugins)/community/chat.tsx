import React from 'react';
import ChatListScreen from '@ziko/plugin-community/screens/ChatListScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function ChatRoute() {
  return <ChatListScreen supabase={supabase} />;
}
