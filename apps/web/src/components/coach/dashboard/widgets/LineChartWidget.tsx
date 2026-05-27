'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { LineChartWidget as LineChartWidgetType } from '@/types/dashboard'
import { WidgetCard } from './WidgetCard'
import { useWidgetData } from '@/hooks/useWidgetData'

interface Props {
  widget: LineChartWidgetType
  clientId: string
}

export function LineChartWidget({ widget, clientId }: Props) {
  const { data, isLoading, error } = useWidgetData(
    clientId,
    'line_chart',
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
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
            <Line
              type="monotone"
              dataKey="value"
              stroke={widget.config.color ?? '#FF5C1A'}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </WidgetCard>
  )
}
