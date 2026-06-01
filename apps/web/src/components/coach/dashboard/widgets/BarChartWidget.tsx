'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { BarChartWidget as BarChartWidgetType } from '@/types/dashboard'
import { WidgetCard } from './WidgetCard'
import { useWidgetData } from '@/hooks/useWidgetData'

interface Props {
  widget: BarChartWidgetType
  clientId: string
  compareMode?: boolean
  compareClientId?: string | null
  comparePeriod?: string | null
  subjectALabel?: string
  subjectBLabel?: string
}

function mergeForCompare(
  dataA: { date: string; value: number }[],
  dataB: { date: string; value: number }[]
): { date: string; valueA: number | null; valueB: number | null }[] {
  const mapB = new Map(dataB.map((d) => [d.date, d.value]));
  return dataA.map((d) => ({ date: d.date, valueA: d.value, valueB: mapB.get(d.date) ?? null }));
}

export function BarChartWidget({
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
    'bar_chart',
    widget.period,
    widget.config.dataKey,
  )

  const isCompareActive = compareMode === true && !!compareClientId

  const compareResult = useWidgetData(
    compareClientId ?? '',
    'bar_chart',
    comparePeriod ?? widget.period,
    widget.config.dataKey,
    isCompareActive,
  )

  const chartDataA =
    (data as { data: Array<{ date: string; value: number }> } | null)?.data ?? []

  const chartDataB =
    (compareResult.data as { data: Array<{ date: string; value: number }> } | null)?.data ?? []

  const mergedData = isCompareActive ? mergeForCompare(chartDataA, chartDataB) : null

  return (
    <div className="relative">
      <WidgetCard
        title={widget.title}
        period={widget.period}
        isLoading={isLoading}
        error={error?.message ?? null}
      >
        {(mergedData ?? chartDataA).length === 0 ? (
          <p className="text-sm text-muted text-center pt-8">Aucune donnée disponible.</p>
        ) : isCompareActive && mergedData ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mergedData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  widget.config.unit ? `${v}${widget.config.unit}` : String(v)
                }
              />
              <Tooltip
                formatter={(v, name) => [
                  widget.config.unit ? `${v} ${widget.config.unit}` : v,
                  name,
                ]}
              />
              <Bar
                dataKey="valueA"
                fill="#FF5C1A"
                name={subjectALabel ?? 'Sujet A'}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="valueB"
                fill="#3B82F6"
                name={subjectBLabel ?? 'Sujet B'}
                radius={[4, 4, 0, 0]}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#6B6963' }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartDataA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E0DA" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  widget.config.unit ? `${v}${widget.config.unit}` : String(v)
                }
              />
              <Tooltip
                formatter={(v) => [
                  widget.config.unit ? `${v} ${widget.config.unit}` : v,
                  widget.title,
                ]}
              />
              <Bar
                dataKey="value"
                fill={widget.config.color ?? '#FF5C1A'}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </WidgetCard>
      {compareMode && compareResult.isLoading && (
        <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}
    </div>
  )
}
