'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { BarChartWidget as BarChartWidgetType } from '@/types/dashboard'
import { WidgetCard } from './WidgetCard'
import { useWidgetData } from '@/hooks/useWidgetData'

interface Props {
  widget: BarChartWidgetType
  clientId: string
}

export function BarChartWidget({ widget, clientId }: Props) {
  const { data, isLoading, error } = useWidgetData(
    clientId,
    'bar_chart',
    widget.period,
    widget.config.dataKey,
  )

  const chartData =
    (data as { data: Array<{ date: string; value: number }> } | null)?.data ?? []

  return (
    <WidgetCard
      title={widget.title}
      period={widget.period}
      isLoading={isLoading}
      error={error?.message ?? null}
    >
      {chartData.length === 0 ? (
        <p className="text-sm text-muted text-center pt-8">Aucune donnée disponible.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
  )
}
