'use client';

import { Users, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { useCoachClients } from '@/hooks/useCoachClients';

interface CompareExpandRowProps {
  open: boolean;
  compareSubMode: 'client' | 'period';
  onSubModeChange: (m: 'client' | 'period') => void;
  compareClientId: string | null;
  onClientChange: (id: string | null) => void;
  comparePeriod: 'week' | 'month' | '3m' | null;
  onPeriodChange: (p: 'week' | 'month' | '3m') => void;
  currentClientId: string;
  currentDateRange: 'week' | 'month' | '3m'; // period A = the currently active date range
  compareLoading: boolean;
  compareError: boolean;
}

const PERIOD_OPTIONS = [
  { key: 'week' as const, label: 'Semaine' },
  { key: 'month' as const, label: 'Mois' },
  { key: '3m' as const, label: '3 Mois' },
];

const PERIOD_LABELS: Record<'week' | 'month' | '3m', string> = {
  week: 'Semaine',
  month: 'Mois',
  '3m': '3 Mois',
};

export function CompareExpandRow({
  open,
  compareSubMode,
  onSubModeChange,
  compareClientId,
  onClientChange,
  comparePeriod,
  onPeriodChange,
  currentClientId,
  currentDateRange,
  compareLoading,
  compareError,
}: CompareExpandRowProps) {
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useCoachClients(currentClientId);

  return (
    <div
      className={`overflow-hidden transition-all ease-out ${
        open ? 'max-h-20 opacity-100 duration-300' : 'max-h-0 opacity-0 duration-[250ms]'
      }`}
    >
      <div className="flex items-center gap-3 py-3 border-t border-border">
        {/* Mode toggle — D-01: Client vs Période */}
        <div className="flex items-center bg-[#F0EFE9] rounded-lg p-0.5 border border-border">
          <button
            onClick={() => onSubModeChange('client')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              compareSubMode === 'client' ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1" />Client
          </button>
          <button
            onClick={() => onSubModeChange('period')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              compareSubMode === 'period' ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1" />Période
          </button>
        </div>

        {/* Client mode — D-02, D-06 */}
        {compareSubMode === 'client' && (
          <div className="flex items-center gap-2">
            <select
              value={compareClientId ?? ''}
              onChange={(e) => onClientChange(e.target.value || null)}
              className="h-9 pl-3 pr-8 text-sm font-medium bg-white border border-border rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors min-w-[220px]"
            >
              <option value="" disabled>Sélectionner un client...</option>
              {clientsLoading && (
                <option value="" disabled>Chargement...</option>
              )}
              {clientsError && (
                <option value="" disabled>Erreur de chargement</option>
              )}
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {/* D-02: same sport note */}
            <p className="text-xs text-muted">Même sport requis</p>
          </div>
        )}

        {/* Period mode — D-03 */}
        {compareSubMode === 'period' && (
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-md">
              {PERIOD_LABELS[currentDateRange]}
            </span>
            <span className="text-sm text-muted">vs.</span>
            <div className="flex items-center bg-[#F0EFE9] rounded-lg p-0.5 border border-border">
              {PERIOD_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onPeriodChange(key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    comparePeriod === key ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator — D-07 style */}
        {compareLoading && (
          <div className="flex items-center gap-2 ml-auto text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Chargement de la comparaison…</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {compareError && !compareLoading && (
        <div className="flex items-center justify-center gap-2 py-4 px-4 rounded-lg bg-[#FEE2E2] border border-[#EF4444]/20 mt-2">
          <AlertCircle className="w-4 h-4 text-[#B91C1C] flex-shrink-0" />
          <p className="text-sm text-[#B91C1C]">Impossible de charger les données de comparaison. Réessayez.</p>
        </div>
      )}
    </div>
  );
}
