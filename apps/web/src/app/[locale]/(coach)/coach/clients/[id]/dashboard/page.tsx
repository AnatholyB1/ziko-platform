'use client'

import { use, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardConfig } from '@/hooks/useDashboardConfig'
import { DashboardGrid } from '@/components/coach/dashboard/DashboardGrid'
import { DashboardLoadingState } from '@/components/coach/dashboard/DashboardLoadingState'
import { DashboardEditOverlay } from '@/components/coach/dashboard/DashboardEditOverlay'
import type { Widget } from '@/types/dashboard'

export default function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = use(params)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const previousConfigRef = useRef<Widget[]>([])
  const queryClient = useQueryClient()
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

  function handleSave(newWidgets: Widget[]) {
    // Update TanStack Query cache so view-mode grid reflects new config immediately
    queryClient.setQueryData(['dashboard-config', clientId], {
      schema_version: 1 as const,
      widgets: newWidgets,
    })
    setIsEditing(false)
  }

  function handleCancel() {
    // Instant close — no confirmation dialog (D-13, PITFALLS #12)
    setIsEditing(false)
  }

  return (
    <div>
      {/* Edit mode toggle bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text">
          Tableau de bord ({config.widgets.length} widgets)
        </h2>
        <div className="flex items-center gap-2">
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

          {/* Personnaliser button — visible only when not in AI edit session (T-03-12) */}
          {!isEditing && (
            <button
              onClick={() => {
                previousConfigRef.current = config.widgets
                setIsEditing(true)
              }}
              style={{
                height: 36,
                paddingLeft: 16,
                paddingRight: 16,
                backgroundColor: 'transparent',
                border: '1px solid #E2E0DA',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: '#1C1A17',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F0EFE9'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              }}
            >
              {/* Pencil icon — inline SVG, 14px */}
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1C1A17"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Personnaliser
            </button>
          )}
        </div>
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

      {/* AI Edit overlay — covers main content when isEditing=true */}
      {isEditing && config && (
        <DashboardEditOverlay
          clientId={clientId}
          initialWidgets={config.widgets}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
