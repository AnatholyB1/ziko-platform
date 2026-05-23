'use client';
import { useState } from 'react';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { useLocale } from 'next-intl';
import { AlertCard } from './AlertCard';
import type { CoachAlert } from './AlertCard';

interface AlertsPanelProps {
  initialAlerts: CoachAlert[];
}

export function AlertsPanel({ initialAlerts }: AlertsPanelProps) {
  const locale = useLocale();
  const [alerts, setAlerts] = useState<CoachAlert[]>(initialAlerts);
  const [showAll, setShowAll] = useState(false);

  const MAX_VISIBLE = 3;
  const unreadCount = alerts.length;
  const visibleAlerts = showAll ? alerts : alerts.slice(0, MAX_VISIBLE);
  const overflowCount = alerts.length - MAX_VISIBLE;

  function handleDismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function handleMarkAllRead() {
    // Fire-and-forget POST to mark all read
    fetch('/api/coach/ai/alerts/read-all', {
      method: 'POST',
    }).catch(() => {
      // Intentional: fire-and-forget
    });
    setAlerts([]);
  }

  function handleShowAll() {
    setShowAll(true);
  }

  // No-alerts state
  if (alerts.length === 0) {
    return (
      <div className="alerts-panel bg-white rounded-2xl p-6 border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <IoShieldCheckmarkOutline size={20} className="text-success" />
          <span className="text-sm text-muted">Tous vos clients sont dans de bonnes conditions.</span>
        </div>
      </div>
    );
  }

  // With-alerts state
  return (
    <div className="alerts-panel bg-white rounded-2xl p-6 border border-border shadow-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">Alertes coaching</h2>
        <span className="alert-badge bg-primary text-white text-xs font-semibold px-2 py-0.5 rounded-full">
          {unreadCount} non {unreadCount > 1 ? 'lues' : 'lue'}
        </span>
      </div>

      {/* Alert cards */}
      <div>
        {visibleAlerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onDismiss={handleDismiss}
          />
        ))}
      </div>

      {/* Overflow indicator */}
      {!showAll && overflowCount > 0 && (
        <div className="text-center py-3 text-sm text-muted border-t border-dashed border-border">
          <span>+ {overflowCount} {overflowCount > 1 ? 'autres alertes' : 'autre alerte'}</span>
          {' · '}
          <button
            type="button"
            onClick={handleShowAll}
            className="text-primary font-semibold text-sm hover:underline"
          >
            Afficher tout ↓
          </button>
        </div>
      )}

      {/* Panel footer */}
      <div className="flex justify-between mt-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="text-sm text-muted hover:text-text transition-colors"
        >
          Tout marquer comme lu
        </button>
        <a
          href={`/${locale}/coach/ai`}
          className="text-sm text-primary font-semibold hover:underline"
        >
          Voir dans l&apos;IA Coach →
        </a>
      </div>
    </div>
  );
}
