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

export function BodybuildingDashboard({
  clientId,
  sport,
  dateRange,
}: {
  clientId: string;
  sport: string | null;
  dateRange: 'week' | 'month' | '3m';
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bodybuilding', clientId, sport, dateRange],
    queryFn: () => fetchBodybuildingData(supabase, clientId, dateRange),
    enabled: sport === 'bodybuilding',
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

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Card 1 — Volume par Groupe Musculaire (col-span-2) */}
      <div
        className="col-span-2 opacity-0 animate-[fadeInUp_200ms_ease-out_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <ChartCard title="Volume par Groupe Musculaire">
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
        <ChartCard title="Surcharge Progressive">
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
        <ChartCard title="Poids Corporel">
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
        </ChartCard>
      </div>
    </div>
  );
}
