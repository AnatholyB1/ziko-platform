'use client';

import type { Widget } from '@/types/dashboard';

interface DashboardEditOverlayProps {
  clientId: string;
  initialWidgets: Widget[];
  onSave: (widgets: Widget[]) => void;
  onCancel: () => void;
}

export function DashboardEditOverlay({
  clientId: _clientId,
  initialWidgets: _initialWidgets,
  onSave: _onSave,
  onCancel,
}: DashboardEditOverlayProps) {
  return (
    <div>
      <button onClick={onCancel}>Annuler</button>
    </div>
  );
}
