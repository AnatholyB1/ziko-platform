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

export function WeightLossDashboard({
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
    queryKey: ['weightloss', clientId, sport, dateRange],
    queryFn: () => fetchWeightLossData(supabase, clientId, dateRange),
    enabled: sport === 'weightloss',
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

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Card 1 — Évolution du Poids (full width) */}
      <div
        className="col-span-2 opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <ChartCard title="Evolution du Poids">
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
        </ChartCard>
      </div>

      {/* Card 2 — Conformite Calorique */}
      <div
        className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '50ms' }}
      >
        <ChartCard title="Conformite Calorique">
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
        </ChartCard>
      </div>

      {/* Card 3 — Progression de Charge */}
      <div
        className="opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '100ms' }}
      >
        <ChartCard title="Progression de Charge">
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
        </ChartCard>
      </div>
    </div>
  );
}
