'use client';

import { ResponsiveContainer } from 'recharts';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  aiInsight?: string;
  style?: React.CSSProperties;
  className?: string;
  crossedThresholds?: Array<{
    metric_key: string;
    operator: string;
    threshold_value: number;
    current_value: number;
  }>;
  metricKey?: string;
}

export function ChartCard({ title, children, aiInsight, style, className, crossedThresholds, metricKey }: ChartCardProps) {
  const matchingAlert =
    metricKey && crossedThresholds?.length
      ? crossedThresholds.find((t) => t.metric_key === metricKey)
      : undefined;

  const alertBadge = matchingAlert
    ? (() => {
        const delta = Math.abs(
          (matchingAlert.current_value - matchingAlert.threshold_value) / matchingAlert.threshold_value
        );
        const label = `${matchingAlert.metric_key} ${matchingAlert.operator} ${matchingAlert.threshold_value}`;
        if (delta <= 0.2) {
          return (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#FF5C1A] border border-[#FF5C1A]/20">
              {label}
            </span>
          );
        }
        return (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
            {label}
          </span>
        );
      })()
    : null;

  return (
    <div className={`bg-white rounded-2xl border border-border p-6 ${className ?? ''}`} style={style}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-[15px] font-semibold text-text flex-1">{title}</h3>
        {alertBadge}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        {children as React.ReactElement}
      </ResponsiveContainer>
      <div className="border-t border-border mt-3 pt-3 flex items-center gap-2">
        <span className="text-base leading-none">🧠</span>
        <span className="text-xs text-muted flex-1">{aiInsight ?? 'Analyse IA disponible en phase 41'}</span>
      </div>
    </div>
  );
}
