import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { createSessionManager, patchGetUser } from './sessionManager';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Single source of fresh session/user (v1.20 P2). auth.getUser() without a jwt now
// resolves from the auto-refreshed local session (no stale-token network call).
export const sessionManager = createSessionManager(supabase.auth as any);
patchGetUser(supabase.auth as any, sessionManager);
