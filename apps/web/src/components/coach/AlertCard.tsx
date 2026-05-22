'use client';
import { useRef } from 'react';
import { IoOpenOutline } from 'react-icons/io5';
import gsap from 'gsap';

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

const SEVERITY_COLORS: Record<CoachAlert['severity'], string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#EAB308',
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
  apiUrl: string;
  accessToken: string;
}

export function AlertCard({ alert, onDismiss, apiUrl, accessToken }: AlertCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const dotColor = SEVERITY_COLORS[alert.severity];
  const typeLabel = ALERT_TYPE_LABELS[alert.alert_type];
  const timestamp = formatTimestamp(alert.created_at);
  const clientName = alert.clientName ?? 'Client inconnu';

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    // Fire-and-forget PATCH to mark as read
    fetch(`${apiUrl}/coach/ai/alerts/${alert.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {
      // Intentional: fire-and-forget
    });

    // GSAP collapse animation, then remove from parent state
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        opacity: 0,
        height: 0,
        marginBottom: 0,
        duration: 0.2,
        ease: 'power2.in',
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
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColor,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        {/* Client name */}
        <span className="text-sm font-semibold text-[#1C1A17]">{clientName}</span>
        <span className="text-sm text-[#6B6963]">·</span>
        {/* Alert type label */}
        <span className="text-sm font-normal text-[#6B6963]">{typeLabel}</span>
        {/* Timestamp right-aligned */}
        <span className="text-xs font-normal text-[#6B6963] ml-auto">{timestamp}</span>
      </div>

      {/* Summary text */}
      <p className="text-sm font-normal text-[#1C1A17] mt-1 line-clamp-2">{alert.summary}</p>

      {/* Footer row */}
      <div className="flex items-center mt-3 gap-3">
        <a
          href={`/fr/coach/ai?client=${alert.client_id}`}
          className="text-sm text-primary font-semibold flex items-center gap-1 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <IoOpenOutline size={14} />
          Ouvrir le chat →
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-sm text-[#6B6963] hover:text-[#1C1A17] ml-auto transition-colors"
        >
          Marquer lu
        </button>
      </div>
    </div>
  );
}
