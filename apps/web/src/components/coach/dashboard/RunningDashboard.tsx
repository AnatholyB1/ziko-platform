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

function mergeForCompare<T extends { date: string; value: number }>(
  dataA: T[],
  dataB: T[]
): { date: string; valueA: number | null; valueB: number | null }[] {
  const mapB = new Map(dataB.map((d) => [d.date, d.value]));
  return dataA.map((d) => ({ date: d.date, valueA: d.value, valueB: mapB.get(d.date) ?? null }));
}

export function RunningDashboard({
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
    queryKey: ['running', clientId, sport, dateRange],
    queryFn: () => fetchRunningData(supabase, clientId, dateRange),
    enabled: sport === 'running',
    staleTime: 60_000,
  });

  const compareIsClient = compareMode === true && !!compareClientId;
  const compareIsPeriod = compareMode === true && !compareClientId && !!comparePeriod;
  const compareEffectiveClientId = compareIsClient ? compareClientId! : clientId;
  const compareEffectivePeriod = compareIsPeriod ? comparePeriod! : (comparePeriod ?? dateRange);

  const { data: compareData } = useQuery({
    queryKey: ['running-compare', compareEffectiveClientId, compareEffectivePeriod, compareMode],
    queryFn: () => fetchRunningData(supabase, compareEffectiveClientId, compareEffectivePeriod),
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
    (data.paceTrend.length === 0 &&
      data.weeklyDistance.length === 0 &&
      data.sessionDistances.length === 0)
  ) {
    return <DashboardEmptyState prompt={false} />;
  }

  const isActive = compareMode === true && !!compareData;

  // Merge pace data
  const paceDataA = data.paceTrend.map((d) => ({ date: d.date, value: d.pace_min_per_km }));
  const paceDataB = (compareData?.paceTrend ?? []).map((d) => ({ date: d.date, value: d.pace_min_per_km }));
  const mergedPace = isActive ? mergeForCompare(paceDataA, paceDataB) : null;

  // Merge weekly distance (week key)
  const distanceA = data.weeklyDistance.map((d) => ({ date: d.week, value: d.distance_km }));
  const distanceB = (compareData?.weeklyDistance ?? []).map((d) => ({ date: d.week, value: d.distance_km }));
  const mergedDistance = isActive ? mergeForCompare(distanceA, distanceB) : null;

  // Merge vo2max
  const vo2maxA = data.vo2maxTrend.map((d) => ({ date: d.date, value: d.vo2max }));
  const vo2maxB = (compareData?.vo2maxTrend ?? []).map((d) => ({ date: d.date, value: d.vo2max }));
  const mergedVo2max = isActive ? mergeForCompare(vo2maxA, vo2maxB) : null;

  // Merge session distances
  const sessionDistA = data.sessionDistances.map((d) => ({ date: d.date, value: d.distance_km }));
  const sessionDistB = (compareData?.sessionDistances ?? []).map((d) => ({ date: d.date, value: d.distance_km }));
  const mergedSessionDist = isActive ? mergeForCompare(sessionDistA, sessionDistB) : null;

  const CHART_CARDS = [
    {
      title: 'Allure (min/km)',
      chart: isActive && mergedPace ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mergedPace} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="valueA"
              name="Allure A (min/km)"
              stroke="#FF5C1A"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="valueB"
              name="Allure B (min/km)"
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
      chart: isActive && mergedDistance ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={mergedDistance} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="valueA" name="Distance A (km)" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="valueB" name="Distance B (km)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
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
      chart: isActive && mergedVo2max ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mergedVo2max} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="valueA"
              name="VO2max A"
              stroke="#FF5C1A"
              strokeWidth={2}
              dot={{ r: 3, fill: '#FF5C1A' }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="valueB"
              name="VO2max B"
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
      chart: isActive && mergedSessionDist ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={mergedSessionDist} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" {...SHARED_AXIS_PROPS} />
            <YAxis tick={{ fontSize: 11, fill: '#6B6963' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="valueA" name="Distance A (km)" fill="#FF5C1A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="valueB" name="Distance B (km)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
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
