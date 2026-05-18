'use client';

import { useRouter } from 'next/navigation';

type MetricType = 'weight' | 'sessions' | 'sleep' | 'mood';

const METRIC_OPTIONS: { value: MetricType; label: string }[] = [
  { value: 'weight', label: 'Poids (kg)' },
  { value: 'sessions', label: 'Séances / semaine' },
  { value: 'sleep', label: 'Sommeil (h)' },
  { value: 'mood', label: 'Humeur (moy)' },
];

const DATE_RANGE_OPTIONS: { value: 30 | 90 | 365; label: string }[] = [
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
  { value: 365, label: '1an' },
];

export function CompareControls({
  currentMetric,
  currentDays,
  ids,
  locale,
}: {
  currentMetric: MetricType;
  currentDays: 30 | 90 | 365;
  ids: string;
  locale: string;
}) {
  const router = useRouter();

  const navigate = (metric: MetricType, days: 30 | 90 | 365) => {
    router.push(`/${locale}/coach/clients/compare?ids=${ids}&metric=${metric}&days=${days}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Metric selector */}
      <select
        value={currentMetric}
        onChange={e => navigate(e.target.value as MetricType, currentDays)}
        className="border rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2"
        style={{ borderColor: '#E2E0DA', color: '#1C1A17' }}
      >
        {METRIC_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Date range chips */}
      <div className="flex gap-2" role="tablist" aria-label="Période">
        {DATE_RANGE_OPTIONS.map(opt => {
          const isActive = currentDays === opt.value;
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={isActive}
              onClick={() => navigate(currentMetric, opt.value)}
              className="px-4 py-1.5 rounded-full border text-sm font-normal transition-colors"
              style={{
                borderColor: isActive ? '#FF5C1A' : '#E2E0DA',
                backgroundColor: isActive ? 'rgba(255, 92, 26, 0.1)' : '#FFFFFF',
                color: isActive ? '#FF5C1A' : '#6B6963',
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
