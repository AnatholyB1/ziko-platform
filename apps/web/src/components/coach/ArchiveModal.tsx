'use client';

import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { IoWarningOutline } from 'react-icons/io5';

// ─── Props ──────────────────────────────────────────────────────────────────────

interface ArchiveModalProps {
  open: boolean;
  formId: string;
  accessToken: string;
  apiUrl: string;
  locale: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── ArchiveModal ───────────────────────────────────────────────────────────────

export function ArchiveModal({
  open,
  formId,
  accessToken,
  apiUrl,
  locale: _locale,
  onClose,
  onSuccess,
}: ArchiveModalProps) {
  const [loading, setLoading] = useState(false);
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

  // ─── handleClose (with exit animation) ─────────────────────────────────────

  function handleClose() {
    const dialog = dialogRef.current;
    if (dialog) {
      gsap.to(dialog, { scale: 0.97, opacity: 0, duration: 0.15, ease: 'power2.in', onComplete: onClose });
    } else {
      onClose();
    }
  }

  // ─── handleArchive ───────────────────────────────────────────────────────────

  async function handleArchive() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/forms/coach/forms/${formId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'archived' }),
      });
      if (res.ok) {
        onSuccess();
        handleClose();
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null;

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
        className="modal-dialog bg-white rounded-2xl p-8 border border-border shadow-lg w-[400px] max-w-[90vw] flex flex-col items-center"
      >
        {/* Warning icon */}
        <IoWarningOutline size={32} className="text-[#F59E0B] mb-4" />

        {/* Title */}
        <h2 className="text-xl font-bold text-text mb-2 text-center">
          Archiver ce formulaire ?
        </h2>

        {/* Body */}
        <p className="text-sm text-muted text-center mb-6">
          Les instances en attente ne seront pas envoyées. Cette action est irréversible.
        </p>

        {/* Footer */}
        <div className="flex justify-end gap-3 w-full">
          <button
            type="button"
            onClick={handleClose}
            className="border border-border bg-white text-text rounded-xl px-6 py-3 text-sm font-bold hover:bg-background"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={loading}
            className="bg-destructive text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-50"
          >
            Archiver
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArchiveModal;
