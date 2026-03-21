import { create } from 'zustand';

export interface StretchExercise {
  id: string;
  name: string;
  muscle_group: string;
  duration_seconds: number;
  instructions: string;
  image_url: string | null;
}

export interface StretchRoutine {
  id: string;
  name: string;
  type: 'pre_workout' | 'post_workout' | 'recovery' | 'full_body';
  muscle_groups: string[];
  duration_minutes: number;
  exercises: StretchExercise[];
}

export interface StretchLog {
  id: string;
  user_id: string;
  routine_id: string | null;
  routine_name: string;
  duration_seconds: number;
  date: string;
}

interface StretchingState {
  routines: StretchRoutine[];
  logs: StretchLog[];
  isLoading: boolean;
  activeRoutine: StretchRoutine | null;
  currentExerciseIndex: number;

  setRoutines: (r: StretchRoutine[]) => void;
  setLogs: (l: StretchLog[]) => void;
  setIsLoading: (b: boolean) => void;
  startRoutine: (r: StretchRoutine) => void;
  nextExercise: () => void;
  stopRoutine: () => void;
}

export const useStretchingStore = create<StretchingState>()((set, get) => ({
  routines: [],
  logs: [],
  isLoading: false,
  activeRoutine: null,
  currentExerciseIndex: 0,

  setRoutines: (routines) => set({ routines }),
  setLogs: (logs) => set({ logs }),
  setIsLoading: (isLoading) => set({ isLoading }),
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
