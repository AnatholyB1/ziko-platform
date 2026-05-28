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
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { createClientSupabase } from '@/lib/supabase/client';
import { fetchPowerliftingData } from '@/lib/dashboard/powerlifting';
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

export function PowerliftingDashboard({
  clientId,
  sport,
  dateRange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compareMode,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compareClientId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  comparePeriod,
}: {
  clientId: string;
  sport: string | null;
  dateRange: 'week' | 'month' | '3m';
  // TODO: 040-03 adds dual-series rendering
  compareMode?: boolean;
  compareClientId?: string | null;
  comparePeriod?: 'week' | 'month' | '3m' | null;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['powerlifting', clientId, sport, dateRange],
    queryFn: () => fetchPowerliftingData(supabase, clientId, dateRange),
    enabled: sport === 'powerlifting',
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
    (data.sbd.length === 0 &&
      data.rpe.length === 0 &&
      data.tonnage.length === 0 &&
      data.intensity.length === 0)
  ) {
    return <DashboardEmptyState prompt={false} />;
  }

  const CHART_CARDS = [
    {
      title: 'Progression 1RM — SBD',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.sbd} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
            <Line
              type="monotone"
              dataKey="squat"
              name="Squat"
              stroke="#FF5C1A"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="bench"
              name="Bench"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="deadlift"
              name="Deadlift"
              stroke="#22C55E"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Tendance RPE',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.rpe} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 11, fill: '#6B6963' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <ReferenceLine
              y={8}
              stroke="#EF4444"
              strokeDasharray="4 4"
              label={{ value: 'Seuil', fill: '#EF4444', fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="rpe"
              name="RPE moyen"
              stroke="#FF5C1A"
              strokeWidth={2}
              dot={{ r: 3, fill: '#FF5C1A' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Tonnage Hebdomadaire',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.tonnage} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="week" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="tonnage" name="Tonnage (kg)" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Intensité (% 1RM)',
      chart: (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.intensity} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => v + '%'}
              tick={{ fontSize: 11, fill: '#6B6963' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [`${v}%`, 'Intensité']}
            />
            <Area
              type="monotone"
              dataKey="intensity"
              name="Intensité %"
              stroke="#FF5C1A"
              fill="#FF5C1A"
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </AreaChart>
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
