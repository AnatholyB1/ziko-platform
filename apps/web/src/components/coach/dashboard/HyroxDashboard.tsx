'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { createClientSupabase } from '@/lib/supabase/client';
import { fetchHyroxData } from '@/lib/dashboard/hyrox';
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

export function HyroxDashboard({
  clientId,
  sport,
  dateRange,
}: {
  clientId: string;
  sport: string | null;
  dateRange: 'week' | 'month' | '3m';
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hyrox', clientId, sport, dateRange],
    queryFn: () => fetchHyroxData(supabase, clientId, dateRange),
    enabled: sport === 'hyrox',
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
    (data.stationSplits.length === 0 &&
      data.finishTimes.length === 0 &&
      data.weeklyVolume.length === 0)
  ) {
    return <DashboardEmptyState prompt={false} />;
  }

  const CHART_CARDS = [
    {
      title: 'Temps par Station',
      colSpan: true,
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.stationSplits} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="station" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="time_seconds" name="Temps (s)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Temps Final Hyrox',
      colSpan: false,
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.finishTimes} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="finish_time_seconds"
              name="Temps final (s)"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3B82F6' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Volume Hebdomadaire',
      colSpan: false,
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.weeklyVolume} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="week" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
            <Bar dataKey="sessions" name="Sessions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="distance_km" name="Distance (km)" fill="#A855F7" radius={[4, 4, 0, 0]} />
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
          className={`opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]${card.colSpan ? ' col-span-2' : ''}`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <ChartCard title={card.title}>{card.chart}</ChartCard>
        </div>
      ))}
    </div>
  );
}
