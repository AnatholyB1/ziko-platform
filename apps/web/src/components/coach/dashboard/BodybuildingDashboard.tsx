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
  ResponsiveContainer,
} from 'recharts';
import { createClientSupabase } from '@/lib/supabase/client';
import { fetchBodybuildingData } from '@/lib/dashboard/bodybuilding';
import { ChartCard } from './ChartCard';
import { DashboardLoadingState } from './DashboardLoadingState';
import { DashboardEmptyState } from './DashboardEmptyState';

const supabase = createClientSupabase();

const CLIENT_COLORS = ['#FF5C1A', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B'];

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

export function BodybuildingDashboard({
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
    queryKey: ['bodybuilding', clientId, sport, dateRange],
    queryFn: () => fetchBodybuildingData(supabase, clientId, dateRange),
    enabled: sport === 'bodybuilding',
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data && onDataReady) {
      const lastBw = data.bodyweight[data.bodyweight.length - 1];
      const totalSets = data.muscleVolume.reduce((acc: number, m: { sets: number }) => acc + m.sets, 0);
      const distinctExercises = data.topExercises?.length ?? 0;
      const summary: Record<string, unknown> = {};
      if (lastBw?.weight_kg != null) summary['Poids de corps kg'] = lastBw.weight_kg;
      if (totalSets > 0) summary['Séries hebdo'] = totalSets;
      if (distinctExercises > 0) summary['Exercices distincts (période)'] = distinctExercises;
      onDataReady(summary);
    }
  }, [data, onDataReady]);

  const compareIsClient = compareMode === true && !!compareClientId;
  const compareIsPeriod = compareMode === true && !compareClientId && !!comparePeriod;
  const compareEffectiveClientId = compareIsClient ? compareClientId! : clientId;
  const compareEffectivePeriod = compareIsPeriod ? comparePeriod! : (comparePeriod ?? dateRange);

  const { data: compareData } = useQuery({
    queryKey: ['bodybuilding-compare', compareEffectiveClientId, compareEffectivePeriod, compareMode],
    queryFn: () => fetchBodybuildingData(supabase, compareEffectiveClientId, compareEffectivePeriod),
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
    (data.muscleVolume.length === 0 &&
      data.progressiveOverload.length === 0 &&
      data.bodyweight.length === 0)
  ) {
    return <DashboardEmptyState prompt={false} />;
  }

  const isActive = compareMode === true && !!compareData;

  // Merge bodyweight data
  const bwDataA = data.bodyweight.map((d) => ({ date: d.date, value: d.weight_kg }));
  const bwDataB = (compareData?.bodyweight ?? []).map((d) => ({ date: d.date, value: d.weight_kg }));
  const mergedBodyweight = isActive ? mergeForCompare(bwDataA, bwDataB) : null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Card 1 — Volume par Groupe Musculaire (col-span-2) */}
      <div
        className="col-span-2 opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <ChartCard title="Volume par Groupe Musculaire" aiInsight={chartInsights?.['volume_total']} metricKey="volume_total" crossedThresholds={crossedThresholds}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              layout="vertical"
              data={data.muscleVolume}
              margin={CHART_MARGIN}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#6B6963' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="muscle_group"
                width={90}
                tick={{ fontSize: 11, fill: '#6B6963' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
              <Bar dataKey="sets" name="Séries" fill="#FF5C1A" radius={[0, 4, 4, 0]} />
              <Bar dataKey="volume_kg" name="Volume (kg)" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Card 2 — Surcharge Progressive */}
      <div
        className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '50ms' }}
      >
        <ChartCard title="Surcharge Progressive" aiInsight={chartInsights?.['series_hebdo']} metricKey="series_hebdo" crossedThresholds={crossedThresholds}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.progressiveOverload} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
              <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B6963' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
              {data.topExercises.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={CLIENT_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Card 3 — Poids Corporel */}
      <div
        className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '100ms' }}
      >
        <ChartCard title="Poids Corporel" aiInsight={chartInsights?.['poids_corps']} metricKey="poids_corps" crossedThresholds={crossedThresholds}>
          {isActive && mergedBodyweight ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mergedBodyweight} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B6963' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="valueA"
                  name="Poids A (kg)"
                  stroke="#FF5C1A"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#FF5C1A' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="valueB"
                  name="Poids B (kg)"
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
              <AreaChart data={data.bodyweight} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B6963' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="weight_kg"
                  name="Poids (kg)"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#F59E0B' }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
