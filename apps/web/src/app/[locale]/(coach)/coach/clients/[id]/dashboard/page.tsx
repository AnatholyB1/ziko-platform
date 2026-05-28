'use client'

import { use, useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardConfig } from '@/hooks/useDashboardConfig'
import { useExportPDF } from '@/hooks/useExportPDF'
import { DashboardGrid } from '@/components/coach/dashboard/DashboardGrid'
import { DashboardLoadingState } from '@/components/coach/dashboard/DashboardLoadingState'
import { DashboardEditOverlay } from '@/components/coach/dashboard/DashboardEditOverlay'
import { TemplatePicker } from '@/components/coach/dashboard/TemplatePicker'
import type { Widget } from '@/types/dashboard'
import { DashboardControlBar } from '@/components/coach/dashboard/DashboardControlBar'
import { DashboardEmptyState } from '@/components/coach/dashboard/DashboardEmptyState'
import { PowerliftingDashboard } from '@/components/coach/dashboard/PowerliftingDashboard'
import { HyroxDashboard } from '@/components/coach/dashboard/HyroxDashboard'
import { RunningDashboard } from '@/components/coach/dashboard/RunningDashboard'
import { BodybuildingDashboard } from '@/components/coach/dashboard/BodybuildingDashboard'
import { WeightLossDashboard } from '@/components/coach/dashboard/WeightLossDashboard'
import { FileDown, Loader2, Check, Pencil } from 'lucide-react'

type SportType = 'powerlifting' | 'hyrox' | 'running' | 'bodybuilding' | 'weightloss'

