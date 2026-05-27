'use client'

import type { Widget } from '@/types/dashboard'
import { LineChartWidget } from './widgets/LineChartWidget'
import { BarChartWidget } from './widgets/BarChartWidget'
import { KpiTileWidget } from './widgets/KpiTileWidget'
import { TableWidget } from './widgets/TableWidget'
import { AthleteListWidget } from './widgets/AthleteListWidget'
import { ThresholdIndicatorWidget } from './widgets/ThresholdIndicatorWidget'
import { CalloutWidget } from './widgets/CalloutWidget'

interface Props {
  widget: Widget
  clientId: string
}

export function WidgetRenderer({ widget, clientId }: Props) {
  switch (widget.type) {
    case 'line_chart':
      return <LineChartWidget widget={widget} clientId={clientId} />
    case 'bar_chart':
      return <BarChartWidget widget={widget} clientId={clientId} />
    case 'kpi_tile':
      return <KpiTileWidget widget={widget} clientId={clientId} />
    case 'table':
      return <TableWidget widget={widget} clientId={clientId} />
    case 'athlete_list':
      return <AthleteListWidget widget={widget} clientId={clientId} />
    case 'threshold_indicator':
      return <ThresholdIndicatorWidget widget={widget} clientId={clientId} />
    case 'callout':
      return <CalloutWidget widget={widget} />
    default: {
      // Exhaustive check — TypeScript will flag unhandled types at compile time
      const _exhaustive: never = widget
      void _exhaustive
      return <div className="text-xs text-muted p-4">Widget inconnu</div>
    }
  }
}
