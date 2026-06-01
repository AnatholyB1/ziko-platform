import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditExhaustionData {
  balance: number;
  required: number;
  earned_today: string[];
  earn_hint: string;
  reset_timestamp: string;
}

interface CreditState {
  // Balance data
  balance: number;
  dailyEarned: number;
  dailyCap: number;
  resetTimestamp: string | null;

  // Toast state
  toastVisible: boolean;

  // Exhaustion sheet state
  exhaustionVisible: boolean;
  exhaustionData: CreditExhaustionData | null;

  // Actions
  fetchBalance: (accessToken: string) => Promise<void>;
  showEarnToast: () => void;
  hideEarnToast: () => void;
  showExhaustionSheet: (data: CreditExhaustionData) => void;
  hideExhaustionSheet: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const API_URL =
  typeof process !== 'undefined'
    ? (process.env.EXPO_PUBLIC_API_URL ?? '')
    : '';

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
