import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutSession, Exercise, WorkoutProgram, ProgramWorkout, ProgramExercise } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { callCreditsEarn, callCreditsEarnWithResult } from '../lib/earnCredits';
import { normalizePlanSessions, parseReps, filterCountableSessions } from '../lib/workoutPlan';
import { matchExercise, searchPatternsFor, type CatalogRow } from '../lib/exerciseMatch';
import { exerciseNames } from '@ziko/plugin-sdk';
import { classifyRestoredSession, classifyLiveSession } from '../lib/staleSession';

const sessionKey = (userId: string) => `workout:activeSession:${userId}`;

interface ActiveSet {
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  completed: boolean;
}

interface ProgramExerciseInput {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
  duration_seconds: number | null;
  duration_min: number | null;
  duration_max: number | null;
  rest_seconds: number | null;
  weight_kg: number | null;
  notes: string | null;
  order_index: number;
}

export interface CompletedExercise {
  name: string;
  sets: Array<{ reps?: number | null; weight?: number | null }>;
  isNewPR?: boolean;
  bestSetLabel?: string;
  totalVolume: number;
  delta?: number;
  bestWeight?: number;
}

export interface CompletedSession {
  id: string;
  highlight?: string;
  durationSeconds: number;
  avgHr?: number;
  exercises: CompletedExercise[];
}

interface WorkoutState {
  currentSession: WorkoutSession | null;
  lastCompletedSession: CompletedSession | null;
  currentWorkoutExercises: (ProgramExercise & { exercises?: Exercise })[];
  activeSets: ActiveSet[];
  restTimer: number | null;
  restTimerMax: number;
  isTimerRunning: boolean;
  recentSessions: WorkoutSession[];
  exercises: Exercise[];
  programs: WorkoutProgram[];
  activeProgram: WorkoutProgram | null;
  cycleConfig: { cycle_weeks: number; progression_type: 'increment' | 'percentage'; progression_value: number; current_cycle_week: number } | null;

  setLastCompletedSession: (s: CompletedSession) => void;
  clearLastCompletedSession: () => void;
  saveSessionNotes: (id: string, notes: string) => void;

  restoreSession: () => Promise<void>;
  /**
   * Seance fantome : si la seance en cours est perimee (> STALE_SESSION_HOURS), la cloture sans credit ni XP
   * (ou la supprime si aucune serie validee). Renvoie true si elle a ete retiree de l'etat.
   */
  settleStaleSession: () => Promise<boolean>;
  startSession: (programWorkoutId?: string, name?: string) => Promise<void>;
  /**
   * Single entry point for "start today's planned session" (TRAIN-01/02). Loads the AI program,
   * resolves the session for `dayIndex` (0 = Monday ... 6 = Sunday, or the next planned day when
   * that day is a rest day), pre-loads its exercises and opens a session. Returns the started
   * session name, or null (with `reason`) when nothing could be started.
   */
  startPlannedSession: (
    programId: string,
    dayIndex: number,
  ) => Promise<
    | { ok: true; name: string; exerciseCount: number; /** noms du programme sans equivalent catalogue (non bloquant) */ unresolved: string[]; /** exercices du programme remplaces par la ligne catalogue la plus proche */ replaced?: Array<{ from: string; to: string }> }
    | { ok: false; reason: 'no_user' | 'no_program' | 'no_session' | 'no_exercises' | 'db_error'; unresolved?: string[] }
  >;
  endSession: () => Promise<void>;
  /** Drops an in-progress session that has no validated set (TRAIN-03): nothing is kept in DB. */
  discardSession: () => Promise<void>;
  addSet: (set: Omit<ActiveSet, 'completed'>) => void;
  completeSet: (exerciseId: string, setNumber: number) => Promise<void>;
  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;
  loadRecentSessions: (days?: number) => Promise<void>;
  loadExercises: () => Promise<void>;
  loadPrograms: () => Promise<void>;
  loadProgramDetail: (programId: string) => Promise<WorkoutProgram | null>;
  setActiveProgram: (programId: string) => Promise<void>;
  addWorkoutDay: (programId: string, name: string, dayOfWeek: number) => Promise<ProgramWorkout | null>;
  deleteWorkoutDay: (workoutId: string) => Promise<void>;
  addExerciseToWorkout: (workoutId: string, exercise: ProgramExerciseInput) => Promise<ProgramExercise | null>;
  updateProgramExercise: (exerciseId: string, data: Partial<ProgramExerciseInput>) => Promise<void>;
  removeProgramExercise: (exerciseId: string) => Promise<void>;
  reorderProgramExercises: (workoutId: string, exerciseIds: string[]) => Promise<void>;
}

