import { create } from 'zustand';

// Tiny shared flag so passive toasts (Phase 46 unlock toast) can queue behind a
// blocking full-screen overlay. WeeklyReviewRevealOverlay must publish its
// visibility: useEffect(() => setWeeklyReviewOpen(isVisible), [isVisible]).
interface OverlayGateState {
  weeklyReviewOpen: boolean;
  setWeeklyReviewOpen: (open: boolean) => void;
}

export const useOverlayGateStore = create<OverlayGateState>()((set) => ({
  weeklyReviewOpen: false,
  setWeeklyReviewOpen: (open) => set({ weeklyReviewOpen: open }),
}));
