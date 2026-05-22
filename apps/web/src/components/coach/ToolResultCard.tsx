'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
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

function StatusChip({ status }: { status: 'pending' | 'success' | 'error' }) {
  if (status === 'pending') {
    return (
      <span className="status-chip bg-blue-50 text-blue-600 border border-blue-200 text-xs px-2 py-0.5 rounded">
        En cours...
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="status-chip bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded">
        Terminé
      </span>
    );
  }
  return (
    <span className="status-chip bg-red-50 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded">
      Échec
    </span>
  );
}

export function ToolResultCard({ toolName, status, args, result }: ToolResultCardProps) {
  const meta = TOOL_META[toolName];
  const Icon = meta?.icon ?? IoAnalyticsOutline;
  const credit = meta?.credit ?? '? cr';

  // Card entrance animation
  useEffect(() => {
    gsap.from('.tool-card', {
      opacity: 0,
      y: 8,
      duration: 0.22,
      ease: 'power2.out',
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Status chip transition
  useEffect(() => {
    gsap.fromTo(
      '.status-chip',
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out' }
    );
  }, [status]);

  // Extract program_id from result for generate_coaching_program
  const programId = result && typeof result === 'object' && 'program_id' in result
    ? (result as { program_id?: string }).program_id
    : undefined;

  return (
    <div className="bg-[#F0EFE9] border border-[#E2E0DA] rounded-lg p-2 my-2 text-sm tool-card">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <Icon size={16} color="#6B6963" />
        <span className="text-sm font-semibold text-[#1C1A17]">{toolName}</span>
        <span className="ml-auto bg-[#FF5C1A]/10 text-[#FF5C1A] text-xs font-semibold px-2 py-0.5 rounded">
          {credit}
        </span>
      </div>

      {/* Args row */}
      {args && Object.keys(args).length > 0 && (
        <p className="text-xs text-[#6B6963] mt-1">
          {Object.entries(args)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(' · ')}
        </p>
      )}

      {/* Status + result */}
      <div className="flex items-center gap-2 mt-1">
        <StatusChip status={status} />

        {/* generate_coaching_program success badge */}
        {toolName === 'generate_coaching_program' && status === 'success' && (
          <>
            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2 py-0.5 rounded">
              Programme créé
            </span>
            {programId && (
              <a
                href={`/coach/programs/${programId}`}
                className="text-xs text-[#FF5C1A] font-semibold underline ml-1"
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
