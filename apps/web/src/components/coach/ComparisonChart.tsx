'use client';

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

// 5-slot client color palette (UI-SPEC.md D-16 / D-19)
const CLIENT_COLORS = ['#FF5C1A', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B'];

type DataPoint = {
  date: string;
  [clientId: string]: number | string;
};

type MetricType = 'weight' | 'sessions' | 'sleep' | 'mood';

const METRIC_LABEL: Record<MetricType, string> = {
  weight: 'Poids (kg)',
  sessions: 'Séances / semaine',
  sleep: 'Sommeil (h)',
  mood: 'Humeur (moy)',
};

export function ComparisonChart({
  data,
  clientNames,
  metric,
}: {
  data: DataPoint[];
  clientNames: { id: string; name: string }[];
  metric: MetricType;
}) {
  const isAggregate = metric === 'sessions'; // BarChart for sessions, LineChart for everything else

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-white rounded-2xl border border-border" style={{ height: 384 }}>
        <p className="text-sm" style={{ color: '#6B6963' }}>Aucune donnée disponible pour cette période.</p>
      </div>
    );
  }

  if (isAggregate) {
    return (
      <div className="bg-white rounded-2xl border border-border p-6">
        <ResponsiveContainer
          width="100%"
          height={384}
          aria-label={`Graphique de comparaison: ${METRIC_LABEL[metric]}`}
        >
          <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {clientNames.map((c, i) => (
              <Bar
                key={c.id}
                dataKey={c.id}
                name={c.name}
                fill={CLIENT_COLORS[i % CLIENT_COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <ResponsiveContainer
        width="100%"
        height={384}
        aria-label={`Graphique de comparaison: ${METRIC_LABEL[metric]}`}
      >
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {clientNames.map((c, i) => (
            <Line
              key={c.id}
              type="monotone"
              dataKey={c.id}
              name={c.name}
              stroke={CLIENT_COLORS[i % CLIENT_COLORS.length]}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
