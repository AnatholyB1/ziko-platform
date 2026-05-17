'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ExpirationChipGroup,
  expirationToISO,
  type ExpirationOption,
} from './ExpirationChipGroup';

export function GeneratePanel({
  open,
  pending,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onSubmit: (expiresAt: string | null) => Promise<void> | void;
}) {
  const t = useTranslations('CoachInvitations');
  // 14j default per CONTEXT.md
  const [opt, setOpt] = useState<ExpirationOption>('14d');
  if (!open) return null;
  return (
    <div className="bg-white rounded-2xl border border-border p-6 mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
      <ExpirationChipGroup value={opt} onChange={setOpt} />
      <button
        type="button"
        disabled={pending}
        onClick={() => onSubmit(expirationToISO(opt))}
        className="bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {t('panelSubmit')}
      </button>
    </div>
  );
}
