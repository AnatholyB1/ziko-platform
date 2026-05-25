'use client';
import { useState, useEffect, useRef } from 'react';

export interface AssignmentClient {
  id: string;
  name: string | null;
  avatar_url?: string | null;
  already_assigned?: boolean;
}

export interface AssignmentModalProps {
  open: boolean;
  programId: string;
  programName: string;
  clients: AssignmentClient[];
  onClose: () => void;
  onSuccess: (count: number) => void;
  apiUrl?: string;
  accessToken?: string;
}

// Copied from ClientsTable.tsx (not exported there)
function IndeterminateCheckbox({
  indeterminate,
  className = '',
  ...rest
}: { indeterminate: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null!);
  useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      ref.current.indeterminate = !rest.checked && indeterminate;
    }
  }, [ref, indeterminate, rest.checked]);
  return (
    <input
      type="checkbox"
      ref={ref}
      {...rest}
      className={`h-4 w-4 rounded border-border text-primary focus:ring-primary ${className}`}
    />
  );
}

type ModalState = 'selecting' | 'loading' | 'success';

export function AssignmentModal({
  open,
  programId,
  programName,
  clients,
  onClose,
  onSuccess,
  apiUrl = '',
  accessToken = '',
}: AssignmentModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalState, setModalState] = useState<ModalState>('selecting');
  const [assignedCount, setAssignedCount] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setModalState('selecting');
      setAssignedCount(0);
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const allSelected = clients.length > 0 && selectedIds.size === clients.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < clients.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)));
    }
  };

  const toggleClient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setModalState('loading');
    try {
      const resolvedApiUrl = apiUrl || process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${resolvedApiUrl}/coach/programs/${programId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ client_ids: [...selectedIds] }),
      });
      if (res.ok) {
        setAssignedCount(selectedIds.size);
        setModalState('success');
      } else {
        setModalState('selecting');
      }
    } catch {
      setModalState('selecting');
    }
  };

  const handleSuccessClose = () => {
    onSuccess(assignedCount);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl p-8 max-w-lg w-full border border-border shadow-lg"
      >
        {modalState === 'success' ? (
          /* Success state */
          <div className="flex flex-col items-center text-center py-4">
            <svg
              width="48"
              height="48"
              fill="none"
              viewBox="0 0 24 24"
              className="text-success mb-4"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 12l2.5 2.5L16 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className="text-xl font-bold text-text">Programme assigné !</h2>
            <p className="text-sm text-muted mt-2">
              {assignedCount === 1
                ? '1 client a reçu ce programme.'
                : `${assignedCount} clients ont reçu ce programme.`}
            </p>
            <button
              type="button"
              onClick={handleSuccessClose}
              className="mt-6 bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <h2 id="assign-modal-title" className="text-xl font-bold text-text">
              Assigner &laquo; {programName} &raquo;
            </h2>
            <p className="text-sm text-muted mt-1">
              Sélectionnez les clients qui recevront ce programme.
            </p>

            {clients.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <svg
                  width="36"
                  height="36"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="text-muted mb-2"
                >
                  <path
                    d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm text-muted text-center">Aucun client lié</p>
              </div>
            ) : (
              <>
                {/* Select-all row */}
                <div className="mt-4 flex items-center gap-4 px-4 py-2">
                  <IndeterminateCheckbox
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={toggleAll}
                    id="select-all-clients"
                  />
                  <label
                    htmlFor="select-all-clients"
                    className="text-sm font-bold text-text cursor-pointer"
                  >
                    Tous les clients
                  </label>
                </div>

                {/* Client list */}
                <div className="mt-2 max-h-72 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {clients.map((client) => {
                    const isSelected = selectedIds.has(client.id);
                    return (
                      <div
                        key={client.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-background cursor-pointer"
                        onClick={() => toggleClient(client.id)}
                      >
                        <IndeterminateCheckbox
                          indeterminate={false}
                          checked={isSelected}
                          onChange={() => toggleClient(client.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {/* Avatar */}
                        {client.avatar_url ? (
                          <img
                            src={client.avatar_url}
                            alt={client.name ?? 'Client'}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" className="text-muted">
                              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                              <path
                                d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        )}
                        <span className="text-sm text-text flex-1">{client.name ?? 'Client sans nom'}</span>
                        {client.already_assigned && (
                          <span className="text-xs text-muted bg-background border border-border rounded-full px-2 py-0.5 shrink-0">
                            Déjà assigné
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Action row */}
            <div className="flex justify-end gap-3 mt-6 border-t border-border pt-6">
              <button
                type="button"
                onClick={onClose}
                className="border border-border bg-white text-text rounded-xl px-6 py-3 text-sm font-normal hover:bg-background transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0 || modalState === 'loading'}
                onClick={handleAssign}
                className="bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                {modalState === 'loading' && (
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="animate-spin shrink-0"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeDasharray="14 28"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {selectedIds.size > 0 ? `Assigner (${selectedIds.size})` : 'Assigner'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
