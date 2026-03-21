import { create } from 'zustand';

export interface TimerPreset {
  id: string;
  name: string;
  type: 'hiit' | 'tabata' | 'emom' | 'custom';
  work_seconds: number;
  rest_seconds: number;
  rounds: number;
  is_builtin: boolean;
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

  setPresets: (p: TimerPreset[]) => void;
  setCustomPresets: (p: TimerPreset[]) => void;
  startTimer: (preset: TimerPreset) => void;
  tick: () => boolean; // returns true if timer ended
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

  setPresets: (presets) => set({ presets }),
  setCustomPresets: (customPresets) => set({ customPresets }),

  startTimer: (preset) => set({
    activePreset: preset,
    currentRound: 1,
    timeLeft: preset.work_seconds > 0 ? preset.work_seconds : preset.rest_seconds,
    isWork: preset.work_seconds > 0,
    isRunning: true,
    isPaused: false,
  }),

  tick: () => {
    const { timeLeft, isWork, currentRound, activePreset } = get();
    if (!activePreset) return true;

    if (timeLeft > 1) {
      set({ timeLeft: timeLeft - 1 });
      return false;
    }

    // Time's up for this interval
    if (isWork && activePreset.rest_seconds > 0) {
      // Switch to rest
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
  stopTimer: () => set({ activePreset: null, isRunning: false, isPaused: false, currentRound: 1, timeLeft: 0 }),
}));

export { BUILTIN_PRESETS };
