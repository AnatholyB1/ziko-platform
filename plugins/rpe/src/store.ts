import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RPEStoreState {
  lastWeight: number;
  lastReps: number;
  lastRpe: number;
  setLast: (w: number, r: number, rpe: number) => void;
}

export const useRpeStore = create<RPEStoreState>()(
  persist(
    (set) => ({
      lastWeight: 100,
      lastReps: 5,
      lastRpe: 8,
      setLast: (w, r, rpe) => set({ lastWeight: w, lastReps: r, lastRpe: rpe }),
    }),
    {
      name: 'rpe-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
