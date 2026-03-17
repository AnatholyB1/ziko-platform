import { create } from 'zustand';
import type { WorkoutSession, Exercise } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

interface ActiveSet {
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  completed: boolean;
}

interface WorkoutState {
  currentSession: WorkoutSession | null;
  activeSets: ActiveSet[];
  restTimer: number | null;
  restTimerMax: number;
  isTimerRunning: boolean;
  recentSessions: WorkoutSession[];
  exercises: Exercise[];

  startSession: (programWorkoutId?: string, name?: string) => Promise<void>;
  endSession: () => Promise<void>;
  addSet: (set: Omit<ActiveSet, 'completed'>) => void;
  completeSet: (exerciseId: string, setNumber: number) => Promise<void>;
  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;
  loadRecentSessions: (days?: number) => Promise<void>;
  loadExercises: () => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>()((set, get) => ({
  currentSession: null,
  activeSets: [],
  restTimer: null,
  restTimerMax: 60,
  isTimerRunning: false,
  recentSessions: [],
  exercises: [],

  startSession: async (programWorkoutId, name) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        program_workout_id: programWorkoutId ?? null,
        name: name ?? 'Quick Workout',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      set({ currentSession: data as WorkoutSession, activeSets: [] });
    }
  },

  endSession: async () => {
    const { currentSession, activeSets } = get();
    if (!currentSession) return;

    const totalVolume = activeSets
      .filter((s) => s.completed && s.weight_kg && s.reps)
      .reduce((acc, s) => acc + (s.weight_kg! * s.reps!), 0);

    await supabase
      .from('workout_sessions')
      .update({
        ended_at: new Date().toISOString(),
        total_volume_kg: totalVolume,
      })
      .eq('id', currentSession.id);

    set({ currentSession: null, activeSets: [] });
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
}));
