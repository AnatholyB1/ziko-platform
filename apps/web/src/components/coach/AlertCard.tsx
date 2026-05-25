'use client';
import { useRef } from 'react';
import { IoOpenOutline } from 'react-icons/io5';
import gsap from 'gsap';
import { useLocale } from 'next-intl';

export interface CoachAlert {
  id: string;
  coach_id?: string;
  client_id: string;
  alert_type: 'missed_sessions' | 'sleep_drop' | 'mood_decline' | 'rpe_inflation';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  is_read: boolean;
  created_at: string;
  clientName?: string;
}

const severityBgClass: Record<CoachAlert['severity'], string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-caution',
};

const ALERT_TYPE_LABELS: Record<CoachAlert['alert_type'], string> = {
  missed_sessions: 'Séances manquées',
  sleep_drop: 'Chute de sommeil',
  mood_decline: 'Humeur en baisse',
  rpe_inflation: 'RPE en hausse',
};

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return 'Il y a moins d\'1h';
    if (diffH < 24) return `Il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `Il y a ${diffD}j`;
  } catch {
    return '';
  }
}

interface AlertCardProps {
  alert: CoachAlert;
  onDismiss: (id: string) => void;
}

export function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const locale = useLocale();
  const cardRef = useRef<HTMLDivElement>(null);

  const typeLabel = ALERT_TYPE_LABELS[alert.alert_type];
  const timestamp = formatTimestamp(alert.created_at);
  const clientName = alert.clientName ?? 'Client inconnu';

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    // Fire-and-forget PATCH to mark as read
    fetch(`/api/coach/ai/alerts/${alert.id}/read`, {
      method: 'PATCH',
    }).catch(() => {
      // Intentional: fire-and-forget
    });

    // GSAP collapse animation, then remove from parent state.
    // Skip animation when the user has requested reduced motion.
    const mq = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) {
      onDismiss(alert.id);
    } else if (cardRef.current) {
      gsap.to(cardRef.current, {
        opacity: 0,
        scaleY: 0,
        duration: 0.18,
        ease: 'power2.in',
        transformOrigin: 'top',
        onComplete: () => onDismiss(alert.id),
      });
    } else {
      onDismiss(alert.id);
    }
  }

  return (
    <div
      ref={cardRef}
      className="border border-border rounded-lg p-4 mb-3 last:mb-0 alert-card overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {/* Severity dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 inline-block ${severityBgClass[alert.severity]}`} />
        {/* Client name */}
        <span className="text-sm font-semibold text-text">{clientName}</span>
        <span className="text-sm text-muted">·</span>
        {/* Alert type label */}
        <span className="text-sm font-normal text-muted">{typeLabel}</span>
        {/* Timestamp right-aligned */}
        <span className="text-xs font-normal text-muted ml-auto">{timestamp}</span>
      </div>

      {/* Summary text */}
      <p className="text-sm font-normal text-text mt-1 line-clamp-2">{alert.summary}</p>

      {/* Footer row */}
      <div className="flex items-center mt-3 gap-3">
        <a
          href={`/${locale}/coach/ai?client=${alert.client_id}`}
          className="text-sm text-primary font-semibold flex items-center gap-1 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <IoOpenOutline size={14} />
          Ouvrir le chat →
        </a>
        <button
          type="button"
          aria-label={`Marquer comme lu : ${typeLabel} – ${clientName}`}
          onClick={handleDismiss}
          className="text-sm text-muted hover:text-text ml-auto transition-colors"
        >
          Marquer lu
        </button>
      </div>
    </div>
  );
}
