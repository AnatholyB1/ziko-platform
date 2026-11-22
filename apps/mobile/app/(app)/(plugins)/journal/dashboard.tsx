import React from 'react';
import { useRouter } from 'expo-router';
import JournalPlugin from '@ziko/plugin-journal/screens/JournalPlugin';
import { supabase, sessionManager } from '../../../../src/lib/supabase';

export default function JournalDashboardRoute() {
  const router = useRouter();
  return (
    <JournalPlugin
      supabase={supabase}
      requireUser={() => sessionManager.requireUser()}
      onReauth={() => router.replace('/(auth)/login' as any)}
    />
  );
}
