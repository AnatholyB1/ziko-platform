'use client';

import { useEffect } from 'react';
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

function mergeForCompare<T extends { date: string; value: number }>(
  dataA: T[],
  dataB: T[]
): { date: string; valueA: number | null; valueB: number | null }[] {
  const mapB = new Map(dataB.map((d) => [d.date, d.value]));
  return dataA.map((d) => ({ date: d.date, valueA: d.value, valueB: mapB.get(d.date) ?? null }));
}

export function HyroxDashboard({
  clientId,
  sport,
  dateRange,
  compareMode,
  compareClientId,
  comparePeriod,
  onDataReady,
  chartInsights,
  crossedThresholds,
}: {
  clientId: string;
  sport: string | null;
  dateRange: 'week' | 'month' | '3m';
  compareMode?: boolean;
  compareClientId?: string | null;
  comparePeriod?: 'week' | 'month' | '3m' | null;
  onDataReady?: (summary: Record<string, unknown>) => void;
  chartInsights?: Record<string, string>;
  crossedThresholds?: Array<{ metric_key: string; operator: string; threshold_value: number; current_value: number }>;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hyrox', clientId, sport, dateRange],
    queryFn: () => fetchHyroxData(supabase, clientId, dateRange),
    enabled: sport === 'hyrox',
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data && onDataReady) {
      const lastFinish = data.finishTimes[data.finishTimes.length - 1];
      const lastVolume = data.weeklyVolume[data.weeklyVolume.length - 1];
      const summary: Record<string, unknown> = {};
      if (lastFinish?.finish_time_seconds != null) summary['Temps total (dernière course)'] = lastFinish.finish_time_seconds;
      if (lastVolume?.sessions != null) summary['Volume total kg (dernière séance)'] = lastVolume.sessions;
      if (lastVolume?.distance_km != null) summary['Distance totale km (période)'] = lastVolume.distance_km;
      onDataReady(summary);
    }
  }, [data, onDataReady]);

  const compareIsClient = compareMode === true && !!compareClientId;
  const compareIsPeriod = compareMode === true && !compareClientId && !!comparePeriod;
  const compareEffectiveClientId = compareIsClient ? compareClientId! : clientId;
  const compareEffectivePeriod = compareIsPeriod ? comparePeriod! : (comparePeriod ?? dateRange);

  const { data: compareData } = useQuery({
    queryKey: ['hyrox-compare', compareEffectiveClientId, compareEffectivePeriod, compareMode],
    queryFn: () => fetchHyroxData(supabase, compareEffectiveClientId, compareEffectivePeriod),
    enabled: compareMode === true && (compareIsClient || compareIsPeriod),
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

  const isActive = compareMode === true && !!compareData;

  // Merge finishTimes (finish_time_seconds)
  const finishDataA = data.finishTimes.map((d) => ({ date: d.date, value: d.finish_time_seconds }));
  const finishDataB = (compareData?.finishTimes ?? []).map((d) => ({ date: d.date, value: d.finish_time_seconds }));
  const mergedFinish = isActive ? mergeForCompare(finishDataA, finishDataB) : null;

  // Merge weeklyVolume sessions
  const volumeSessionsA = data.weeklyVolume.map((d) => ({ date: d.week, value: d.sessions }));
  const volumeSessionsB = (compareData?.weeklyVolume ?? []).map((d) => ({ date: d.week, value: d.sessions }));
  const mergedSessions = isActive ? mergeForCompare(volumeSessionsA, volumeSessionsB) : null;

  const CHART_CARDS = [
    {
      title: 'Temps par Station',
      chartKey: 'temps_station',
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
      chartKey: 'temps_total',
      colSpan: false,
      chart: isActive && mergedFinish ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mergedFinish} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="valueA"
              name="Temps A (s)"
              stroke="#FF5C1A"
              strokeWidth={2}
              dot={{ r: 3, fill: '#FF5C1A' }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="valueB"
              name="Temps B (s)"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3B82F6' }}
              strokeDasharray="5 3"
              connectNulls
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963', paddingTop: '8px' }} iconType="line" iconSize={16} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
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
      chartKey: 'volume_hebdo',
      colSpan: false,
      chart: isActive && mergedSessions ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={mergedSessions} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="valueA" name="Sessions A" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="valueB" name="Sessions B" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
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
          <ChartCard title={card.title} aiInsight={chartInsights?.[card.chartKey]} metricKey={card.chartKey} crossedThresholds={crossedThresholds}>{card.chart}</ChartCard>
        </div>
      ))}
    </div>
  );
}
