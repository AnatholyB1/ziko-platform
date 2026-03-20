import { create } from 'zustand';

interface CopiedExercise {
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

interface CopiedDay {
  name: string;
  day_of_week: number | null;
  exercises: CopiedExercise[];
}

interface ClipboardState {
  copiedDay: CopiedDay | null;
  copyDay: (day: CopiedDay) => void;
  clearClipboard: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  copiedDay: null,
  copyDay: (day) => set({ copiedDay: day }),
  clearClipboard: () => set({ copiedDay: null }),
}));
