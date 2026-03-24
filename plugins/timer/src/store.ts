import { create } from 'zustand';

export interface TimerExercise {
  name: string;
  reps?: number;
  distance_m?: number;
  weight_kg?: number;
  notes?: string;
}

export interface TimerPreset {
  id: string;
  name: string;
  type: 'hiit' | 'tabata' | 'emom' | 'custom' | 'hyrox' | 'functional';
  work_seconds: number;
  rest_seconds: number;
  rounds: number;
  is_builtin: boolean;
  exercises?: TimerExercise[];
}

interface TimerState {
  presets: TimerPreset[];
  customPresets: TimerPreset[];
  activePreset: TimerPreset | null;
  currentRound: number;
  timeLeft: number;
  isWork: boolean;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  startedAt: number | null;

  setPresets: (p: TimerPreset[]) => void;
  setCustomPresets: (p: TimerPreset[]) => void;
  addCustomPreset: (p: TimerPreset) => void;
  removeCustomPreset: (id: string) => void;
  updateCustomPreset: (id: string, p: Partial<TimerPreset>) => void;
  startTimer: (preset: TimerPreset) => void;
  tick: () => boolean;
  togglePause: () => void;
  stopTimer: () => void;
}

const BUILTIN_PRESETS: TimerPreset[] = [
  { id: 'tabata', name: 'Tabata', type: 'tabata', work_seconds: 20, rest_seconds: 10, rounds: 8, is_builtin: true },
  { id: 'hiit-30-30', name: 'HIIT 30/30', type: 'hiit', work_seconds: 30, rest_seconds: 30, rounds: 10, is_builtin: true },
  { id: 'hiit-40-20', name: 'HIIT 40/20', type: 'hiit', work_seconds: 40, rest_seconds: 20, rounds: 8, is_builtin: true },
  { id: 'emom-1', name: 'EMOM 1 min', type: 'emom', work_seconds: 60, rest_seconds: 0, rounds: 10, is_builtin: true },
  { id: 'emom-2', name: 'EMOM 2 min', type: 'emom', work_seconds: 120, rest_seconds: 0, rounds: 5, is_builtin: true },
  { id: 'rest-60', name: 'Repos 60s', type: 'custom', work_seconds: 0, rest_seconds: 60, rounds: 1, is_builtin: true },
  { id: 'rest-90', name: 'Repos 90s', type: 'custom', work_seconds: 0, rest_seconds: 90, rounds: 1, is_builtin: true },
  {
    id: 'hyrox-classic',
    name: 'Hyrox Classic',
    type: 'hyrox',
    work_seconds: 300,
    rest_seconds: 60,
    rounds: 8,
    is_builtin: true,
    exercises: [
      { name: 'Ski Erg', distance_m: 1000 },
      { name: 'Sled Push', distance_m: 50, notes: '~102 kg' },
      { name: 'Sled Pull', distance_m: 50 },
      { name: 'Burpee Broad Jumps', distance_m: 80 },
      { name: 'Rowing', distance_m: 1000 },
      { name: "Farmer's Carry", distance_m: 200, weight_kg: 24 },
      { name: 'Sandbag Lunges', distance_m: 100, weight_kg: 20 },
      { name: 'Wall Balls', reps: 100, weight_kg: 6 },
    ],
  },
  {
    id: 'functional-hiit',
    name: 'Functional HIIT',
    type: 'functional',
    work_seconds: 45,
    rest_seconds: 15,
    rounds: 6,
    is_builtin: true,
    exercises: [
      { name: 'Kettlebell Swings', reps: 20, weight_kg: 16 },
      { name: 'Box Jumps', reps: 10 },
      { name: 'Burpees', reps: 8 },
      { name: 'Battle Ropes', notes: '45s continu' },
      { name: 'Tire Flips', reps: 5, notes: 'ou med ball slam' },
      { name: 'Sled Push', distance_m: 20 },
    ],
  },
];

export const useTimerStore = create<TimerState>()((set, get) => ({
  presets: BUILTIN_PRESETS,
  customPresets: [],
  activePreset: null,
  currentRound: 1,
  timeLeft: 0,
  isWork: true,
  isRunning: false,
  isPaused: false,
  elapsedSeconds: 0,
  startedAt: null,

  setPresets: (presets) => set({ presets }),
  setCustomPresets: (customPresets) => set({ customPresets }),
  addCustomPreset: (preset) => set((s) => ({ customPresets: [...s.customPresets, preset] })),
  removeCustomPreset: (id) => set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) })),
  updateCustomPreset: (id, updates) => set((s) => ({
    customPresets: s.customPresets.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  })),

  startTimer: (preset) => set({
    activePreset: preset,
    currentRound: 1,
    timeLeft: preset.work_seconds > 0 ? preset.work_seconds : preset.rest_seconds,
    isWork: preset.work_seconds > 0,
    isRunning: true,
    isPaused: false,
    elapsedSeconds: 0,
    startedAt: Date.now(),
  }),

  tick: () => {
    const { timeLeft, isWork, currentRound, activePreset, elapsedSeconds } = get();
    if (!activePreset) return true;

    set({ elapsedSeconds: elapsedSeconds + 1 });

    if (timeLeft > 1) {
      set({ timeLeft: timeLeft - 1 });
      return false;
    }

    // Time's up for this interval
    if (isWork && activePreset.rest_seconds > 0) {
      set({ timeLeft: activePreset.rest_seconds, isWork: false });
      return false;
    }

    // End of rest (or no rest) → next round
    if (currentRound < activePreset.rounds) {
      set({
        currentRound: currentRound + 1,
        timeLeft: activePreset.work_seconds > 0 ? activePreset.work_seconds : activePreset.rest_seconds,
        isWork: activePreset.work_seconds > 0,
      });
      return false;
    }

    // All rounds done
    set({ isRunning: false, isPaused: false });
    return true;
  },

  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  stopTimer: () => set({
    activePreset: null, isRunning: false, isPaused: false,
    currentRound: 1, timeLeft: 0, elapsedSeconds: 0, startedAt: null,
  }),
}));

export { BUILTIN_PRESETS };
