'use client'

import { ThresholdIndicatorWidget as ThresholdIndicatorWidgetType } from '@/types/dashboard'
import { useWidgetData } from '@/hooks/useWidgetData'
import { WidgetCard } from './WidgetCard'

interface Props {
  widget: ThresholdIndicatorWidgetType
  clientId: string
}

export function ThresholdIndicatorWidget({ widget, clientId }: Props) {
  const { data, isLoading, error } = useWidgetData(
    clientId,
    'threshold_indicator',
    widget.period,
    widget.config.dataKey,
  )

  const value = (data as { value: number } | null)?.value ?? null

  return (
    <WidgetCard
      title={widget.title}
      period={widget.period}
      isLoading={isLoading}
      error={error?.message ?? null}
    >
      {value === null ? (
        <p className="text-sm text-muted text-center pt-8">—</p>
      ) : (
        (() => {
          const pct = Math.min(100, Math.round((value / widget.config.threshold) * 100))
          const isAbove = value >= widget.config.threshold
          const barColor = isAbove ? '#22C55E' : '#FF5C1A'

          return (
            <div className="flex flex-col gap-3 justify-center h-full px-2">
              <div className="flex items-end justify-between mb-1">
                <span className="text-3xl font-bold text-text">
                  {value}
                  {widget.config.unit ? ` ${widget.config.unit}` : ''}
                </span>
                <span className="text-xs text-muted">
                  seuil: {widget.config.threshold}
                  {widget.config.unit ? ` ${widget.config.unit}` : ''}
                </span>
              </div>
              <div className="w-full bg-[#E2E0DA] rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
              <span className="text-xs text-muted text-right">{pct}%</span>
            </div>
          )
        })()
      )}
    </WidgetCard>
  )
}
