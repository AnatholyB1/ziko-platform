import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { triggerRetroactiveRecompute } from '../lib/onboardingRecompute';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  // D-02: athlete_state.status === 'active' is the authoritative mandatory-flow
  // completion signal, written only by the assess_profile tool via
  // record_athlete_decision(). profile.onboarding_done alone is set by the old
  // 7-step flow's step-7.tsx before the Ziko chat runs and cannot express
  // "the mandatory conversation finished".
  athleteOnboardingComplete: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => () => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

let authListenerStarted = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  // false is the fail-safe posture: an unknown/unread athlete stays inside
  // the (auth) stack rather than escaping the mandatory flow.
  athleteOnboardingComplete: false,
  isLoading: true,
  isInitialized: false,

  initialize: () => {
    if (authListenerStarted) {
      return () => {};
    }
    authListenerStarted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().refreshProfile();
      } else {
        set({ profile: null });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().refreshProfile();
      }
      set({ isLoading: false, isInitialized: true });
    });

    return () => {
      subscription.unsubscribe();
      authListenerStarted = false;
    };
  },

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, athleteOnboardingComplete: false });
    queryClient.clear();
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;

    const [{ data: profileData }, { data: stateData }] = await Promise.all([
      supabase.from('ziko_user_profiles').select('*').eq('id', user.id).single(),
      // maybeSingle(): a brand-new athlete has no athlete_state row yet, and
      // single() would surface that as an error.
      supabase.from('ziko_athlete_state').select('status').eq('user_id', user.id).maybeSingle(),
    ]);

    if (profileData) {
      set({ profile: profileData as UserProfile });
    }
    set({ athleteOnboardingComplete: stateData?.status === 'active' });

    // ONBOARD-06: pre-v1.18 athlete — onboarding_done is true (old 7-step
    // flow) but athlete_state was never created (never went through Ziko).
    // Fire-and-forget: must not be awaited, must not delay isLoading: false.
    if (profileData?.onboarding_done && stateData === null) {
      triggerRetroactiveRecompute().catch(() => {});
    }
  },
}));
