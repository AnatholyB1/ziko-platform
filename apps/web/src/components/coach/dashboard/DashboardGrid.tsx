'use client';

import type { Widget } from '@/types/dashboard';

interface DashboardGridProps {
  widgets: Widget[];
  clientId: string;
  isEditMode?: boolean;
}

export function DashboardGrid({ widgets, clientId, isEditMode = false }: DashboardGridProps) {
  return (
    <div data-testid="dashboard-grid">
      {widgets.map((w) => (
        <div key={w.id}>{w.title}</div>
      ))}
    </div>
  );
}
