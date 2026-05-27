'use client'

import { use, useState } from 'react'
import { useDashboardConfig } from '@/hooks/useDashboardConfig'
import { DashboardGrid } from '@/components/coach/dashboard/DashboardGrid'
import { DashboardLoadingState } from '@/components/coach/dashboard/DashboardLoadingState'

export default function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = use(params)
  const [isEditMode, setIsEditMode] = useState(false)
  const { data: config, isLoading, error } = useDashboardConfig(clientId)

  if (isLoading) return <DashboardLoadingState />

  if (error || !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted">
          Impossible de charger le tableau de bord. Réessayez.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Edit mode toggle bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text">
          Tableau de bord ({config.widgets.length} widgets)
        </h2>
        <button
          onClick={() => setIsEditMode(prev => !prev)}
          className={`px-4 py-2 rounded-lg text-sm font-normal transition-colors ${
            isEditMode
              ? 'bg-primary text-white'
              : 'bg-white border border-border text-text hover:bg-[#F7F6F3]'
          }`}
        >
          {isEditMode ? 'Terminer' : 'Éditer'}
        </button>
      </div>

      {isEditMode && (
        <p className="text-xs text-muted mb-3">
          Faites glisser les widgets pour réorganiser la mise en page.
          Les modifications sont enregistrées automatiquement.
        </p>
      )}

      <DashboardGrid
        widgets={config.widgets}
        clientId={clientId}
        isEditMode={isEditMode}
      />
    </div>
  )
}
