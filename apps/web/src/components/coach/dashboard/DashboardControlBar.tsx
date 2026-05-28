'use client';

import { Users, FileDown, Loader2, Check } from 'lucide-react';
import { CompareExpandRow } from './CompareExpandRow';

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
  // Compare mode — D-04, D-07, D-21
  compareMode: boolean;
  onToggleCompare: () => void;
  exportState: 'idle' | 'generating' | 'done' | 'error';
  onExportPDF: () => void;
  // CompareExpandRow props
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

export function DashboardControlBar({
  sport,
  onSportChange,
  dateRange,
  onDateRangeChange,
  compareMode,
  onToggleCompare,
  exportState,
  onExportPDF,
  compareSubMode,
  onSubModeChange,
  compareClientId,
  onClientChange,
  comparePeriod,
  onPeriodChange,
  currentClientId,
  compareLoading,
  compareError,
}: DashboardControlBarProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        {/* Sport select — left */}
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

        {/* Right section — D-04, D-15 */}
        <div className="flex items-center gap-2">
          {/* Compare button — D-04, D-07, D-21 */}
          <button
            onClick={onToggleCompare}
            className={
              compareMode
                ? 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/12 transition-colors'
                : 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white hover:bg-[#F0EFE9] hover:border-[#1C1A17]/20 transition-colors'
            }
            style={compareMode ? { backgroundColor: 'rgba(255,92,26,0.08)' } : undefined}
          >
            <Users className={`w-4 h-4 ${compareMode ? 'text-primary' : 'text-muted'}`} />
            Comparer
          </button>

          {/* Date filter segmented control — unchanged */}
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

          {/* Export PDF button — D-15 */}
          <button
            onClick={exportState === 'idle' || exportState === 'error' ? onExportPDF : undefined}
            disabled={exportState === 'generating'}
            className={
              exportState === 'generating'
                ? 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white opacity-70 cursor-not-allowed'
                : exportState === 'done'
                ? 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-[#15803D] border border-[#22C55E]/30 rounded-lg bg-[#DCFCE7] transition-colors'
                : 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white hover:bg-[#F0EFE9] transition-colors'
            }
          >
            {exportState === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
            {exportState === 'done' && <Check className="w-4 h-4 text-[#15803D]" />}
            {(exportState === 'idle' || exportState === 'error') && <FileDown className="w-4 h-4 text-muted" />}
            {exportState === 'generating'
              ? 'Génération en cours…'
              : exportState === 'done'
              ? 'PDF exporté'
              : exportState === 'error'
              ? "Erreur d'export. Réessayez."
              : 'Exporter PDF'}
          </button>
        </div>
      </div>

      {/* CompareExpandRow slides in below ControlBar when compare mode is active */}
      <CompareExpandRow
        open={compareMode}
        compareSubMode={compareSubMode}
        onSubModeChange={onSubModeChange}
        compareClientId={compareClientId}
        onClientChange={onClientChange}
        comparePeriod={comparePeriod}
        onPeriodChange={onPeriodChange}
        currentClientId={currentClientId}
        currentDateRange={dateRange}
        compareLoading={compareLoading}
        compareError={compareError}
      />
    </div>
  );
}
