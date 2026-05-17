'use client';
import { useState, useEffect, useRef } from 'react';

// Case-sensitive exact match token required to enable destructive action.
// Same token used by coach (D-13) and athlete (D-18) sides.
const CONFIRM_TOKEN = 'COACH';

export function RevokeConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  confirmCta,
  cancelLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string; // 'Tapez "COACH" pour confirmer'
  confirmCta: string; // "Révoquer" or "Retirer"
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setInput('');
      setSubmitting(false);
      return;
    }
    firstFieldRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'input, button:not([disabled])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  // case-sensitive exact match
  const enabled = input === CONFIRM_TOKEN && !submitting;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div ref={dialogRef} className="bg-white rounded-2xl p-8 max-w-md w-full border border-border shadow-lg">
        <h2 id="revoke-modal-title" className="text-xl font-bold text-text">
          {title}
        </h2>
        <p className="text-sm font-normal text-muted mt-2">{body}</p>
        <label
          className="block text-sm font-semibold text-text mt-6"
          htmlFor="revoke-confirm-input"
        >
          {confirmLabel}
        </label>
        <input
          id="revoke-confirm-input"
          ref={firstFieldRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={CONFIRM_TOKEN}
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border bg-white text-text rounded-xl px-6 py-3 text-sm font-normal hover:bg-background transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            aria-disabled={!enabled}
            disabled={!enabled}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm();
              } finally {
                setSubmitting(false);
              }
            }}
            className="bg-red-600 text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {confirmCta}
          </button>
        </div>
      </div>
    </div>
  );
}
