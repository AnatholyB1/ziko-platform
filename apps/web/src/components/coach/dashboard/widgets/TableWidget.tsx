'use client'

import { TableWidget as TableWidgetType } from '@/types/dashboard'
import { useWidgetData } from '@/hooks/useWidgetData'
import { WidgetCard } from './WidgetCard'

interface Props {
  widget: TableWidgetType
  clientId: string
}

export function TableWidget({ widget, clientId }: Props) {
  const { data, isLoading, error } = useWidgetData(clientId, 'table', widget.period, 'rows')

  const rows = (data as { rows: Array<Record<string, unknown>> } | null)?.rows ?? []

  return (
    <WidgetCard
      title={widget.title}
      period={widget.period}
      isLoading={isLoading}
      error={error?.message ?? null}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center pt-8">Aucune donnée disponible.</p>
      ) : (
        <div className="overflow-auto max-h-52">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {widget.config.columns.map(col => (
                  <th
                    key={col.key}
                    className="py-2 px-3 text-left text-xs font-bold tracking-wide uppercase text-muted bg-[#F7F6F3] sticky top-0"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-[#F7F6F3]">
                  {widget.config.columns.map(col => (
                    <td key={col.key} className="py-2 px-3 text-text">
                      {String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  )
}
