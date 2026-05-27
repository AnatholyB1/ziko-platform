'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createClientSupabase } from '@/lib/supabase/client';
import { fetchRunningData } from '@/lib/dashboard/running';
import { ChartCard } from './ChartCard';
import { DashboardLoadingState } from './DashboardLoadingState';
import { DashboardEmptyState } from './DashboardEmptyState';

const supabase = createClientSupabase();

const SHARED_AXIS_PROPS = {
  tick: { fontSize: 11, fill: '#6B6963' },
  axisLine: false as const,
  tickLine: false as const,
};

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E0DA',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#1C1A17',
  },
};

const CHART_MARGIN = { top: 5, right: 8, left: -16, bottom: 5 };

export function RunningDashboard({
  clientId,
  sport,
  dateRange,
}: {
  clientId: string;
  sport: string | null;
  dateRange: 'week' | 'month' | '3m';
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['running', clientId, sport, dateRange],
    queryFn: () => fetchRunningData(supabase, clientId, dateRange),
    enabled: sport === 'running',
    staleTime: 60_000,
  });

  if (isLoading) return <DashboardLoadingState />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Erreur de chargement des données. Actualisez la page ou réessayez dans un instant.
      </div>
    );
  }

  if (
    !data ||
    (data.paceTrend.length === 0 &&
      data.weeklyDistance.length === 0 &&
      data.sessionDistances.length === 0)
  ) {
    return <DashboardEmptyState prompt={false} />;
  }

  const CHART_CARDS = [
    {
      title: 'Allure (min/km)',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.paceTrend} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="pace_min_per_km"
              name="Allure (min/km)"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Distance Hebdomadaire (km)',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.weeklyDistance} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="week" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Area
              type="monotone"
              dataKey="distance_km"
              name="Distance (km)"
              stroke="#22C55E"
              fill="#22C55E"
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'VO2max Estime',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.vo2maxTrend} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="vo2max"
              name="VO2max"
              stroke="#A855F7"
              strokeWidth={2}
              dot={{ r: 3, fill: '#A855F7' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Distance par Seance',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.sessionDistances} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="distance_km" name="Distance (km)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {CHART_CARDS.map((card, i) => (
        <div
          key={i}
          className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <ChartCard title={card.title}>{card.chart}</ChartCard>
        </div>
      ))}
    </div>
  );
}