export default function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = use(params)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  // isNewDashboard: null = not yet determined, true = new (no widgets), false = existing
  const [isNewDashboard, setIsNewDashboard] = useState<boolean | null>(null)
  const previousConfigRef = useRef<Widget[]>([])
  const sportDashboardRef = useRef<HTMLDivElement>(null)
  const widgetDashboardRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { data: config, isLoading, error } = useDashboardConfig(clientId)

  const [activeTab, setActiveTab] = useState<'sport' | 'widget'>('sport')
  const [sport, setSport] = useState<SportType | null>(null)
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3m'>('month')

  // Compare mode state — D-01 through D-07
  const [compareMode, setCompareMode] = useState(false)
  const [compareSubMode, setCompareSubMode] = useState<'client' | 'period'>('client')
  const [compareClientId, setCompareClientId] = useState<string | null>(null)
  const [comparePeriod, setComparePeriod] = useState<'week' | 'month' | '3m' | null>(null)

  // PDF export hook — D-12 through D-15
  const { exportPDF, exportState } = useExportPDF()
  // TODO: replace clientId with client name when available from config
  const clientName = (config as { client_name?: string } | undefined)?.client_name ?? clientId

  // Detect isNewDashboard once config loads — initialized only once (null guard)
  useEffect(() => {
    if (isNewDashboard === null && config) {
      setIsNewDashboard(config.widgets.length === 0)
    }
  }, [config, isNewDashboard])

  const showTemplatePicker = isNewDashboard === true

  const handleExportPDF = useCallback(async () => {
    if (activeTab === 'sport' && sportDashboardRef.current) {
      const slug = clientName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      const today = new Date().toISOString().slice(0, 10)
      const segment = sport ?? 'sport'
      await exportPDF(sportDashboardRef.current, `${slug}-${segment}-dashboard-${today}.pdf`)
    } else if (activeTab === 'widget' && widgetDashboardRef.current) {
      const slug = clientName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      const today = new Date().toISOString().slice(0, 10)
      await exportPDF(widgetDashboardRef.current, `${slug}-personnalise-dashboard-${today}.pdf`)
    }
  }, [activeTab, sport, exportPDF, clientName])

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

  // TemplatePicker handlers
  function handleTemplateSelect(templateWidgets: Widget[]) {
    setIsNewDashboard(false)
    queryClient.setQueryData(['dashboard-config', clientId], {
      schema_version: 1 as const,
      widgets: templateWidgets,
    })
  }

  function handleTemplateSkip() {
    setIsNewDashboard(false)
    // Backend returns [] for new dashboards — dashboard shows empty grid, coach uses Personnaliser to add widgets
  }

  function handleToggleCompare() {
    setCompareMode(prev => !prev)
    if (compareMode) {
      // closing: reset selections
      setCompareClientId(null)
      setComparePeriod(null)
    }
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
                compareMode={compareMode}
                onToggleCompare={handleToggleCompare}
                compareSubMode={compareSubMode}
                onSubModeChange={setCompareSubMode}
                compareClientId={compareClientId}
                onClientChange={setCompareClientId}
                comparePeriod={comparePeriod}
                onPeriodChange={setComparePeriod}
                currentClientId={clientId}
                compareLoading={false}
                compareError={false}
                exportState={exportState}
                onExportPDF={handleExportPDF}
              />
            </div>
            {/* Sport tab chart area — captured by PDF export. Sub-tab strip and ControlBar are excluded via pdf-exclude class */}
            <div ref={sportDashboardRef}>
              {sport === 'powerlifting' && (
                <PowerliftingDashboard
                  clientId={clientId}
                  sport={sport}
                  dateRange={dateRange}
                  compareMode={compareMode}
                  compareClientId={compareMode && compareSubMode === 'client' ? compareClientId : null}
                  comparePeriod={compareMode && compareSubMode === 'period' ? (comparePeriod ?? dateRange) : null}
                />
              )}
              {sport === 'hyrox' && (
                <HyroxDashboard
                  clientId={clientId}
                  sport={sport}
                  dateRange={dateRange}
                  compareMode={compareMode}
                  compareClientId={compareMode && compareSubMode === 'client' ? compareClientId : null}
                  comparePeriod={compareMode && compareSubMode === 'period' ? (comparePeriod ?? dateRange) : null}
                />
              )}
              {sport === 'running' && (
                <RunningDashboard
                  clientId={clientId}
                  sport={sport}
                  dateRange={dateRange}
                  compareMode={compareMode}
                  compareClientId={compareMode && compareSubMode === 'client' ? compareClientId : null}
                  comparePeriod={compareMode && compareSubMode === 'period' ? (comparePeriod ?? dateRange) : null}
                />
              )}
              {sport === 'bodybuilding' && (
                <BodybuildingDashboard
                  clientId={clientId}
                  sport={sport}
                  dateRange={dateRange}
                  compareMode={compareMode}
                  compareClientId={compareMode && compareSubMode === 'client' ? compareClientId : null}
                  comparePeriod={compareMode && compareSubMode === 'period' ? (comparePeriod ?? dateRange) : null}
                />
              )}
              {sport === 'weightloss' && (
                <WeightLossDashboard
                  clientId={clientId}
                  sport={sport}
                  dateRange={dateRange}
                  compareMode={compareMode}
                  compareClientId={compareMode && compareSubMode === 'client' ? compareClientId : null}
                  comparePeriod={compareMode && compareSubMode === 'period' ? (comparePeriod ?? dateRange) : null}
                />
              )}
              {sport === null && <DashboardEmptyState />}
            </div>
          </>
        )}
        {activeTab === 'widget' && (
          <>
            {showTemplatePicker ? (
              <TemplatePicker
                clientId={clientId}
                onSelect={handleTemplateSelect}
                onSkip={handleTemplateSkip}
              />
            ) : (
              <>
                {/* Personnalisé tab header — per D-19, D-15 */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-text">Tableau de bord personnalisé</h2>
                    <p className="text-sm text-muted mt-0.5">Vue personnalisée pour ce client</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* PDF export button — D-15 Personnalisé tab */}
                    <button
                      onClick={handleExportPDF}
                      disabled={exportState === 'generating'}
                      className={
                        exportState === 'generating'
                          ? 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white opacity-70 cursor-not-allowed'
                          : exportState === 'done'
                          ? 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-[#15803D] border border-[#22C55E]/30 rounded-lg bg-[#DCFCE7] transition-colors'
                          : 'h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-lg bg-white hover:bg-[#F0EFE9] transition-colors'
                      }
                    >
                      {exportState === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
                      {exportState === 'done' && <Check className="w-4 h-4 text-[#15803D]" />}
                      {(exportState === 'idle' || exportState === 'error') && <FileDown className="w-4 h-4 text-muted" />}
                      {exportState === 'generating' ? 'Génération en cours…' : exportState === 'done' ? 'PDF exporté' : exportState === 'error' ? "Erreur d'export. Réessayez." : 'Exporter PDF'}
                    </button>
                    {/* Personnaliser button — triggers DashboardEditOverlay (AI edit session) */}
                    <div className="pdf-exclude">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="h-9 px-4 flex items-center gap-1.5 text-sm font-semibold text-text border border-border rounded-lg bg-white hover:bg-[#F0EFE9] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted" />
                        Personnaliser
                      </button>
                    </div>
                    {/* Éditer button — pdf-exclude so it is not captured in PDF */}
                    <div className="pdf-exclude">
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
                </div>
                {/* Widget grid area — captured by PDF export */}
                <div ref={widgetDashboardRef}>
                  {isEditMode && <p className="text-xs text-muted mb-3">Faites glisser les widgets pour réorganiser...</p>}
                  <DashboardGrid widgets={config.widgets} clientId={clientId} isEditMode={isEditMode} />
                </div>
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
          </>
        )}
      </div>
    </div>
  )
}
