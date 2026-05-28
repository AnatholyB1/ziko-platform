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
import { fetchWeightLossData } from '@/lib/dashboard/weightloss';
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

export function WeightLossDashboard({
  clientId,
  sport,
  dateRange,
  compareMode,
  compareClientId,
  comparePeriod,
}: {
  clientId: string;
  sport: string | null;
  dateRange: 'week' | 'month' | '3m';
  compareMode?: boolean;
  compareClientId?: string | null;
  comparePeriod?: 'week' | 'month' | '3m' | null;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['weightloss', clientId, sport, dateRange],
    queryFn: () => fetchWeightLossData(supabase, clientId, dateRange),
    enabled: sport === 'weightloss',
    staleTime: 60_000,
  });

  const compareIsClient = compareMode === true && !!compareClientId;
  const compareIsPeriod = compareMode === true && !compareClientId && !!comparePeriod;
  const compareEffectiveClientId = compareIsClient ? compareClientId! : clientId;
  const compareEffectivePeriod = compareIsPeriod ? comparePeriod! : (comparePeriod ?? dateRange);

  const { data: compareData } = useQuery({
    queryKey: ['weightloss-compare', compareEffectiveClientId, compareEffectivePeriod, compareMode],
    queryFn: () => fetchWeightLossData(supabase, compareEffectiveClientId, compareEffectivePeriod),
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
    (data.bodyweightCurve.length === 0 &&
      data.calorieCompliance.length === 0 &&
      data.loadProgression.length === 0)
  ) {
    return <DashboardEmptyState prompt={false} />;
  }

  const isActive = compareMode === true && !!compareData;

  // Merge bodyweight curve
  const bwCurveA = data.bodyweightCurve.map((d) => ({ date: d.date, value: d.weight_kg }));
  const bwCurveB = (compareData?.bodyweightCurve ?? []).map((d) => ({ date: d.date, value: d.weight_kg }));
  const mergedBwCurve = isActive ? mergeForCompare(bwCurveA, bwCurveB) : null;

  // Merge calorie compliance
  const caloriesA = data.calorieCompliance.map((d) => ({ date: d.date, value: d.calories }));
  const caloriesB = (compareData?.calorieCompliance ?? []).map((d) => ({ date: d.date, value: d.calories }));
  const mergedCalories = isActive ? mergeForCompare(caloriesA, caloriesB) : null;

  // Merge load progression
  const loadA = data.loadProgression.map((d) => ({ date: d.date, value: d.total_load_kg }));
  const loadB = (compareData?.loadProgression ?? []).map((d) => ({ date: d.date, value: d.total_load_kg }));
  const mergedLoad = isActive ? mergeForCompare(loadA, loadB) : null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Card 1 — Évolution du Poids (full width) */}
      <div
        className="col-span-2 opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <ChartCard title="Evolution du Poids">
          {isActive && mergedBwCurve ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mergedBwCurve} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
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
              <AreaChart data={data.bodyweightCurve} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
                <Area
                  type="monotone"
                  dataKey="weight_kg"
                  name="Poids (kg)"
                  stroke="#FF5C1A"
                  fill="#FF5C1A"
                  fillOpacity={0.10}
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#FF5C1A' }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Card 2 — Conformite Calorique */}
      <div
        className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '50ms' }}
      >
        <ChartCard title="Conformite Calorique">
          {isActive && mergedCalories ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mergedCalories} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="valueA" name="Calories A" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="valueB" name="Calories B" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.calorieCompliance} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
                <Bar dataKey="calories" name="Calories" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
                {data.avgDailyCalories > 0 && (
                  <ReferenceLine
                    y={data.avgDailyCalories}
                    stroke="#22C55E"
                    strokeDasharray="4 4"
                    label={{ value: 'Moy.', fill: '#22C55E', fontSize: 10 }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Card 3 — Progression de Charge */}
      <div
        className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '100ms' }}
      >
        <ChartCard title="Progression de Charge">
          {isActive && mergedLoad ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mergedLoad} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="valueA"
                  name="Charge A (kg)"
                  stroke="#FF5C1A"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="valueB"
                  name="Charge B (kg)"
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
              <LineChart data={data.loadProgression} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
                <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
                <Line
                  type="monotone"
                  dataKey="total_load_kg"
                  name="Charge totale (kg)"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
