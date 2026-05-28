'use client';

import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { Widget } from '@/types/dashboard';
import { DashboardGrid } from './DashboardGrid';
import { EditChatPanel } from './EditChatPanel';
import { PreviewLoadingOverlay } from './PreviewLoadingOverlay';
import { SaveToast } from './SaveToast';
import { TemplateNamingModal } from './TemplateNamingModal';

interface DashboardEditOverlayProps {
  clientId: string;
  initialWidgets: Widget[];
  onSave: (widgets: Widget[]) => void;
  onCancel: () => void;
}

export function DashboardEditOverlay({
  clientId,
  initialWidgets,
  onSave,
  onCancel,
}: DashboardEditOverlayProps) {
  const [pendingWidgets, setPendingWidgets] = useState<Widget[]>(initialWidgets);
  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateToastVisible, setTemplateToastVisible] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const saveAsTemplateBtnRef = useRef<HTMLButtonElement>(null);
  // configRef is the source of truth for async SSE handlers — prevents stale closure (D-11, PITFALLS #5)
  const configRef = useRef<Widget[]>(initialWidgets);
  // previousConfigRef stores the pre-session state for one-tap Undo (D-14)
  const previousConfigRef = useRef<Widget[]>(initialWidgets);
  // conversationHistoryRef: EditChatPanel writes all non-opening messages here (MEM-02)
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // GSAP entrance — opacity 0→1, 150ms, power2.out (D-09)
  useEffect(() => {
    if (overlayRef.current) {
      gsap.from(overlayRef.current, {
        opacity: 0,
        duration: 0.15,
        ease: 'power2.out',
      });
    }
  }, []);

  // Both pendingWidgets (re-render) and configRef (async closures) updated together (D-11)
  function onWidgetsUpdate(widgets: Widget[]) {
    configRef.current = widgets;
    setPendingWidgets(widgets);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/coach/dashboards/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: configRef.current }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      onSave(configRef.current); // updates parent useDashboardConfig cache + closes overlay (isEditing=false)
      setToastVisible(true);

      // MEM-02: fire-and-forget preference inference — silent fail, non-blocking
      const preferredTypes = [...new Set(configRef.current.map((w: Widget) => w.type))];
      const recentActions = conversationHistoryRef.current
        .filter((m) => m.role === 'user')
        .slice(-3)
        .map((m) => m.content);
      fetch('/api/coach/dashboards/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: { preferred_widgets: preferredTypes },
          recent_actions: recentActions,
        }),
      }).catch(() => {}); // silent fail — preferences are best-effort (MEM-02)
    } catch (err) {
      console.error('[DashboardEditOverlay] save failed:', err);
      setSaveError('Erreur lors de la sauvegarde. Réessayer ?');
    } finally {
      setIsSaving(false);
    }
  }

  // Cancel: unmounts instantly, no animation, no confirmation dialog (D-09, D-13, PITFALLS #12)
  function handleCancel() {
    onCancel();
  }

  // Undo: restore previousConfig via same onSave path → triggers PUT + closes overlay
  function handleUndo() {
    onSave(previousConfigRef.current);
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Éditeur de dashboard"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar — 56px */}
      <div
        className="flex-shrink-0 flex items-center px-6 bg-white"
        style={{
          height: 56,
          borderBottom: '1px solid #E2E0DA',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17' }}>
          Dashboard &bull; Édition
        </span>

        <div className="flex-1" />

        {/* Button group */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            aria-label="Annuler et fermer l'éditeur"
            style={{
              height: 36,
              paddingLeft: 16,
              paddingRight: 16,
              border: '1px solid #E2E0DA',
              borderRadius: 8,
              background: 'transparent',
              fontSize: 13,
              fontWeight: 500,
              color: '#1C1A17',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#F0EFE9';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            Annuler
          </button>

          <button
            ref={saveAsTemplateBtnRef}
            onClick={() => {
              gsap.to(saveAsTemplateBtnRef.current, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1, ease: 'power3.out' });
              setIsTemplateModalOpen(true);
            }}
            disabled={isStreaming || isSaving}
            aria-label="Enregistrer ce dashboard comme modèle réutilisable"
            style={{
              height: 36,
              paddingLeft: 16,
              paddingRight: 16,
              border: '1px solid #E2E0DA',
              borderRadius: 8,
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: '#1C1A17',
              cursor: (isStreaming || isSaving) ? 'not-allowed' : 'pointer',
              opacity: (isStreaming || isSaving) ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isStreaming && !isSaving) (e.currentTarget as HTMLButtonElement).style.background = '#F0EFE9';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Enregistrer comme modèle
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            aria-label="Sauvegarder la configuration du dashboard"
            aria-busy={isSaving}
            style={{
              height: 36,
              paddingLeft: 16,
              paddingRight: 16,
              backgroundColor: '#FF5C1A',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              color: '#FFFFFF',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isSaving) (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              if (!isSaving) (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            }}
          >
            {isSaving ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#FFFFFF',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
            ) : (
              'Sauvegarder'
            )}
          </button>
        </div>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div
          className="flex-shrink-0 px-6 py-2 flex items-center justify-between"
          style={{ backgroundColor: '#FEF2F2', borderBottom: '1px solid rgba(239,68,68,0.20)' }}
        >
          <span style={{ fontSize: 13, color: '#1C1A17' }}>{saveError}</span>
          <button
            onClick={() => { setSaveError(null); handleSave(); }}
            style={{ fontSize: 13, color: '#FF5C1A', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Content row: 60% preview / 40% chat */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Preview pane — 60% */}
        <div
          style={{
            flex: '0 0 60%',
            backgroundColor: '#F7F6F3',
            padding: 24,
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <DashboardGrid
            widgets={pendingWidgets}
            clientId={clientId}
            isEditMode={false}
            onLayoutSaved={undefined}
          />
          {isStreaming && <PreviewLoadingOverlay />}
        </div>

        {/* Chat panel — 40% */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <EditChatPanel
            clientId={clientId}
            configRef={configRef}
            onWidgetsUpdate={onWidgetsUpdate}
            initialWidgets={initialWidgets}
            onStreamingChange={setIsStreaming}
            historyRef={conversationHistoryRef}
          />
        </div>
      </div>

      {/* Save toast */}
      {toastVisible && (
        <SaveToast
          onUndo={handleUndo}
          onDismiss={() => setToastVisible(false)}
        />
      )}

      {/* Template toast */}
      {templateToastVisible && (
        <SaveToast
          message="Modèle enregistré"
          onUndo={() => {}}
          onDismiss={() => setTemplateToastVisible(false)}
        />
      )}

      {/* TemplateNamingModal */}
      {isTemplateModalOpen && (
        <TemplateNamingModal
          currentWidgets={configRef.current}
          onClose={() => setIsTemplateModalOpen(false)}
          onSuccess={() => {
            setTemplateToastVisible(true);
          }}
        />
      )}

      {/* Inline CSS for button spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
