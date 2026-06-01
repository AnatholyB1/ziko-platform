'use client';

import { useEffect } from 'react';
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

function mergeForCompare<T extends { date: string; value: number }>(
  dataA: T[],
  dataB: T[]
): { date: string; valueA: number | null; valueB: number | null }[] {
  const mapB = new Map(dataB.map((d) => [d.date, d.value]));
  return dataA.map((d) => ({ date: d.date, valueA: d.value, valueB: mapB.get(d.date) ?? null }));
}

export function PowerliftingDashboard({
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
    queryKey: ['powerlifting', clientId, sport, dateRange],
    queryFn: () => fetchPowerliftingData(supabase, clientId, dateRange),
    enabled: sport === 'powerlifting',
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data && onDataReady) {
      const lastSbd = data.sbd[data.sbd.length - 1];
      const lastRpe = data.rpe[data.rpe.length - 1];
      const lastTonnage = data.tonnage[data.tonnage.length - 1];
      const summary: Record<string, unknown> = {};
      if (lastSbd?.squat != null) summary['1RM Squat (dernier)'] = lastSbd.squat;
      if (lastSbd?.bench != null) summary['1RM Bench (dernier)'] = lastSbd.bench;
      if (lastSbd?.deadlift != null) summary['1RM Deadlift (dernier)'] = lastSbd.deadlift;
      if (lastRpe?.rpe != null) summary['RPE moyen (dernière séance)'] = lastRpe.rpe;
      if (lastTonnage?.tonnage != null) summary['Tonnage hebdo (dernière sem.)'] = lastTonnage.tonnage;
      onDataReady(summary);
    }
  }, [data, onDataReady]);

  const compareIsClient = compareMode === true && !!compareClientId;
  const compareIsPeriod = compareMode === true && !compareClientId && !!comparePeriod;
  const compareEffectiveClientId = compareIsClient ? compareClientId! : clientId;
  const compareEffectivePeriod = compareIsPeriod ? comparePeriod! : (comparePeriod ?? dateRange);

  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ['powerlifting-compare', compareEffectiveClientId, compareEffectivePeriod, compareMode],
    queryFn: () => fetchPowerliftingData(supabase, compareEffectiveClientId, compareEffectivePeriod),
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
    (data.sbd.length === 0 &&
      data.rpe.length === 0 &&
      data.tonnage.length === 0 &&
      data.intensity.length === 0)
  ) {
    return <DashboardEmptyState prompt={false} />;
  }

  const isActive = compareMode === true && !!compareData;

  // Merged RPE data (rpe field is numeric, can merge directly)
  const rpeDataA = data.rpe.map((d) => ({ date: d.date, value: d.rpe }));
  const rpeDataB = (compareData?.rpe ?? []).map((d) => ({ date: d.date, value: d.rpe }));
  const mergedRpe = isActive ? mergeForCompare(rpeDataA, rpeDataB) : null;

  // Merged tonnage data (week key instead of date — use tonnage field)
  const tonnageDataA = data.tonnage.map((d) => ({ date: d.week, value: d.tonnage }));
  const tonnageDataB = (compareData?.tonnage ?? []).map((d) => ({ date: d.week, value: d.tonnage }));
  const mergedTonnage = isActive ? mergeForCompare(tonnageDataA, tonnageDataB) : null;

  // Merged intensity data
  const intensityDataA = data.intensity.map((d) => ({ date: d.date, value: d.intensity }));
  const intensityDataB = (compareData?.intensity ?? []).map((d) => ({ date: d.date, value: d.intensity }));
  const mergedIntensity = isActive ? mergeForCompare(intensityDataA, intensityDataB) : null;

  const CHART_CARDS = [
    {
      title: 'Progression 1RM — SBD',
      chartKey: 'squat_1rm',
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
      chartKey: 'rpe_avg',
      chart: isActive && mergedRpe ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mergedRpe} margin={CHART_MARGIN}>
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
              dataKey="valueA"
              name="RPE Sujet A"
              stroke="#FF5C1A"
              strokeWidth={2}
              dot={{ r: 3, fill: '#FF5C1A' }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="valueB"
              name="RPE Sujet B"
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
      chartKey: 'tonnage_hebdo',
      chart: isActive && mergedTonnage ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={mergedTonnage} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="valueA" name="Tonnage A (kg)" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="valueB" name="Tonnage B (kg)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
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
      chartKey: 'intensite_1rm',
      chart: isActive && mergedIntensity ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mergedIntensity} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => v + '%'}
              tick={{ fontSize: 11, fill: '#6B6963' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="valueA"
              name="Intensité A %"
              stroke="#FF5C1A"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="valueB"
              name="Intensité B %"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
              connectNulls
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963', paddingTop: '8px' }} iconType="line" iconSize={16} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
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
              formatter={(v) => [`${v}%`, 'Intensité']}
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
              <ChartCard title={card.title} aiInsight={chartInsights?.[card.chartKey]} metricKey={card.chartKey} crossedThresholds={crossedThresholds}>{card.chart}</ChartCard>
        </div>
      ))}
    </div>
  );
}
