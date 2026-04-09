import { create } from 'zustand';
import type { WorkoutSession, Exercise, WorkoutProgram, ProgramWorkout, ProgramExercise } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { callCreditsEarn, callCreditsEarnWithResult } from '../lib/earnCredits';

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

interface WorkoutState {
  currentSession: WorkoutSession | null;
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

  startSession: (programWorkoutId?: string, name?: string) => Promise<void>;
  endSession: () => Promise<void>;
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

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  currentSession: null,
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

  startSession: async (programWorkoutId, name) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Load workout exercises if starting from a program
    let workoutExercises: (ProgramExercise & { exercises?: Exercise })[] = [];
    let programId: string | null = null;
    let cycleConfig: WorkoutState['cycleConfig'] = null;
    if (programWorkoutId) {
      const { data: peData } = await supabase
        .from('program_exercises')
        .select('*, exercises(*)')
        .eq('workout_id', programWorkoutId)
        .order('order_index');
      if (peData) workoutExercises = peData as any;

      // Resolve program_id for the session record
      const { data: pwData } = await supabase
        .from('program_workouts')
        .select('program_id')
        .eq('id', programWorkoutId)
        .single();
      if (pwData) programId = pwData.program_id;

      // Load cycle config from the program
      if (programId) {
        const { data: progData } = await supabase
          .from('workout_programs')
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
      .from('workout_sessions')
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
      set({ currentSession: data as WorkoutSession, activeSets: [], currentWorkoutExercises: workoutExercises, cycleConfig });
    }
  },

  endSession: async () => {
    const { currentSession } = get();
    if (!currentSession) return;

    // Only set ended_at if not already set (saveSessionStats may have already updated it)
    if (!currentSession.ended_at) {
      await supabase
        .from('workout_sessions')
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

    await supabase.from('session_sets').insert({
      session_id: currentSession.id,
      exercise_id: exerciseId,
      set_number: setNumber,
      reps: setData.reps,
      weight_kg: setData.weight_kg,
      duration_seconds: setData.duration_seconds,
      completed: true,
    });

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
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false });

    if (data) set({ recentSessions: data as WorkoutSession[] });
  },

  loadExercises: async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('name');

    if (data) set({ exercises: data as Exercise[] });
  },

  loadPrograms: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const { data } = await supabase
      .from('workout_programs')
      .select('*, program_workouts(*, program_exercises(*, exercises(name, muscle_groups, category)))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const programs = data as WorkoutProgram[];
      let active = programs.find((p) => p.is_active) ?? null;

      // Auto-activate if there are programs but none is active
      if (!active && programs.length > 0) {
        const first = programs[0];
        await supabase.from('workout_programs').update({ is_active: true }).eq('id', first.id);
        first.is_active = true;
        active = first;
      }

      set({ programs, activeProgram: active });
    }
  },

  loadProgramDetail: async (programId) => {
    const { data } = await supabase
      .from('workout_programs')
      .select('*, program_workouts(*, program_exercises(*, exercises(name, muscle_groups, body_part, equipment, target_muscle)))')
      .eq('id', programId)
      .single();

    return (data as WorkoutProgram) ?? null;
  },

  setActiveProgram: async (programId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Deactivate all first
    await supabase
      .from('workout_programs')
      .update({ is_active: false })
      .eq('user_id', user.id);

    // Activate selected
    await supabase
      .from('workout_programs')
      .update({ is_active: true })
      .eq('id', programId);

    // Reload
    await get().loadPrograms();
  },

  addWorkoutDay: async (programId, name, dayOfWeek) => {
    const { data } = await supabase
      .from('program_workouts')
      .insert({ program_id: programId, name, day_of_week: dayOfWeek, order_index: dayOfWeek })
      .select()
      .single();

    return (data as ProgramWorkout) ?? null;
  },

  deleteWorkoutDay: async (workoutId) => {
    await supabase.from('program_workouts').delete().eq('id', workoutId);
  },

  addExerciseToWorkout: async (workoutId, exercise) => {
    const { data } = await supabase
      .from('program_exercises')
      .insert({ workout_id: workoutId, ...exercise })
      .select('*, exercises(name, muscle_groups)')
      .single();

    return (data as ProgramExercise) ?? null;
  },

  updateProgramExercise: async (exerciseId, updates) => {
    await supabase
      .from('program_exercises')
      .update(updates)
      .eq('id', exerciseId);
  },

  removeProgramExercise: async (exerciseId) => {
    await supabase
      .from('program_exercises')
      .delete()
      .eq('id', exerciseId);
  },

  reorderProgramExercises: async (workoutId, exerciseIds) => {
    const updates = exerciseIds.map((id, idx) =>
      supabase.from('program_exercises').update({ order_index: idx }).eq('id', id)
    );
    await Promise.all(updates);
  },
}));
