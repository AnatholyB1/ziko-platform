'use client';

import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { IoSearchOutline, IoCloseOutline, IoRefreshOutline } from 'react-icons/io5';

// ─── Props ──────────────────────────────────────────────────────────────────────

interface PublishModalProps {
  open: boolean;
  formId: string;
  accessToken: string;
  apiUrl: string;
  locale: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── PublishModal ───────────────────────────────────────────────────────────────

export function PublishModal({
  open,
  formId,
  accessToken,
  apiUrl,
  locale: _locale,
  onClose,
  onSuccess,
}: PublishModalProps) {
  const [target, setTarget] = useState<'one' | 'all'>('all');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ─── GSAP open animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (open && dialogRef.current) {
      gsap.from(dialogRef.current, { scale: 0.95, opacity: 0, duration: 0.25, ease: 'power2.inOut' });
    }
  }, [open]);

  // ─── Escape key ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── Client typeahead (debounced 300ms) ─────────────────────────────────────

  useEffect(() => {
    if (target !== 'one' || search.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/coach/clients?search=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const json = await res.json();
          const clients = (json.clients ?? json ?? []) as { id: string; name: string | null }[];
          const results = clients
            .map((c) => ({ id: c.id, name: c.name ?? 'Client' }))
            .slice(0, 8);
          setSearchResults(results);
          // GSAP stagger on results
          setTimeout(() => {
            gsap.from('.result-row', { y: 4, opacity: 0, duration: 0.12, stagger: 0.03 });
          }, 10);
        }
      } catch {
        // silently ignore search errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, target, apiUrl, accessToken]);

  // ─── handleClose (with exit animation) ─────────────────────────────────────

  function handleClose() {
    const dialog = dialogRef.current;
    if (dialog) {
      gsap.to(dialog, { scale: 0.97, opacity: 0, duration: 0.15, ease: 'power2.in', onComplete: onClose });
    } else {
      onClose();
    }
  }

  // ─── handleConfirm ───────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (target === 'one' && !selectedClient) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { target };
      if (target === 'one' && selectedClient) body.client_id = selectedClient.id;
      const res = await fetch(`${apiUrl}/forms/coach/forms/${formId}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSuccess();
        handleClose();
      } else {
        setError('Une erreur est survenue. Réessayez.');
      }
    } catch {
      setError('Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null;

  const canConfirm = target === 'all' || (target === 'one' && !!selectedClient);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-dialog bg-white rounded-2xl p-8 border border-border shadow-lg w-[480px] max-w-[90vw]"
      >
        {/* Title */}
        <h2 className="text-xl font-bold text-text mb-2">Publier le formulaire</h2>
        <p className="text-sm text-muted mb-6">Choisissez à qui envoyer ce formulaire.</p>

        {/* Radio group */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Option A — Un client spécifique */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="publish-target"
                value="one"
                checked={target === 'one'}
                onChange={() => {
                  setTarget('one');
                  setSearch('');
                  setSelectedClient(null);
                  setSearchResults([]);
                }}
                className="accent-primary"
              />
              <span className="text-sm font-bold text-text">Un client spécifique</span>
            </label>

            {target === 'one' && (
              <div className="mt-2 ml-6">
                {!selectedClient ? (
                  <div className="relative">
                    <IoSearchOutline
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      size={16}
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setSelectedClient(null);
                      }}
                      placeholder="Rechercher un client…"
                      className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none pl-10"
                    />
                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                      <div className="bg-white border border-border rounded-xl shadow-md mt-1 max-h-40 overflow-y-auto">
                        {searchResults.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className="result-row px-4 py-2.5 text-sm hover:bg-[#F7F6F3] cursor-pointer flex items-center gap-2 w-full text-left"
                            onClick={() => {
                              setSelectedClient(r);
                              setSearch(r.name);
                              setSearchResults([]);
                            }}
                          >
                            <span className="w-6 h-6 rounded-full bg-[#F0EFE9] text-xs font-bold text-muted flex items-center justify-center shrink-0">
                              {r.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="text-sm text-text">{r.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected client chip */
                  <div className="mt-2 inline-flex items-center gap-1 bg-[#F0EFE9] text-text rounded-full px-3 py-1 text-sm font-bold">
                    <span>{selectedClient.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClient(null);
                        setSearch('');
                      }}
                      className="ml-1"
                      aria-label="Retirer le client sélectionné"
                    >
                      <IoCloseOutline size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Option B — Tous mes clients */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="publish-target"
                value="all"
                checked={target === 'all'}
                onChange={() => {
                  setTarget('all');
                  setSearch('');
                  setSelectedClient(null);
                  setSearchResults([]);
                }}
                className="accent-primary"
              />
              <span className="text-sm font-bold text-text">Tous mes clients</span>
            </label>
            <p className="text-xs text-muted ml-6 mt-1">
              Envoie le formulaire à tous vos clients actuellement liés.
            </p>
          </div>
        </div>

        {/* Inline error */}
        {error && <p className="text-xs text-destructive mb-3">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="border border-border bg-white text-text rounded-xl px-6 py-3 text-sm font-bold hover:bg-background"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className={`bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold flex items-center gap-2 ${(!canConfirm || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? <IoRefreshOutline className="animate-spin" size={16} /> : null}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

export default PublishModal;
