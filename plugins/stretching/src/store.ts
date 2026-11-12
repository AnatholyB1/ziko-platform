import { create } from 'zustand';
import type { RoutineExercise, RoutineRow } from './lib';

// Types historiquement exportes par le plugin (index.ts) : alias des types de lib.ts.
export type StretchExercise = RoutineExercise;
export type StretchRoutine = RoutineRow;

export interface StretchLog {
  id: string;
  user_id: string;
  routine_id: string | null;
  routine_name: string;
  duration_sec: number;
  date: string;
}

// Etat de la lecture guidee d'une routine uniquement : les routines, la bibliotheque et les logs
// viennent de TanStack Query (cle [ressource, userId]) et de Supabase.
interface StretchingState {
  activeRoutine: StretchRoutine | null;
  currentExerciseIndex: number;
  startRoutine: (r: StretchRoutine) => void;
  nextExercise: () => void;
  stopRoutine: () => void;
}

export const useStretchingStore = create<StretchingState>()((set, get) => ({
  activeRoutine: null,
  currentExerciseIndex: 0,
  startRoutine: (routine) => set({ activeRoutine: routine, currentExerciseIndex: 0 }),
  nextExercise: () => {
    const { activeRoutine, currentExerciseIndex } = get();
    if (!activeRoutine) return;
    if (currentExerciseIndex < activeRoutine.exercises.length - 1) {
      set({ currentExerciseIndex: currentExerciseIndex + 1 });
    }
  },
  stopRoutine: () => set({ activeRoutine: null, currentExerciseIndex: 0 }),
}));
