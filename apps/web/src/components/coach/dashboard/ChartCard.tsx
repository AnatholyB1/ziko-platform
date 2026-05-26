'use client';

import { ResponsiveContainer } from 'recharts';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  aiInsight?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function ChartCard({ title, children, aiInsight, style, className }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-border p-6 ${className ?? ''}`} style={style}>
      <h3 className="text-[15px] font-semibold text-text mb-4">{title}</h3>
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
