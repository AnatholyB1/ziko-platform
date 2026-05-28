'use client';

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import type { Widget } from '@/types/dashboard';

export interface CoachMemoryPreferences {
  preferred_period?: '7d' | '30d' | '90d';
  preferred_widgets?: string[];
  preferred_chart_type?: 'line' | 'bar';
}

export interface CoachMemoryTemplate {
  id: string;
  name: string;
  widgets: Widget[];
  created_at: string;
}

export interface CoachMemoryData {
  preferences: CoachMemoryPreferences;
  templates: CoachMemoryTemplate[];
  recent_actions: string[];
}

const EMPTY_DEFAULTS: CoachMemoryData = {
  preferences: {},
  templates: [],
  recent_actions: [],
};

export function useCoachMemory(): UseQueryResult<CoachMemoryData> {
  return useQuery<CoachMemoryData>({
    queryKey: ['coach-memory'],
    queryFn: async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      const jwt = session.access_token;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/coach/dashboards/memory`,
        {
          headers: { Authorization: 'Bearer ' + jwt },
          credentials: 'include',
        },
      );

      if (res.status === 404) {
        // No memory record yet — return empty defaults instead of throwing
        return EMPTY_DEFAULTS;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch coach memory: ${res.status}`);
      }

      return res.json() as Promise<CoachMemoryData>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
