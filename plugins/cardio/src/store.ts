import { create } from 'zustand';

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: number;
  altitude?: number;
}

export interface CardioSession {
  id: string;
  user_id: string;
  title: string | null;
  activity_type: 'running' | 'cycling' | 'swimming' | 'hiit' | 'walking' | 'elliptical' | 'rowing' | 'other' | 'hyrox' | 'functional';
  duration_min: number;
  distance_km: number | null;
  calories_burned: number | null;
  avg_heart_rate: number | null;
  avg_pace_sec_per_km: number | null;
  elevation_gain_m: number | null;
  max_speed_kmh: number | null;
  route_data: RoutePoint[] | null;
  notes: string;
  date: string;
  created_at: string;
}

interface CardioStore {
  sessions: CardioSession[];
  loading: boolean;
  setSessions: (sessions: CardioSession[]) => void;
  addSession: (session: CardioSession) => void;
  setLoading: (loading: boolean) => void;
  getTotalDistance: (days: number) => number;
  getTotalDuration: (days: number) => number;
  getSessionCount: (days: number) => number;
}

export const ACTIVITY_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  running: { label: 'Course', emoji: '🏃', color: '#FF5722' },
  cycling: { label: 'Vélo', emoji: '🚴', color: '#2196F3' },
  swimming: { label: 'Natation', emoji: '🏊', color: '#00BCD4' },
  hiit: { label: 'HIIT', emoji: '⚡', color: '#FF9800' },
  walking: { label: 'Marche', emoji: '🚶', color: '#4CAF50' },
  elliptical: { label: 'Elliptique', emoji: '🏋️', color: '#9C27B0' },
  rowing: { label: 'Rameur', emoji: '🚣', color: '#607D8B' },
  hyrox: { label: 'Hyrox', emoji: '🏆', color: '#FF5C1A' },
  functional: { label: 'Fonctionnel', emoji: '🔥', color: '#4CAF50' },
  other: { label: 'Autre', emoji: '💪', color: '#795548' },
};

export const useCardioStore = create<CardioStore>((set, get) => ({
  sessions: [],
  loading: false,
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions] })),
  setLoading: (loading) => set({ loading }),

  getTotalDistance: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return get().sessions
      .filter((s) => new Date(s.date) >= cutoff && s.distance_km)
      .reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
  },

  getTotalDuration: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return get().sessions
      .filter((s) => new Date(s.date) >= cutoff)
      .reduce((sum, s) => sum + s.duration_min, 0);
  },

  getSessionCount: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return get().sessions.filter((s) => new Date(s.date) >= cutoff).length;
  },
}));

export function formatPace(secPerKm: number | null): string {
  if (!secPerKm || secPerKm <= 0) return '—';
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}/km`;
}
