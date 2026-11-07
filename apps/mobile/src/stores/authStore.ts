import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { getEffectiveLevel, getNewlyUnlockedPlugins } from '@ziko/plugin-sdk';
import type { UserProfile, PluginLevelInfo } from '@ziko/plugin-sdk';
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

  // Progressive unlock (Phase 46). Level is derived from ziko_athlete_state.tier
  // (1-5, no row => 1). `levelLoaded` flips true after the first read attempt so
  // PluginLoader / route guard can avoid acting on the fail-safe default.
  effectiveLevel: number;
  levelLoaded: boolean;
  // Set when a refresh raises the level after it was already known; consumed by
  // the unlock toast (clearLevelUp). null when nothing to announce.
  levelUp: { from: number; to: number; plugins: PluginLevelInfo[] } | null;
  clearLevelUp: () => void;
  /** Re-reads tier from ziko_athlete_state. Call after the weekly-review overlay completes. */
  refreshLevel: () => Promise<void>;

  initialize: () => () => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

let authListenerStarted = false;

type AuthSet = (partial: Partial<AuthState>) => void;

// Applies a freshly read level. Announces a level-up only when a previous level
// was already known (first load after sign-in never triggers a toast).
function applyLevel(set: AuthSet, get: () => AuthState, next: number): void {
  const { effectiveLevel: prev, levelLoaded } = get();
  if (levelLoaded && next > prev) {
    set({
      effectiveLevel: next,
      levelLoaded: true,
      levelUp: { from: prev, to: next, plugins: getNewlyUnlockedPlugins(prev, next) },
    });
  } else {
    set({ effectiveLevel: next, levelLoaded: true });
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  // false is the fail-safe posture: an unknown/unread athlete stays inside
  // the (auth) stack rather than escaping the mandatory flow.
  athleteOnboardingComplete: false,
  isLoading: true,
  isInitialized: false,
  effectiveLevel: 1,
  levelLoaded: false,
  levelUp: null,

  clearLevelUp: () => set({ levelUp: null }),

  refreshLevel: async () => {
    const user = get().user;
    if (!user) return;
    const { data, error } = await supabase
      .from('ziko_athlete_state')
      .select('tier, level')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      // Keep the last known level (never re-lock on a transient failure); just
      // unblock consumers on first attempt so level-1 plugins still load.
      if (!get().levelLoaded) set({ levelLoaded: true });
      return;
    }
    applyLevel(set, get, getEffectiveLevel(data));
  },

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

    // Foreground refetch: a weekly review may have raised the tier while the app
    // was backgrounded (D-06).
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && get().user) {
        get().refreshLevel().catch(() => {});
      }
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
      authListenerStarted = false;
    };
  },

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      athleteOnboardingComplete: false,
      effectiveLevel: 1,
      levelLoaded: false,
      levelUp: null,
    });
    queryClient.clear();
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;

    const [{ data: profileData }, { data: stateData, error: stateError }] = await Promise.all([
      supabase.from('ziko_user_profiles').select('*').eq('id', user.id).single(),
      // maybeSingle(): a brand-new athlete has no athlete_state row yet, and
      // single() would surface that as an error.
      supabase.from('ziko_athlete_state').select('status, tier, level').eq('user_id', user.id).maybeSingle(),
    ]);

    if (profileData) {
      set({ profile: profileData as UserProfile });
    }
    set({ athleteOnboardingComplete: stateData?.status === 'active' });
    // On a read error keep the last known level rather than re-locking plugins.
    if (!stateError) applyLevel(set, get, getEffectiveLevel(stateData));
    else if (!get().levelLoaded) set({ levelLoaded: true });

    // ONBOARD-06: pre-v1.18 athlete — onboarding_done is true (old 7-step
    // flow) but athlete_state was never created (never went through Ziko).
    // Fire-and-forget: must not be awaited, must not delay isLoading: false.
    if (profileData?.onboarding_done && stateData === null) {
      triggerRetroactiveRecompute().catch(() => {});
    }
  },
}));
