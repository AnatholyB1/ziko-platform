'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from 'framer-motion';
import {
  IoAnalyticsOutline,
  IoBarChartOutline,
  IoAlertCircleOutline,
} from 'react-icons/io5';

interface ToolResultCardProps {
  toolName: string;
  status: 'pending' | 'success' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
}

// Tool metadata
const TOOL_META: Record<string, { icon: React.ComponentType<{ size: number; color: string }>; credit: string }> = {
  analyze_client: { icon: IoAnalyticsOutline, credit: '2 cr' },
  generate_coaching_program: { icon: IoBarChartOutline, credit: '3 cr' },
  monitor_client_alerts: { icon: IoAlertCircleOutline, credit: '1 cr' },
};

const StatusChip = React.forwardRef<HTMLSpanElement, { status: 'pending' | 'success' | 'error' }>(
  function StatusChip({ status }, ref) {
    if (status === 'pending') {
      return <span ref={ref} className="bg-info-subtle text-info border border-info/30 text-xs px-2 py-0.5 rounded">En cours...</span>;
    }
    if (status === 'success') {
      return <span ref={ref} className="bg-success-subtle text-success border border-success/30 text-xs px-2 py-0.5 rounded">Terminé</span>;
    }
    return <span ref={ref} className="bg-danger-subtle text-danger border border-danger/30 text-xs px-2 py-0.5 rounded">Échec</span>;
  }
);

export function ToolResultCard({ toolName, status, args, result }: ToolResultCardProps) {
  const meta = TOOL_META[toolName];
  const Icon = meta?.icon ?? IoAnalyticsOutline;
  const credit = meta?.credit ?? '? cr';

  const cardRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Card entrance animation
  useEffect(() => {
    if (cardRef.current && !prefersReducedMotion) {
      gsap.from(cardRef.current, { opacity: 0, y: 8, duration: 0.22, ease: 'power2.out' });
    }
  }, []);

  // Status chip transition
  useEffect(() => {
    if (chipRef.current && !prefersReducedMotion) {
      gsap.fromTo(chipRef.current, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out' });
    }
  }, [status]);

  // Extract program_id from result for generate_coaching_program
  const programId = result && typeof result === 'object' && 'program_id' in result
    ? (result as { program_id?: string }).program_id
    : undefined;

  return (
    <div ref={cardRef} className="bg-surface-alt border border-border rounded-lg p-2 my-2 text-sm">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Icon size={16} color="var(--color-muted)" />
        <span className="text-sm font-semibold text-text">{toolName}</span>
        <span className="ml-auto bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded">
          {credit}
        </span>
      </div>

      {/* Args row */}
      {args && Object.keys(args).length > 0 && (
        <p className="text-xs text-muted mt-1">
          {Object.entries(args)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(' · ')}
        </p>
      )}

      {/* Status + result */}
      <div className="flex items-center gap-2 mt-1">
        <StatusChip ref={chipRef} status={status} />

        {/* generate_coaching_program success badge */}
        {toolName === 'generate_coaching_program' && status === 'success' && (
          <>
            <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-2 py-0.5 rounded">
              Programme créé
            </span>
            {programId && (
              <a
                href={`/coach/programs/${programId}`}
                className="text-xs text-primary font-semibold underline ml-1"
              >
                Voir le programme →
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
