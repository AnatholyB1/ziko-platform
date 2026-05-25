import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserPrefsState {
  units: 'metric' | 'imperial';
  language: 'fr' | 'en';
  region: string;
  setPrefs: (p: Partial<Omit<UserPrefsState, 'setPrefs'>>) => void;
}

export const useUserPrefsStore = create<UserPrefsState>()(
  persist(
    (set) => ({
      units: 'metric',
      language: 'fr',
      region: 'FR',
      setPrefs: (p) => set(p),
    }),
    {
      name: 'user-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
