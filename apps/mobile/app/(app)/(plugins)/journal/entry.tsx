import React from 'react';
import { useRouter } from 'expo-router';
import JournalEntry from '@ziko/plugin-journal/screens/JournalEntry';
import { supabase, sessionManager } from '../../../../src/lib/supabase';

export default function JournalEntryRoute() {
  const router = useRouter();
  return (
    <JournalEntry
      supabase={supabase}
      requireUser={() => sessionManager.requireUser()}
      onReauth={() => router.replace('/(auth)/login' as any)}
    />
  );
}
