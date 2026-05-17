'use client';
import { useState, useTransition } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import type { CoachInvitationWithStatus } from '@ziko/coach-sdk';
import { GeneratePanel } from '@/components/coach/GeneratePanel';
import { InvitationCodeCard } from '@/components/coach/InvitationCodeCard';
import { InvitationsTable } from '@/components/coach/InvitationsTable';
import {
  generateInvitationAction,
  revokeInvitationAction,
  fetchInvitationsAction,
} from './actions';

type FreshCode = { code: string; expires_at: string | null };

export function InvitationsClient({
  title,
  generateCta,
  initialRows,
}: {
  title: string;
  generateCta: string;
  initialRows: CoachInvitationWithStatus[];
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [freshCode, setFreshCode] = useState<FreshCode | null>(null);
  const [rows, setRows] = useState<CoachInvitationWithStatus[]>(initialRows);
  const [pending, startTransition] = useTransition();

  function handleGenerate(expiresAt: string | null) {
    startTransition(async () => {
      const res = await generateInvitationAction(expiresAt);
      if (res.ok) {
        setFreshCode({ code: res.data.code, expires_at: res.data.expires_at });
        setPanelOpen(false);
        const fresh = await fetchInvitationsAction('all');
        setRows(fresh);
      }
    });
  }

  async function handleRevoke(id: string) {
    const res = await revokeInvitationAction(id);
    if (res.ok) {
      const fresh = await fetchInvitationsAction('all');
      setRows(fresh);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <IoAddOutline aria-hidden /> {generateCta}
        </button>
      </div>

      <GeneratePanel open={panelOpen} pending={pending} onSubmit={handleGenerate} />

      {freshCode && (
        <div className="mt-6">
          <InvitationCodeCard code={freshCode.code} expiresAt={freshCode.expires_at} />
        </div>
      )}

      <InvitationsTable rows={rows} onRevoke={handleRevoke} />
    </>
  );
}
