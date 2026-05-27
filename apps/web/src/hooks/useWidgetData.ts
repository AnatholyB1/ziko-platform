'use client';

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';

export function useWidgetData(
  clientId: string,
  type: string,
  period: string,
  dataKey: string,
): UseQueryResult<unknown> {
  return useQuery<unknown>({
    queryKey: ['widget-data', clientId, type, period, dataKey],
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

      const params = new URLSearchParams({ type, period, dataKey });
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/coach/clients/${clientId}/widget-data?${params.toString()}`,
        {
          headers: { Authorization: 'Bearer ' + jwt },
          credentials: 'include',
        },
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch widget data: ${res.status}`);
      }
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!clientId && !!type,
  });
}

export type WidgetDataResult = ReturnType<typeof useWidgetData>;
