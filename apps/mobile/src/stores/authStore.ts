import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import {
  getEffectiveLevel,
  getNewlyUnlockedPlugins,
  reduceLevelRead,
  shouldDiscardLevelRead,
  FIRST_LEVEL_READ_TIMEOUT_MS,
} from '@ziko/plugin-sdk';
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

// Level state is bound to the current user id. Every id change (sign-out, remote
// sign-out, account switch) resets it, and reads are tagged with the user id and
// a monotonic sequence so a late or out-of-order response can never write into
// the wrong user or lower an already applied level (Phase 46 audit).
let levelSeq = 0;
let levelAppliedSeq = 0;
// true when levelLoaded only reflects the timeout / read-error fallback (level 1),
// so the first real read afterwards is not announced as a level-up.
let levelFallback = false;
let firstReadTimer: ReturnType<typeof setTimeout> | null = null;

function clearFirstReadTimer(): void {
  if (firstReadTimer) {
    clearTimeout(firstReadTimer);
    firstReadTimer = null;
  }
}

// Invalidates in-flight reads and returns the patch that resets user-bound state.
function levelResetPatch(): Partial<AuthState> {
  levelSeq += 1;
  levelAppliedSeq = levelSeq;
  levelFallback = false;
  clearFirstReadTimer();
  return { effectiveLevel: 1, levelLoaded: false, levelUp: null, athleteOnboardingComplete: false };
}

// Sets session/user; resets level state if the user id changed. Starts the
// first-read timeout so the route guard / loader never hang if the read stalls.
function setSessionUser(set: AuthSet, get: () => AuthState, session: Session | null): void {
  const prevId = get().user?.id ?? null;
  const nextId = session?.user?.id ?? null;
  const changed = prevId !== nextId;
  set({ session, user: session?.user ?? null, ...(changed ? levelResetPatch() : {}) });
  if (changed && nextId) {
    firstReadTimer = setTimeout(() => {
      firstReadTimer = null;
      if (get().user?.id === nextId && !get().levelLoaded) {
        levelFallback = true;
        set({ levelLoaded: true });
      }
    }, FIRST_LEVEL_READ_TIMEOUT_MS);
  }
}

// Applies a finished read unless it is stale (other user / older than applied).
function commitLevelRead(set: AuthSet, get: () => AuthState, uid: string, seq: number, read: number): void {
  if (shouldDiscardLevelRead({
    requestUserId: uid,
    currentUserId: get().user?.id,
    requestSeq: seq,
    appliedSeq: levelAppliedSeq,
  })) return;
  levelAppliedSeq = seq;
  clearFirstReadTimer();
  const { effectiveLevel, levelLoaded } = get();
  const r = reduceLevelRead({ level: effectiveLevel, loaded: levelLoaded, fallback: levelFallback }, read);
  levelFallback = false;
  set({
    effectiveLevel: r.state.level,
    levelLoaded: true,
    ...(r.levelUp
      ? { levelUp: { ...r.levelUp, plugins: getNewlyUnlockedPlugins(r.levelUp.from, r.levelUp.to) } }
      : {}),
  });
}

// Read error: keep the last known level (never re-lock on a transient failure);
// just unblock consumers on first attempt so level-1 plugins still load.
function unblockLevelOnError(set: AuthSet, get: () => AuthState, uid: string): void {
  if (get().user?.id !== uid || get().levelLoaded) return;
  levelFallback = true;
  set({ levelLoaded: true });
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
    const uid = user.id;
    const seq = ++levelSeq;
    const { data, error } = await supabase
      .from('ziko_athlete_state')
      .select('tier, level')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) {
      unblockLevelOnError(set, get, uid);
      return;
    }
    commitLevelRead(set, get, uid, seq, getEffectiveLevel(data));
  },

  initialize: () => {
    if (authListenerStarted) {
      return () => {};
    }
    authListenerStarted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSessionUser(set, get, session);
      if (session?.user) {
        await get().refreshProfile();
      } else {
        set({ profile: null });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSessionUser(set, get, session);
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

  setSession: (session) => setSessionUser(set, get, session),

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      ...levelResetPatch(),
    });
    queryClient.clear();
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;
    const uid = user.id;
    const seq = ++levelSeq;

    const [{ data: profileData }, { data: stateData, error: stateError }] = await Promise.all([
      supabase.from('ziko_user_profiles').select('*').eq('id', uid).single(),
      // maybeSingle(): a brand-new athlete has no athlete_state row yet, and
      // single() would surface that as an error.
      supabase.from('ziko_athlete_state').select('status, tier, level').eq('user_id', uid).maybeSingle(),
    ]);

    // Account changed / signed out while the reads were in flight: drop everything.
    if (get().user?.id !== uid) return;

    if (profileData) {
      set({ profile: profileData as UserProfile });
    }
    set({ athleteOnboardingComplete: stateData?.status === 'active' });
    // On a read error keep the last known level rather than re-locking plugins.
    if (!stateError) commitLevelRead(set, get, uid, seq, getEffectiveLevel(stateData));
    else unblockLevelOnError(set, get, uid);

    // ONBOARD-06: pre-v1.18 athlete — onboarding_done is true (old 7-step
    // flow) but athlete_state was never created (never went through Ziko).
    // Fire-and-forget: must not be awaited, must not delay isLoading: false.
    if (profileData?.onboarding_done && stateData === null) {
      triggerRetroactiveRecompute().catch(() => {});
    }
  },
}));
