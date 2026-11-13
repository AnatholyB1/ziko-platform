import React from 'react';
import { useRouter } from 'expo-router';
import CoachScreen from '@ziko/plugin-coach/screens/CoachScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachDashboardRoute() {
  const router = useRouter();
  return <CoachScreen supabase={supabase} onReauth={() => router.replace('/(auth)/login' as any)} />;
}