/** Series validees d'une seance (plus recentes d'abord). Vide en cas d'erreur de lecture. */
async function fetchCompletedSets(sessionId: string): Promise<Array<{ completed_at?: string | null; created_at?: string | null }>> {
  try {
    const { data } = await supabase
      .from('ziko_session_sets')
      .select('completed_at, created_at')
      .eq('session_id', sessionId)
      .eq('completed', true)
      .order('created_at', { ascending: false });
    return (data ?? []) as Array<{ completed_at?: string | null; created_at?: string | null }>;
  } catch {
    return [];
  }
}

/**
 * Retire une seance ouverte perimee : 'discard' supprime la ligne et ses enfants ; 'autoclose' la termine a
 * l'heure de sa derniere serie. Jamais de credit, jamais d'XP (ne passe PAS par endSession).
 */
async function closeOpenSession(
  session: WorkoutSession,
  verdict: 'discard' | 'autoclose',
  sets: Array<{ completed_at?: string | null; created_at?: string | null }>,
  userId: string,
): Promise<void> {
  try {
    if (verdict === 'discard') {
      await supabase.from('ziko_session_sets').delete().eq('session_id', session.id);
      await supabase.from('ziko_session_exercises').delete().eq('session_id', session.id);
      await supabase.from('ziko_workout_sessions').delete().eq('id', session.id);
    } else {
      const last = sets[0];
      const endedAt = last?.completed_at ?? last?.created_at ?? session.started_at;
      await supabase
        .from('ziko_workout_sessions')
        .update({ ended_at: endedAt, total_sets: sets.length })
        .eq('id', session.id)
        .is('ended_at', null);
    }
  } catch {
    // best effort : la seance reste de toute facon retiree de la reprise ci-dessous
  }
  AsyncStorage.removeItem(sessionKey(userId)).catch(() => {});
  useWorkoutStore.setState({ currentSession: null, activeSets: [], currentWorkoutExercises: [], cycleConfig: null });
}

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  currentSession: null,
  lastCompletedSession: null,
  currentWorkoutExercises: [],
  activeSets: [],
  restTimer: null,
  restTimerMax: 60,
  isTimerRunning: false,
  recentSessions: [],
  exercises: [],
  programs: [],
  activeProgram: null,
  cycleConfig: null,

  setLastCompletedSession: (s) => set({ lastCompletedSession: s }),
  clearLastCompletedSession: () => set({ lastCompletedSession: null }),
  saveSessionNotes: (_id, _notes) => { /* persisted to Supabase in session.tsx before navigation */ },

  // Restore an in-progress session after app restart (fix #19)
  restoreSession: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    try {
      const raw = await AsyncStorage.getItem(sessionKey(user.id));
      if (!raw) return;
      const session = JSON.parse(raw) as WorkoutSession;
      // Validate the session still exists and is not ended
      const { data } = await supabase
        .from('ziko_workout_sessions')
        .select('*')
        .eq('id', session.id)
        .is('ended_at', null)
        .single();
      if (data) {
        const open = data as WorkoutSession;
        // Seance fantome : sans serie validee, ou ouverte depuis trop longtemps, on ne la propose plus.
        const sets = await fetchCompletedSets(open.id);
        const verdict = classifyRestoredSession({ startedAt: open.started_at, completedSets: sets.length });
        if (verdict === 'resume') {
          set({ currentSession: open });
        } else {
          await closeOpenSession(open, verdict, sets, user.id);
        }
      } else {
        await AsyncStorage.removeItem(sessionKey(user.id));
      }
    } catch {
      await AsyncStorage.removeItem(sessionKey(user.id));
    }
  },

  settleStaleSession: async () => {
    const { currentSession } = get();
    const user = useAuthStore.getState().user;
    if (!currentSession || !user) return false;
    // Seance deja ecoulee en memoire : l'anciennete decide (cf. classifyLiveSession).
    const early = classifyLiveSession({ startedAt: currentSession.started_at, completedSets: 1 });
    if (early === 'resume') return false;
    const sets = await fetchCompletedSets(currentSession.id);
    const verdict = classifyLiveSession({ startedAt: currentSession.started_at, completedSets: sets.length });
    if (verdict === 'resume') return false;
    await closeOpenSession(currentSession, verdict, sets, user.id);
    return true;
  },

  startSession: async (programWorkoutId, name) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Load workout exercises if starting from a program
    let workoutExercises: (ProgramExercise & { exercises?: Exercise })[] = [];
    let programId: string | null = null;
    let cycleConfig: WorkoutState['cycleConfig'] = null;
    if (programWorkoutId) {
      const { data: peData } = await supabase
        .from('ziko_program_exercises')
        .select('*, exercises:ziko_exercises(*)')
        .eq('workout_id', programWorkoutId)
        .order('order_index');
      if (peData) workoutExercises = peData as any;

      // Resolve program_id for the session record
      const { data: pwData } = await supabase
        .from('ziko_program_workouts')
        .select('program_id')
        .eq('id', programWorkoutId)
        .single();
      if (pwData) programId = pwData.program_id;

      // Load cycle config from the program
      if (programId) {
        const { data: progData } = await supabase
          .from('ziko_workout_programs')
          .select('cycle_weeks, progression_type, progression_value, current_cycle_week')
          .eq('id', programId)
          .single();
        if (progData?.cycle_weeks && progData?.progression_type && progData?.progression_value) {
          cycleConfig = {
            cycle_weeks: progData.cycle_weeks,
            progression_type: progData.progression_type as 'increment' | 'percentage',
            progression_value: progData.progression_value,
            current_cycle_week: progData.current_cycle_week ?? 1,
          };
        }
      }
    }

    const { data, error } = await supabase
      .from('ziko_workout_sessions')
      .insert({
        user_id: user.id,
        program_workout_id: programWorkoutId ?? null,
        program_id: programId,
        name: name ?? 'Quick Workout',
        started_at: new Date().toISOString(),
        day_of_week: new Date().getDay() || 7,
      })
      .select()
      .single();

    if (!error && data) {
      const session = data as WorkoutSession;
      set({ currentSession: session, activeSets: [], currentWorkoutExercises: workoutExercises, cycleConfig });
      AsyncStorage.setItem(sessionKey(user.id), JSON.stringify(session)).catch(() => {});
    }
  },

  startPlannedSession: async (programId, dayIndex) => {
    const user = useAuthStore.getState().user;
    if (!user) return { ok: false, reason: 'no_user' };

    const { data: program, error: progErr } = await supabase
      .from('ziko_ai_generated_programs')
      .select('id, goal, program_data')
      .eq('id', programId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (progErr) return { ok: false, reason: 'db_error' };
    if (!program) return { ok: false, reason: 'no_program' };

    const plan = normalizePlanSessions((program as any).program_data);
    if (plan.length === 0) return { ok: false, reason: 'no_session' };
    // Same resolution as the week layout: the planned session for that weekday, else the next one.
    let picked = plan.find((p) => p.dayIndex === dayIndex);
    if (!picked) {
      for (let k = 1; k < 7 && !picked; k++) {
        picked = plan.find((p) => p.dayIndex === (dayIndex + k) % 7);
      }
    }
    if (!picked) picked = plan[0];
    if (picked.exercises.length === 0) return { ok: false, reason: 'no_exercises' };

    // Resolve exercise rows : par id d'abord, puis par nom (exact normalise casse/accents, alias, unique plus
    // proche, anglais <-> francais via exerciseNames). Un exercice non resolu NE bloque PAS la seance.
    const ids = picked.exercises.map((e) => e.exercise_id).filter(Boolean) as string[];
    const byId = new Map<string, Exercise>();
    if (ids.length > 0) {
      const { data } = await supabase.from('ziko_exercises').select('*').in('id', ids);
      (data ?? []).forEach((e: any) => byId.set(e.id, e as Exercise));
    }
    const missing = picked.exercises.filter((e) => !e.exercise_id || !byId.has(e.exercise_id));
    let candidates: CatalogRow[] = [];
    if (missing.length > 0) {
      const patterns = [...new Set(missing.flatMap((e) => searchPatternsFor(e.name, exerciseNames)))];
      if (patterns.length > 0) {
        const { data } = await supabase
          .from('ziko_exercises')
          .select('*')
          .or(patterns.flatMap((p) => [`name.ilike.${p}`, `name_fr.ilike.${p}`]).join(','))
          .limit(300);
        candidates = (data ?? []) as CatalogRow[];
      }
    }
    const unresolved: string[] = [];

    const workoutExercises: WorkoutState['currentWorkoutExercises'] = [];
    const replaced: Array<{ from: string; to: string }> = [];
    picked.exercises.forEach((pe) => {
      let ex: any = (pe.exercise_id && byId.get(pe.exercise_id)) || null;
      if (!ex) {
        const m = matchExercise(pe.name, candidates, exerciseNames);
        if (m) {
          ex = m.row;
          if (m.kind === 'approx') replaced.push({ from: pe.name, to: String(m.row.name ?? m.row.name_fr ?? '') });
        }
      }
      if (!ex) {
        unresolved.push(pe.name); // cannot log sets without a real exercise row (FK)
        return;
      }
      const r = parseReps(pe.reps);
      workoutExercises.push({
        id: `planned-${picked!.sourceIndex}-${workoutExercises.length}`,
        workout_id: '',
        exercise_id: (ex as any).id,
        sets: pe.sets,
        reps: r.reps,
        reps_min: r.reps_min,
        reps_max: r.reps_max,
        duration_seconds: null,
        duration_min: null,
        duration_max: null,
        rest_seconds: pe.rest_seconds ?? null,
        weight_kg: null,
        notes: null,
        order_index: workoutExercises.length,
        exercises: ex,
        isPlanned: true,
      } as any);
    });
    if (workoutExercises.length === 0) return { ok: false, reason: 'no_exercises', unresolved };

    const { data, error } = await supabase
      .from('ziko_workout_sessions')
      .insert({
        user_id: user.id,
        program_workout_id: null,
        program_id: null,
        name: picked.name,
        started_at: new Date().toISOString(),
        day_of_week: new Date().getDay() || 7,
      })
      .select()
      .single();
    if (error || !data) return { ok: false, reason: 'db_error' };

    const session = data as WorkoutSession;
    set({ currentSession: session, activeSets: [], currentWorkoutExercises: workoutExercises, cycleConfig: null });
    AsyncStorage.setItem(sessionKey(user.id), JSON.stringify(session)).catch(() => {});
    return { ok: true, name: picked.name, exerciseCount: workoutExercises.length, unresolved, replaced };
  },

  discardSession: async () => {
    const { currentSession } = get();
    const user = useAuthStore.getState().user;
    if (currentSession) {
      try {
        await supabase.from('ziko_session_sets').delete().eq('session_id', currentSession.id);
        await supabase.from('ziko_session_exercises').delete().eq('session_id', currentSession.id);
        await supabase.from('ziko_workout_sessions').delete().eq('id', currentSession.id);
      } catch {
        // best effort: orphan rows without sets are excluded from every counter anyway
      }
    }
    if (user) AsyncStorage.removeItem(sessionKey(user.id)).catch(() => {});
    set({ currentSession: null, activeSets: [], currentWorkoutExercises: [], cycleConfig: null });
  },

  endSession: async () => {
    const { currentSession } = get();
    const user = useAuthStore.getState().user;
    if (!currentSession) return;

    // Only set ended_at if not already set (saveSessionStats may have already updated it)
    if (!currentSession.ended_at) {
      await supabase
        .from('ziko_workout_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', currentSession.id);
    }

    // Earn credit and show toast if credited (D-09): session UUID as idempotency key
    callCreditsEarnWithResult(supabase, 'workout', currentSession.id).then((result) => {
      if (result.credited) {
        const { useCreditStore } = require('../stores/creditStore');
        useCreditStore.getState().showEarnToast();
      }
    });

    if (user) AsyncStorage.removeItem(sessionKey(user.id)).catch(() => {});
    set({ currentSession: null, activeSets: [], currentWorkoutExercises: [], cycleConfig: null });
  },

  addSet: (setData) =>
    set((s) => ({
      activeSets: [...s.activeSets, { ...setData, completed: false }],
    })),

  completeSet: async (exerciseId, setNumber) => {
    const { currentSession, activeSets } = get();
    if (!currentSession) return;

    const setData = activeSets.find(
      (s) => s.exerciseId === exerciseId && s.setNumber === setNumber,
    );
    if (!setData) return;

    await supabase.from('ziko_session_sets').upsert(
      {
        session_id: currentSession.id,
        exercise_id: exerciseId,
        set_number: setNumber,
        reps: setData.reps,
        weight_kg: setData.weight_kg,
        duration_seconds: setData.duration_seconds,
        completed: true,
      },
      { onConflict: 'session_id,exercise_id,set_number' },
    );

    set((s) => ({
      activeSets: s.activeSets.map((a) =>
        a.exerciseId === exerciseId && a.setNumber === setNumber
          ? { ...a, completed: true }
          : a,
      ),
    }));
  },

  startRestTimer: (seconds) =>
    set({ restTimer: seconds, restTimerMax: seconds, isTimerRunning: true }),

  stopRestTimer: () =>
    set({ restTimer: null, isTimerRunning: false }),

  tickRestTimer: () =>
    set((s) => {
      if (!s.isTimerRunning || s.restTimer === null) return s;
      const next = s.restTimer - 1;
      if (next <= 0) return { restTimer: 0, isTimerRunning: false };
      return { restTimer: next };
    }),

  loadRecentSessions: async (days = 30) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await supabase
      .from('ziko_workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false });

    // TRAIN-03: sessions without any validated set are not shown nor counted
    if (data) set({ recentSessions: filterCountableSessions(data as WorkoutSession[]) });
  },

  loadExercises: async () => {
    const { data } = await supabase
      .from('ziko_exercises')
      .select('*')
      .order('name');

    if (data) set({ exercises: data as Exercise[] });
  },

  loadPrograms: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const { data } = await supabase
      .from('ziko_workout_programs')
      .select('*, program_workouts:ziko_program_workouts(*, program_exercises:ziko_program_exercises(*, exercises:ziko_exercises(name, name_fr, muscle_groups, category)))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const programs = data as WorkoutProgram[];
      // P7 (D-09): no auto-activation. 0 active program is a valid state; activation is explicit.
      const active = programs.find((p) => p.is_active) ?? null;

      set({ programs, activeProgram: active });
    }
  },

  loadProgramDetail: async (programId) => {
    const { data } = await supabase
      .from('ziko_workout_programs')
      .select('*, program_workouts:ziko_program_workouts(*, program_exercises:ziko_program_exercises(*, exercises:ziko_exercises(name, name_fr, muscle_groups, body_part, equipment, target_muscle)))')
      .eq('id', programId)
      .single();

    return (data as WorkoutProgram) ?? null;
  },

  setActiveProgram: async (programId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // P7 (TRAIN-07): single atomic path (deactivates every program of the user, both tables,
    // then activates this one). Replaces the old non-atomic "update all false / update one true".
    const { error } = await supabase.rpc('ziko_set_active_program', {
      p_kind: 'workout',
      p_program_id: programId,
    });
    if (error) throw new Error(error.message);

    // Reload
    await get().loadPrograms();
  },

  addWorkoutDay: async (programId, name, dayOfWeek) => {
    const { data } = await supabase
      .from('ziko_program_workouts')
      .insert({ program_id: programId, name, day_of_week: dayOfWeek, order_index: dayOfWeek })
      .select()
      .single();

    return (data as ProgramWorkout) ?? null;
  },

  deleteWorkoutDay: async (workoutId) => {
    await supabase.from('ziko_program_workouts').delete().eq('id', workoutId);
  },

  addExerciseToWorkout: async (workoutId, exercise) => {
    const { data } = await supabase
      .from('ziko_program_exercises')
      .insert({ workout_id: workoutId, ...exercise })
      .select('*, exercises:ziko_exercises(name, name_fr, muscle_groups)')
      .single();

    return (data as ProgramExercise) ?? null;
  },

  updateProgramExercise: async (exerciseId, updates) => {
    await supabase
      .from('ziko_program_exercises')
      .update(updates)
      .eq('id', exerciseId);
  },

  removeProgramExercise: async (exerciseId) => {
    await supabase
      .from('ziko_program_exercises')
      .delete()
      .eq('id', exerciseId);
  },

  reorderProgramExercises: async (workoutId, exerciseIds) => {
    const updates = exerciseIds.map((id, idx) =>
      supabase.from('ziko_program_exercises').update({ order_index: idx }).eq('id', id)
    );
    await Promise.all(updates);
  },
}));
