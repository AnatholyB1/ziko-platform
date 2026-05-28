'use client'

import { use, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardConfig } from '@/hooks/useDashboardConfig'
import { DashboardGrid } from '@/components/coach/dashboard/DashboardGrid'
import { DashboardLoadingState } from '@/components/coach/dashboard/DashboardLoadingState'
import { DashboardEditOverlay } from '@/components/coach/dashboard/DashboardEditOverlay'
import type { Widget } from '@/types/dashboard'
import { DashboardControlBar } from '@/components/coach/dashboard/DashboardControlBar'
import { DashboardEmptyState } from '@/components/coach/dashboard/DashboardEmptyState'
import { PowerliftingDashboard } from '@/components/coach/dashboard/PowerliftingDashboard'
import { HyroxDashboard } from '@/components/coach/dashboard/HyroxDashboard'
import { RunningDashboard } from '@/components/coach/dashboard/RunningDashboard'
import { BodybuildingDashboard } from '@/components/coach/dashboard/BodybuildingDashboard'
import { WeightLossDashboard } from '@/components/coach/dashboard/WeightLossDashboard'

type SportType = 'powerlifting' | 'hyrox' | 'running' | 'bodybuilding' | 'weightloss'

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

  const [activeTab, setActiveTab] = useState<'sport' | 'widget'>('sport')
  const [sport, setSport] = useState<SportType | null>(null)
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3m'>('month')

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
    queryClient.setQueryData(['dashboard-config', clientId], {
      schema_version: 1 as const,
      widgets: newWidgets,
    })
    setIsEditing(false)
  }

  function handleCancel() {
    setIsEditing(false)
  }

  return (
    <div>
      {/* Sub-tab strip — per D-17, D-18, D-20. Has pdf-exclude class so it is excluded from PDF capture */}
      <div className="pdf-exclude flex items-center bg-[#F0EFE9] rounded-lg p-0.5 border border-border w-fit mb-4">
        <button
          onClick={() => setActiveTab('sport')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'sport' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-text'}`}
        >Sport</button>
        <button
          onClick={() => setActiveTab('widget')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'widget' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-text'}`}
        >Personnalisé</button>
      </div>

      {/* Tab content — key prop forces remount on switch, triggering CSS fadeIn */}
      <div key={activeTab} className="animate-[fadeIn_150ms_ease-out_forwards]">
        {activeTab === 'sport' && (
          <>
            {/* pdf-exclude wraps ControlBar only — not the charts below */}
            <div className="pdf-exclude">
              <DashboardControlBar
                sport={sport}
                onSportChange={setSport}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>
            {sport === 'powerlifting' && <PowerliftingDashboard clientId={clientId} sport={sport} dateRange={dateRange} />}
            {sport === 'hyrox' && <HyroxDashboard clientId={clientId} sport={sport} dateRange={dateRange} />}
            {sport === 'running' && <RunningDashboard clientId={clientId} sport={sport} dateRange={dateRange} />}
            {sport === 'bodybuilding' && <BodybuildingDashboard clientId={clientId} sport={sport} dateRange={dateRange} />}
            {sport === 'weightloss' && <WeightLossDashboard clientId={clientId} sport={sport} dateRange={dateRange} />}
            {sport === null && <DashboardEmptyState />}
          </>
        )}
        {activeTab === 'widget' && (
          <>
            {/* Personnalisé tab header — per D-19 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-text">Tableau de bord personnalisé</h2>
                <p className="text-sm text-muted mt-0.5">Vue personnalisée pour ce client</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!isEditMode) { previousConfigRef.current = config.widgets }
                    setIsEditMode(prev => !prev)
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-normal transition-colors ${isEditMode ? 'bg-primary text-white' : 'bg-white border border-border text-text hover:bg-[#F7F6F3]'}`}
                >
                  {isEditMode ? 'Terminer' : 'Éditer'}
                </button>
              </div>
            </div>
            {isEditMode && <p className="text-xs text-muted mb-3">Faites glisser les widgets pour réorganiser...</p>}
            <DashboardGrid widgets={config.widgets} clientId={clientId} isEditMode={isEditMode} />
            {isEditing && (
              <DashboardEditOverlay
                clientId={clientId}
                initialWidgets={config.widgets}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
