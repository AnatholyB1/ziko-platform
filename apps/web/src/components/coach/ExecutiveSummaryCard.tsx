// apps/web/src/components/coach/ExecutiveSummaryCard.tsx
// Server-renderable — no 'use client'

type ClientSummary = {
  sessions_this_week: number;
  habits_pct: number | null;
  last_workout_at: string | null;
  latest_weight_kg: number | null;
  mood_delta: number | null;
  mood_prev_avg: number | null;
  mood_curr_avg: number | null;
};

function formatRelative(isoDate: string | null): string {
  if (!isoDate) return '–';
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Il y a 1 jour';
  return `Il y a ${days} jours`;
}

function getMoodBadgeClasses(delta: number | null): string {
  if (delta === null) return 'bg-neutral-100 text-neutral-500 border-neutral-200';
  if (delta < -0.3) return 'bg-danger-subtle text-danger border-danger/30';
  if (delta < 0) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-success-subtle text-success border-success/30';
}

function getMoodLabel(summary: ClientSummary): string {
  const { mood_delta, mood_prev_avg, mood_curr_avg } = summary;
  if (mood_delta === null || mood_prev_avg === null || mood_curr_avg === null) return '–';
  const arrow = mood_delta >= 0 ? '↑' : '↓';
  return `Humeur: ${arrow} ${mood_prev_avg} → ${mood_curr_avg}`;
}

export function ExecutiveSummaryCard({ summary }: { summary: ClientSummary }) {
  const cells = [
    {
      label: 'Séances cette semaine',
      value: `${summary.sessions_this_week} / 3`,
    },
    {
      label: 'Habitudes (7j moy)',
      value: summary.habits_pct !== null ? `${summary.habits_pct}%` : '–',
    },
    {
      label: 'Dernier workout',
      value: formatRelative(summary.last_workout_at),
    },
    {
      label: 'Humeur (14j)',
      value: (
        <span
          className={`inline-flex items-center text-sm font-normal px-3 py-1 rounded-full border ${getMoodBadgeClasses(summary.mood_delta)}`}
        >
          {getMoodLabel(summary)}
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cells.map((cell, i) => (
        <div key={i} className="bg-white rounded-xl p-6 border border-border">
          {typeof cell.value === 'string' ? (
            <div className="text-2xl font-bold text-text">{cell.value}</div>
          ) : (
            <div className="mt-1">{cell.value}</div>
          )}
          <div className="text-sm font-normal text-muted mt-1">{cell.label}</div>
        </div>
      ))}
    </div>
  );
}
