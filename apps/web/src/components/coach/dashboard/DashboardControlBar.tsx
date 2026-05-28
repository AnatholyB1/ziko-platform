'use client';

type SportType = 'powerlifting' | 'hyrox' | 'running' | 'bodybuilding' | 'weightloss';

interface DashboardControlBarProps {
  sport: SportType | null;
  onSportChange: (s: SportType | null) => void;
  dateRange: 'week' | 'month' | '3m';
  onDateRangeChange: (d: 'week' | 'month' | '3m') => void;
  compareMode: boolean;
  onToggleCompare: () => void;
  exportState: 'idle' | 'generating' | 'done' | 'error';
  onExportPDF: () => void;
  compareSubMode: 'client' | 'period';
  onSubModeChange: (m: 'client' | 'period') => void;
  compareClientId: string | null;
  onClientChange: (id: string | null) => void;
  comparePeriod: 'week' | 'month' | '3m' | null;
  onPeriodChange: (p: 'week' | 'month' | '3m') => void;
  currentClientId: string;
  compareLoading: boolean;
  compareError: boolean;
}

export function DashboardControlBar(_props: DashboardControlBarProps) {
  return <div />;
}
