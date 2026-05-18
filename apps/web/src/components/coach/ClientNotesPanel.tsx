'use client';
import { useState } from 'react';
import { ClientTagInput } from './ClientTagInput';

type ClientTag = { id: string; tag: string; };

export function ClientNotesPanel({
  clientId,
  initialNote,
  initialTags,
  apiUrl,
}: {
  clientId: string;
  initialNote: string;
  initialTags: ClientTag[];
  apiUrl: string;
}) {
  const [content, setContent] = useState(initialNote);
  const [savedContent, setSavedContent] = useState(initialNote);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = content !== savedContent;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/coach/clients/${clientId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSavedAt(new Date());
      } else {
        setError("Impossible d'enregistrer.");
      }
    } catch {
      setError('Erreur réseau.');
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-6 space-y-6">
      {/* Tags section */}
      <div>
        <h3 className="text-sm font-bold text-text mb-3">Tags (privés)</h3>
        <ClientTagInput clientId={clientId} initialTags={initialTags} apiUrl={apiUrl} />
      </div>

      {/* Notes section */}
      <div>
        <h3 className="text-sm font-bold text-text mb-3">Notes privées</h3>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Notes de coaching privées…"
          className="w-full min-h-[120px] border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
        {isDirty && (
          <button
            onClick={save}
            disabled={saving}
            className="mt-2 w-full bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer les notes'}
          </button>
        )}
        {!isDirty && savedAt && (
          <p className="text-xs text-muted mt-2">
            Enregistré le {savedAt.toLocaleDateString('fr-FR')} à {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  );
}
