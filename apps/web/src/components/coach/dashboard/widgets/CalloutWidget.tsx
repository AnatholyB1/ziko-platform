'use client'

import { CalloutWidget as CalloutWidgetType } from '@/types/dashboard'
import { WidgetCard } from './WidgetCard'

interface Props {
  widget: CalloutWidgetType
}

const SEVERITY_COLORS = {
  info: '#3B82F6',
  warning: '#FF5C1A',
  success: '#22C55E',
} as const

const SEVERITY_LABELS = {
  info: 'Info',
  warning: 'Attention',
  success: 'Succès',
} as const

export function CalloutWidget({ widget }: Props) {
  const color = SEVERITY_COLORS[widget.config.severity]

  return (
    <WidgetCard title={widget.title} period={undefined} isLoading={false} error={null}>
      <div
        className="h-full flex items-start gap-3 rounded-xl p-4"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div>
          <p
            className="text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color }}
          >
            {SEVERITY_LABELS[widget.config.severity]}
          </p>
          <p className="text-sm text-text leading-relaxed">{widget.config.message}</p>
        </div>
      </div>
    </WidgetCard>
  )
}
