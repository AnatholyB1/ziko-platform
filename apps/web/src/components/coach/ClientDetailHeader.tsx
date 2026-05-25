'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RevokeConfirmModal } from './RevokeConfirmModal';

function RevokeClientButton({
  clientId,
  clientName,
  locale,
}: {
  clientId: string;
  clientName: string | null;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleRevoke = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    const res = await fetch(`${apiUrl}/coach/clients/links/${clientId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setOpen(false);
      router.push(`/${locale}/coach/clients`);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors"
        aria-label={`Retirer ${clientName ?? clientId}`}
      >
        Retirer
      </button>
      <RevokeConfirmModal
        open={open}
        title="Retirer ce client ?"
        body={`${clientName ?? 'Ce client'} perdra l'accès à vos programmes assignés. Vous perdrez l'accès à leurs données.`}
        confirmLabel="Tapez COACH pour confirmer"
        confirmCta="Retirer"
        cancelLabel="Garder ce client"
        onConfirm={handleRevoke}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function ClientDetailHeader({
  id,
  name,
  avatarUrl,
  locale,
}: {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  locale: string;
}) {
  return (
    <div className="flex items-center justify-between py-6 border-b border-border">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-muted">
              {(name ?? '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        {/* Name */}
        <div>
          <h1 className="text-2xl font-bold text-text">{name ?? 'Client sans nom'}</h1>
        </div>
        {/* Vue lecture seule badge */}
        <span className="inline-flex items-center text-sm font-bold px-3 py-1 rounded-full border bg-primary/10 text-primary border-primary/20">
          Vue lecture seule
        </span>
      </div>
      {/* Retirer client button — triggers client-side modal */}
      <RevokeClientButton clientId={id} clientName={name} locale={locale} />
    </div>
  );
}
