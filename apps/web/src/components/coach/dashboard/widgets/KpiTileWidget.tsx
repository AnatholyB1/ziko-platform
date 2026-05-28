'use client'

import { Loader2 } from 'lucide-react'
import { KpiTileWidget as KpiTileWidgetType } from '@/types/dashboard'
import { WidgetCard } from './WidgetCard'
import { useWidgetData } from '@/hooks/useWidgetData'
import { DeltaChip } from './DeltaChip'
import { LegendDot } from './LegendDot'

interface Props {
  widget: KpiTileWidgetType
  clientId: string
  compareMode?: boolean
  compareClientId?: string | null
  comparePeriod?: string | null
  subjectALabel?: string
  subjectBLabel?: string
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h${minutes % 60}m`
  }
  return `${minutes}min`
}

function formatValue(raw: number | null, format: string | undefined): string {
  if (raw == null) return '\u2014'
  switch (format) {
    case 'percent':
      return `${Math.round(raw)}%`
    case 'duration':
      return formatDuration(raw)
    case 'number':
    default:
      return String(Math.round(raw))
  }
}

export function KpiTileWidget({
  widget,
  clientId,
  compareMode,
  compareClientId,
  comparePeriod,
  subjectALabel,
  subjectBLabel,
}: Props) {
  const { data, isLoading, error } = useWidgetData(
    clientId,
    'kpi_tile',
    widget.period,
    widget.config.dataKey,
  )

  const isCompareActive = compareMode === true && !!compareClientId

  const compareResult = useWidgetData(
    compareClientId ?? '',
    'kpi_tile',
    comparePeriod ?? widget.period,
    widget.config.dataKey,
    isCompareActive,
  )

  const rawA = (data as { value: number } | null)?.value ?? null
  const rawB = isCompareActive
    ? (compareResult.data as { value: number } | null)?.value ?? null
    : null

  const formattedValueA = formatValue(rawA, widget.config.format)
  const formattedValueB = formatValue(rawB, widget.config.format)

  const delta =
    rawA != null && rawB != null
      ? Math.round((rawB - rawA) * 10) / 10
      : 0

  return (
    <WidgetCard
      title={widget.title}
      period={widget.period}
      isLoading={isLoading}
      error={error?.message ?? null}
    >
      {isCompareActive ? (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <div className="flex items-baseline gap-2 flex-wrap justify-center">
            <span className="text-[22px] font-bold text-text">
              {formattedValueA}
              {widget.config.unit && (
                <span className="text-base text-muted ml-0.5">{widget.config.unit}</span>
              )}
            </span>
            <span className="text-muted text-base">/</span>
            {compareResult.isLoading ? (
              <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
            ) : (
              <span className="text-[22px] font-bold text-[#3B82F6]">
                {formattedValueB}
                {widget.config.unit && (
                  <span className="text-base text-[#3B82F6]/60 ml-0.5">{widget.config.unit}</span>
                )}
              </span>
            )}
            {rawA != null && rawB != null && (
              <DeltaChip delta={delta} unit={widget.config.unit} />
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <LegendDot color="#FF5C1A" label={subjectALabel ?? 'Sujet A'} />
            <LegendDot color="#3B82F6" label={subjectBLabel ?? 'Sujet B'} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <span className="text-4xl font-bold text-text">{formattedValueA}</span>
          {widget.config.unit && (
            <span className="text-sm text-muted">{widget.config.unit}</span>
          )}
        </div>
      )}
    </WidgetCard>
  )
}
