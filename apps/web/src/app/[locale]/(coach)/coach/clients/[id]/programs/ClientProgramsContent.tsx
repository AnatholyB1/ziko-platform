'use client';
import { useState } from 'react';

interface ActiveProgram {
  id: string;
  name: string;
  goal: string | null;
  week_count: number;
  current_week: number;
  start_date: string | null;
  compliance_pct: number | null;
  coach_display_name: string | null;
}

interface HistoryProgram {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  compliance_archive: number | null;
}

interface ClientProgramsData {
  active: ActiveProgram | null;
  history: HistoryProgram[];
}

interface ClientDetail {
  id: string;
  name: string | null;
  shared_note: string | null;
}

interface ClientProgramsContentProps {
  clientId: string;
  programsData: ClientProgramsData;
  clientDetail: ClientDetail;
  accessToken: string;
  apiUrl: string;
  locale: string;
}

function complianceColor(pct: number): string {
  if (pct >= 80) return 'bg-green-600';
  if (pct >= 50) return 'bg-primary';
  return 'bg-red-600';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Shared note sub-component (needs interactivity)
function SharedNoteEditor({
  clientId,
  initialNote,
  accessToken,
  apiUrl,
}: {
  clientId: string;
  initialNote: string | null;
  accessToken: string;
  apiUrl: string;
}) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${apiUrl}/coach/clients/${clientId}/shared-note`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ shared_note: note }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[SharedNoteEditor] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Message partagé</h3>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        maxLength={500}
        rows={4}
        placeholder="Écrivez un message visible par l'athlète dans son application…"
        className="w-full text-sm font-normal text-text border border-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted">{note.length}/500</span>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}

// Remove program inline confirm sub-component
function RemoveProgramConfirm({
  programId,
  accessToken,
  apiUrl,
  onRemoved,
}: {
  programId: string;
  accessToken: string;
  apiUrl: string;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="text-sm text-red-600 hover:underline"
        onClick={() => setConfirming(true)}
      >
        Retirer ce programme
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">Retirer ce programme ?</span>
      <button
        type="button"
        className="text-text hover:underline font-normal"
        onClick={() => setConfirming(false)}
      >
        Garder
      </button>
      <button
        type="button"
        disabled={removing}
        className="text-red-600 font-bold hover:underline disabled:opacity-40"
        onClick={async () => {
          setRemoving(true);
          try {
            await fetch(`${apiUrl}/coach/programs/${programId}?confirmed=true`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            onRemoved();
          } catch {
            setRemoving(false);
            setConfirming(false);
          }
        }}
      >
        {removing ? '…' : 'Retirer'}
      </button>
    </div>
  );
}

export function ClientProgramsContent({
  clientId,
  programsData,
  clientDetail,
  accessToken,
  apiUrl,
  locale,
}: ClientProgramsContentProps) {
  const [active, setActive] = useState(programsData.active);
  const { history } = programsData;

  if (!active) {
    // No-program empty state
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center py-16 bg-white border border-border rounded-2xl shadow-sm">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" className="text-muted mb-4">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <h2 className="text-base font-bold text-text">Aucun programme actif</h2>
          <p className="text-sm text-muted mt-2 max-w-sm">
            Assignez un programme à cet athlète pour qu&apos;il puisse suivre ses séances prescrites.
          </p>
          <a
            href={`/${locale}/coach/programs`}
            className="mt-6 bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Assigner un programme
          </a>
        </div>

        <SharedNoteEditor
          clientId={clientId}
          initialNote={clientDetail.shared_note}
          accessToken={accessToken}
          apiUrl={apiUrl}
        />
      </div>
    );
  }

  const compliance = active.compliance_pct ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Active program card */}
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-muted uppercase tracking-wide">
            Programme actif
          </span>
          <a
            href={`/${locale}/coach/programs`}
            className="text-sm text-primary hover:underline"
          >
            Changer de programme
          </a>
        </div>

        <h2 className="text-base font-bold text-text">{active.name}</h2>

        <p className="text-sm text-muted mt-1">
          Semaine {active.current_week} sur {active.week_count}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted mt-1">
          {active.coach_display_name && (
            <span>Créé par {active.coach_display_name}</span>
          )}
          {active.start_date && (
            <>
              <span>·</span>
              <span>Assigné le {formatDate(active.start_date)}</span>
            </>
          )}
        </div>

        {/* Compliance bar */}
        <div className="mt-4">
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${complianceColor(compliance)}`}
              style={{ width: `${Math.min(100, Math.max(0, compliance))}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-1">{compliance}% de conformité cette semaine</p>
        </div>

        <div className="mt-4">
          <RemoveProgramConfirm
            programId={active.id}
            accessToken={accessToken}
            apiUrl={apiUrl}
            onRemoved={() => setActive(null)}
          />
        </div>
      </div>

      {/* History section */}
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wide mb-4">Historique</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted italic">Aucun historique</p>
        ) : (
          <div className="divide-y divide-border">
            {history.map((h) => (
              <div key={h.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-normal text-text">{h.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatDate(h.start_date)} → {formatDate(h.end_date)}
                  </p>
                </div>
                {h.compliance_archive !== null && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full text-white ${complianceColor(h.compliance_archive)}`}
                  >
                    {h.compliance_archive}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared note */}
      <SharedNoteEditor
        clientId={clientId}
        initialNote={clientDetail.shared_note}
        accessToken={accessToken}
        apiUrl={apiUrl}
      />
    </div>
  );
}
