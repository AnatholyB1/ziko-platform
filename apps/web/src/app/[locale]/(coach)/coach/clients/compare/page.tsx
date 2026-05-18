export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ComparisonChart } from '@/components/coach/ComparisonChart';
import { CompareControls } from '@/components/coach/CompareControls';

type MetricType = 'weight' | 'sessions' | 'sleep' | 'mood';

const VALID_METRICS: MetricType[] = ['weight', 'sessions', 'sleep', 'mood'];
const VALID_DAYS = [30, 90, 365] as const;
type ValidDays = typeof VALID_DAYS[number];

// UUID v4 regex for input validation (T-26-07-02)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildChartData(
  rawData: Record<string, Array<{ date: string; value: number }>>,
  clientIds: string[],
): Array<{ date: string; [key: string]: number | string }> {
  // Collect all unique dates across all clients
  const allDates = new Set<string>();
  for (const id of clientIds) {
    for (const point of rawData[id] ?? []) {
      allDates.add(point.date);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  return sortedDates.map(date => {
    const point: { date: string; [key: string]: number | string } = { date };
    for (const id of clientIds) {
      const match = (rawData[id] ?? []).find(p => p.date === date);
      if (match !== undefined) point[id] = match.value;
    }
    return point;
  });
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; metric?: string; days?: string }>;
}) {
  const { ids: idsParam = '', metric: metricParam = 'weight', days: daysParam = '30' } =
    await searchParams;

  const locale = await getLocale();
  const supabase = await createServerSupabase();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Validate metric against allowlist (T-26-07-02)
  const metric: MetricType = (VALID_METRICS as string[]).includes(metricParam)
    ? (metricParam as MetricType)
    : 'weight';

  // Validate days
  const daysNum = parseInt(daysParam, 10);
  const days: ValidDays = (VALID_DAYS as readonly number[]).includes(daysNum)
    ? (daysNum as ValidDays)
    : 30;

  // Validate and sanitize client IDs — UUID regex + max 5 (T-26-07-01)
  const clientIds = idsParam
    .split(',')
    .map(id => id.trim())
    .filter(id => UUID_RE.test(id))
    .slice(0, 5);

  // Require at least 2 valid clients for comparison
  if (clientIds.length < 2) {
    redirect(`/${locale}/coach/clients`);
  }

  // Fetch client profiles for display names
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, name')
    .in('id', clientIds);

  const CLIENT_COLORS = ['#FF5C1A', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B'];

  const clientNames = (profiles ?? []).map((p: { id: string; name: string | null }) => ({
    id: p.id,
    name: p.name ?? 'Client',
  }));

  // Fetch comparison data via Hono API with no-store (T-26-07-01, T-26-07-03)
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';

  let rawData: Record<string, Array<{ date: string; value: number }>> = {};

  if (jwt) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const queryString = `ids=${clientIds.join(',')}&metric=${metric}&days=${days}`;
      const res = await fetch(`${apiUrl}/coach/clients/compare?${queryString}`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        rawData = (json.data ?? {}) as Record<string, Array<{ date: string; value: number }>>;
      }
    } catch (err) {
      // Graceful degradation — chart will show empty state
      console.error('[compare/page] fetch error:', err);
    }
  }

  const chartData = buildChartData(rawData, clientIds);

  return (
    <div className="flex-1 p-8 min-h-screen" style={{ backgroundColor: '#F7F6F3' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4" style={{ color: '#1C1A17' }}>
          Comparer des clients
        </h1>

        {/* Client name chips with their assigned colors */}
        <div className="flex flex-wrap gap-2 mb-4">
          {clientNames.map((c, i) => (
            <span
              key={c.id}
              className="inline-flex items-center text-sm font-normal px-3 py-1 rounded-full text-white"
              style={{ backgroundColor: CLIENT_COLORS[i % CLIENT_COLORS.length] }}
            >
              {c.name}
            </span>
          ))}
        </div>

        {/* Client-side controls: metric selector + date range chips */}
        <CompareControls
          currentMetric={metric}
          currentDays={days}
          ids={idsParam}
          locale={locale}
        />
      </div>

      {/* Recharts comparison chart — 'use client' boundary (T-26-07-03) */}
      <ComparisonChart
        data={chartData}
        clientNames={clientNames}
        metric={metric}
      />
    </div>
  );
}
