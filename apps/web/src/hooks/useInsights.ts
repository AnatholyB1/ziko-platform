'use client';

import { useQuery } from '@tanstack/react-query';

export interface InsightsResult {
  chartInsights: Record<string, string>;
  narrative: string;
  crossedThresholds: Array<{
    metric_key: string;
    operator: string;
    threshold_value: number;
    current_value: number;
  }>;
}

export function useInsights(
  clientId: string,
  sport: string | null,
  dateRange: string,
  chartData: Record<string, unknown> | null,
) {
  return useQuery<InsightsResult>({
    queryKey: ['dashboard-insights', clientId, sport, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/coach/dashboards/${clientId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, period: dateRange, chartData }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    },
    enabled: !!sport && !!chartData,
    staleTime: 120_000,
    gcTime: 300_000,
  });
}
