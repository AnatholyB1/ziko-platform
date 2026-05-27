'use client'

import { KpiTileWidget as KpiTileWidgetType } from '@/types/dashboard'
import { WidgetCard } from './WidgetCard'
import { useWidgetData } from '@/hooks/useWidgetData'

interface Props {
  widget: KpiTileWidgetType
  clientId: string
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h${minutes % 60}m`
  }
  return `${minutes}min`
}

export function KpiTileWidget({ widget, clientId }: Props) {
  const { data, isLoading, error } = useWidgetData(
    clientId,
    'kpi_tile',
    widget.period,
    widget.config.dataKey,
  )

  const raw = (data as { value: number } | null)?.value ?? null

  let formattedValue: string
  if (raw == null) {
    formattedValue = '\u2014'
  } else {
    switch (widget.config.format) {
      case 'percent':
        formattedValue = `${Math.round(raw)}%`
        break
      case 'duration':
        formattedValue = formatDuration(raw)
        break
      case 'number':
      default:
        formattedValue = String(Math.round(raw))
        break
    }
  }

  return (
    <WidgetCard
      title={widget.title}
      period={widget.period}
      isLoading={isLoading}
      error={error?.message ?? null}
    >
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <span className="text-4xl font-bold text-text">{formattedValue}</span>
        {widget.config.unit && (
          <span className="text-sm text-muted">{widget.config.unit}</span>
        )}
      </div>
    </WidgetCard>
  )
}
