'use client'

import { AthleteListWidget as AthleteListWidgetType } from '@/types/dashboard'
import { useWidgetData } from '@/hooks/useWidgetData'
import { WidgetCard } from './WidgetCard'

interface Props {
  widget: AthleteListWidgetType
  clientId: string
}

export function AthleteListWidget({ widget, clientId }: Props) {
  const { data, isLoading, error } = useWidgetData(
    clientId,
    'athlete_list',
    widget.period,
    widget.config.filter,
  )

  const athletes =
    (
      data as {
        rows: Array<{ id: string; name: string; last_activity_at: string | null }>
      } | null
    )?.rows ?? []

  return (
    <WidgetCard
      title={widget.title}
      period={widget.period}
      isLoading={isLoading}
      error={error?.message ?? null}
    >
      {athletes.length === 0 ? (
        <p className="text-sm text-muted text-center pt-8">Aucun athlète.</p>
      ) : (
        <ul className="space-y-2 overflow-auto max-h-52">
          {athletes.map(a => (
            <li
              key={a.id}
              className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
            >
              <span className="text-sm font-normal text-text">{a.name}</span>
              <span className="text-xs text-muted">
                {a.last_activity_at
                  ? new Date(a.last_activity_at).toLocaleDateString('fr-FR')
                  : 'Jamais'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
