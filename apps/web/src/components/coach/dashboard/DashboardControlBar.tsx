'use client';

type SportType = 'powerlifting' | 'hyrox' | 'running' | 'bodybuilding' | 'weightloss';

const DATE_OPTIONS = [
  { key: 'week' as const, label: 'Semaine' },
  { key: 'month' as const, label: 'Mois' },
  { key: '3m' as const, label: '3 Mois' },
];

interface DashboardControlBarProps {
  sport: SportType | null;
  onSportChange: (s: SportType | null) => void;
  dateRange: 'week' | 'month' | '3m';
  onDateRangeChange: (d: 'week' | 'month' | '3m') => void;
}

export function DashboardControlBar({ sport, onSportChange, dateRange, onDateRangeChange }: DashboardControlBarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <select
        value={sport ?? ''}
        onChange={(e) => onSportChange((e.target.value as SportType) || null)}
        className="h-9 px-3 pr-8 text-sm font-medium bg-white border border-border rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors min-w-[200px]"
      >
        <option value="">Sélectionner un sport</option>
        <option value="powerlifting">Powerlifting</option>
        <option value="hyrox">Hyrox</option>
        <option value="running">Running / Cardio</option>
        <option value="bodybuilding">Bodybuilding</option>
        <option value="weightloss">Perte de poids</option>
      </select>
      <div className="flex items-center gap-0 bg-surface-alt rounded-lg p-0.5 border border-border">
        {DATE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onDateRangeChange(key)}
            className={
              dateRange === key
                ? 'bg-primary text-white shadow-sm rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
                : 'text-muted hover:text-text rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
