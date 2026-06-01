'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Plus, Loader2 } from 'lucide-react';

interface CoachMetricThreshold {
  id: string;
  coach_id: string;
  client_id: string;
  sport_type: string;
  metric_key: string;
  operator: '>' | '<';
  threshold_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface NewThresholdForm {
  sport_type: string;
  metric_key: string;
  operator: '>' | '<';
  threshold_value: number;
  is_active: boolean;
}

interface AlertesModalProps {
  clientId: string;
  sport: string | null;
  onClose: () => void;
  crossedThresholds?: Array<{ metric_key: string; current_value: number }>;
}

export function AlertesModal({ clientId, sport, onClose, crossedThresholds }: AlertesModalProps) {
  const [thresholds, setThresholds] = useState<CoachMetricThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newForms, setNewForms] = useState<NewThresholdForm[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (sport === null) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetch(`/api/coach/dashboards/${clientId}/thresholds?sport=${encodeURIComponent(sport)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setThresholds(data.thresholds ?? []);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Impossible de charger les seuils.');
        setIsLoading(false);
      });
  }, [clientId, sport]);

  async function deleteThreshold(id: string) {
    try {
      const res = await fetch(`/api/coach/dashboards/${clientId}/thresholds/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setThresholds((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // silent fail — threshold remains in list
    }
  }

  function addNewForm() {
    setNewForms((prev) => [
      ...prev,
      {
        sport_type: sport ?? '',
        metric_key: '',
        operator: '>',
        threshold_value: 0,
        is_active: true,
      },
    ]);
  }

  async function saveNewForms() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const formsToSave = newForms.filter((f) => f.metric_key.trim() !== '');
      const saved: CoachMetricThreshold[] = [];
      for (const form of formsToSave) {
        const res = await fetch(`/api/coach/dashboards/${clientId}/thresholds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.threshold) saved.push(data.threshold);
      }
      setThresholds((prev) => [...prev, ...saved]);
      setNewForms([]);
    } catch {
      setSaveError("Erreur lors de l'enregistrement. Réessayez.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configuration des alertes"
        style={{
          position: 'relative',
          zIndex: 1,
          backgroundColor: '#fff',
          borderRadius: 16,
          width: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          border: '1px solid #E2E0DA',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center px-5"
          style={{ height: 56, borderBottom: '1px solid #E2E0DA' }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1A17' }}>
            Alertes seuils
          </span>
          <div className="flex-1" />
          <button
            aria-label="Fermer"
            onClick={onClose}
            style={{ padding: 4, color: '#6B6963' }}
            className="hover:text-[#1C1A17] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {isLoading && (
            <div
              className="animate-pulse bg-[#E2E0DA] rounded"
              style={{ height: 32 }}
            />
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          {!isLoading && !error && (
            <>
              {thresholds.length === 0 && newForms.length === 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17', marginBottom: 4 }}>
                    Aucun seuil configuré
                  </p>
                  <p style={{ fontSize: 14, color: '#6B6963' }}>
                    Définissez des seuils numériques pour être alerté quand un indicateur dépasse une limite.
                  </p>
                </div>
              )}

              {/* Existing thresholds */}
              {thresholds.map((threshold) => {
                const crossed = crossedThresholds?.find(
                  (ct) => ct.metric_key === threshold.metric_key
                );
                return (
                  <div key={threshold.id}>
                    <div
                      className="flex items-center gap-3 py-2"
                      style={{ borderBottom: '1px solid #E2E0DA' }}
                    >
                      {crossed && (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#FF5C1A',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        className="flex-1"
                        style={{ fontSize: 14, color: '#1C1A17' }}
                      >
                        {threshold.metric_key}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          backgroundColor: '#F7F6F3',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {threshold.operator}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: '#1C1A17',
                          width: 64,
                          textAlign: 'center',
                        }}
                      >
                        {threshold.threshold_value}
                      </span>
                      <button
                        aria-label="Supprimer ce seuil"
                        onClick={() => deleteThreshold(threshold.id)}
                        style={{ padding: 4 }}
                        className="text-[#6B6963] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {crossed && (
                      <p style={{ fontSize: 12, color: '#6B6963', paddingBottom: 4 }}>
                        Valeur actuelle : {crossed.current_value}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* New threshold forms */}
              {newForms.map((form, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 py-2"
                  style={{ borderBottom: '1px solid #E2E0DA' }}
                >
                  <input
                    type="text"
                    placeholder="Clé de métrique (ex: rpe_avg)"
                    value={form.metric_key}
                    onChange={(e) => {
                      setNewForms((prev) => {
                        const updated = [...prev];
                        updated[index] = { ...updated[index], metric_key: e.target.value };
                        return updated;
                      });
                    }}
                    className="flex-1 h-9 border border-[#E2E0DA] rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5C1A]/20 focus:border-[#FF5C1A]"
                  />
                  <select
                    value={form.operator}
                    onChange={(e) => {
                      setNewForms((prev) => {
                        const updated = [...prev];
                        updated[index] = {
                          ...updated[index],
                          operator: e.target.value as '>' | '<',
                        };
                        return updated;
                      });
                    }}
                    className="h-9 border border-[#E2E0DA] rounded-lg px-2 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-[#FF5C1A]/20"
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    value={form.threshold_value}
                    onChange={(e) => {
                      setNewForms((prev) => {
                        const updated = [...prev];
                        updated[index] = {
                          ...updated[index],
                          threshold_value: parseFloat(e.target.value) || 0,
                        };
                        return updated;
                      });
                    }}
                    className="h-9 border border-[#E2E0DA] rounded-lg px-3 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-[#FF5C1A]/20"
                  />
                </div>
              ))}

              <button
                onClick={addNewForm}
                className="text-[#FF5C1A] text-sm font-bold mt-3 flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                + Ajouter un seuil
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #E2E0DA' }}>
          {saveError && (
            <p className="text-red-500 text-sm" style={{ marginBottom: 8 }}>
              {saveError}
            </p>
          )}
          <button
            onClick={saveNewForms}
            disabled={isSaving}
            style={{
              width: '100%',
              height: 44,
              backgroundColor: '#FF5C1A',
              color: '#fff',
              fontWeight: 700,
              borderRadius: 12,
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.8 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Enregistrer les seuils'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
