'use client';
import { useState, useEffect, useRef } from 'react';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import gsap from 'gsap';
import { AlertCard } from './AlertCard';
import type { CoachAlert } from './AlertCard';

interface AlertsPanelProps {
  initialAlerts: CoachAlert[];
  coachId: string;
  accessToken: string;
  apiUrl: string;
}

export function AlertsPanel({ initialAlerts, coachId: _coachId, accessToken, apiUrl }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<CoachAlert[]>(initialAlerts);
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const MAX_VISIBLE = 3;
  const unreadCount = alerts.length;
  const visibleAlerts = showAll ? alerts : alerts.slice(0, MAX_VISIBLE);
  const overflowCount = alerts.length - MAX_VISIBLE;

  // Panel entrance animation on mount
  useEffect(() => {
    gsap.from('.alerts-panel', {
      opacity: 0,
      y: 16,
      duration: 0.2,
      ease: 'power2.out',
    });
    if (alerts.length > 0) {
      // Stagger alert cards
      gsap.from('.alert-card', {
        opacity: 0,
        x: -8,
        duration: 0.2,
        stagger: 0.07,
        ease: 'power2.out',
        delay: 0.1,
      });
      // Badge entrance
      gsap.fromTo(
        '.alert-badge',
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)', delay: 0.15 },
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function handleMarkAllRead() {
    // Fire-and-forget POST to mark all read
    fetch(`${apiUrl}/coach/ai/alerts/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {
      // Intentional: fire-and-forget
    });
    setAlerts([]);
  }

  function handleShowAll() {
    setShowAll(true);
    if (overflowRef.current) {
      gsap.from('.overflow-alerts', {
        height: 0,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.inOut',
      });
    }
  }

  // No-alerts state
  if (alerts.length === 0) {
    return (
      <div className="alerts-panel bg-white rounded-2xl p-6 border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <IoShieldCheckmarkOutline size={20} color="#22C55E" />
          <span className="text-sm text-[#6B6963]">Tous vos clients sont dans de bonnes conditions.</span>
        </div>
      </div>
    );
  }

  // With-alerts state
  return (
    <div ref={panelRef} className="alerts-panel bg-white rounded-2xl p-6 border border-border shadow-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#1C1A17]">Alertes coaching</h2>
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
            apiUrl={apiUrl}
            accessToken={accessToken}
          />
        ))}
      </div>

      {/* Overflow indicator */}
      {!showAll && overflowCount > 0 && (
        <div className="text-center py-3 text-sm text-[#6B6963] border-t border-dashed border-border">
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

      {/* Overflow alerts (hidden until showAll) */}
      {showAll && overflowCount > 0 && (
        <div ref={overflowRef} className="overflow-alerts" />
      )}

      {/* Panel footer */}
      <div className="flex justify-between mt-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="text-sm text-[#6B6963] hover:text-[#1C1A17] transition-colors"
        >
          Tout marquer comme lu
        </button>
        <a
          href="/fr/coach/ai"
          className="text-sm text-primary font-semibold hover:underline"
        >
          Voir dans l&apos;IA Coach →
        </a>
      </div>
    </div>
  );
}
