'use client';

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import type { DashboardConfig } from '@/types/dashboard';

export function useDashboardConfig(clientId: string): UseQueryResult<DashboardConfig> {
  return useQuery<DashboardConfig>({
    queryKey: ['dashboard-config', clientId],
    queryFn: async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      );
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      const jwt = session.access_token;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/coach/dashboards/${clientId}`,
        {
          headers: { Authorization: 'Bearer ' + jwt },
          credentials: 'include',
        },
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch dashboard config: ${res.status}`);
      }
      return res.json() as Promise<DashboardConfig>;
    },
    staleTime: 60_000,
    enabled: !!clientId,
  });
}
