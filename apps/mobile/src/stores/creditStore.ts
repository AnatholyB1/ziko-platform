import { create } from 'zustand';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface CreditExhaustionData {
  balance: number;
  required: number;
  earned_today: string[];
  earn_hint: string;
  reset_timestamp: string;
}

interface CreditState {
  // Balance data (D-03)
  balance: number;
  dailyEarned: number;
  dailyCap: number;
  resetTimestamp: string | null;

  // Toast state (D-06)
  toastVisible: boolean;

  // Exhaustion sheet state (D-10, D-11)
  exhaustionVisible: boolean;
  exhaustionData: CreditExhaustionData | null;

  // Actions
  fetchBalance: (accessToken: string) => Promise<void>;
  showEarnToast: () => void;
  hideEarnToast: () => void;
  showExhaustionSheet: (data: CreditExhaustionData) => void;
  hideExhaustionSheet: () => void;
}

export const useCreditStore = create<CreditState>()((set) => ({
  balance: 0,
  dailyEarned: 0,
  dailyCap: 4,
  resetTimestamp: null,
  toastVisible: false,
  exhaustionVisible: false,
  exhaustionData: null,

  fetchBalance: async (accessToken: string) => {
    try {
      const res = await fetch(`${API_URL}/credits/balance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      set({
        balance: data.balance,
        dailyEarned: data.daily_earned,
        dailyCap: data.daily_cap,
        resetTimestamp: data.reset_timestamp,
      });
    } catch {
      // Silently fail — balance display is informational
    }
  },

  showEarnToast: () => set({ toastVisible: true }),
  hideEarnToast: () => set({ toastVisible: false }),
  showExhaustionSheet: (data) => set({ exhaustionVisible: true, exhaustionData: data }),
  hideExhaustionSheet: () => set({ exhaustionVisible: false, exhaustionData: null }),
}));
