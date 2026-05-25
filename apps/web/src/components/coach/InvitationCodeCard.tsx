'use client';
import { useState } from 'react';
import { IoClipboardOutline } from 'react-icons/io5';
import { useTranslations } from 'next-intl';

export function InvitationCodeCard({
  code,
  expiresAt,
}: {
  code: string;
  expiresAt: string | null;
}) {
  const t = useTranslations('CoachInvitations');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const shareUrl = `https://ziko-app.com/r/${code}`;

  function copy(text: string, which: 'code' | 'link') {
    navigator.clipboard.writeText(text);
    if (which === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    }
  }

  const expiryLine = expiresAt
    ? t('expiresOn', {
        date: new Date(expiresAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      })
    : t('noExpiry');

  return (
    <div className="bg-white rounded-2xl px-10 py-8 border border-border shadow-sm">
      <div className="text-xs font-semibold text-muted uppercase tracking-wide">
        {t('cardLabel')}
      </div>
      <div className="text-4xl font-bold font-mono tabular-nums text-text tracking-widest mt-2">
        {code}
      </div>
      <button
        type="button"
        onClick={() => copy(code, 'code')}
        aria-label="Copier le code d'invitation"
        className="mt-4 inline-flex items-center gap-2 border border-border bg-white text-text rounded-xl px-4 py-2 text-sm font-normal hover:bg-background transition-colors"
      >
        <IoClipboardOutline aria-hidden /> {copiedCode ? '✓' : t('copyCode')}
      </button>
      <div className="border-t border-border my-4"></div>
      <div className="text-sm font-normal text-muted font-mono truncate">{shareUrl}</div>
      <button
        type="button"
        onClick={() => copy(shareUrl, 'link')}
        aria-label="Copier le lien de partage"
        className="mt-3 inline-flex items-center gap-2 border border-border bg-white text-text rounded-xl px-4 py-2 text-sm font-normal hover:bg-background transition-colors"
      >
        <IoClipboardOutline aria-hidden /> {copiedLink ? '✓' : t('copyLink')}
      </button>
      <div className="text-sm font-normal text-muted mt-4">{expiryLine}</div>
    </div>
  );
}
