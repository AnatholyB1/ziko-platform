'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { IoShieldCheckmarkOutline, IoTimeOutline } from 'react-icons/io5';
import type { CoachPreviewPayload } from '@ziko/coach-sdk';

const BIO_TRUNCATE = 200;

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd() + '…';
}

export function CoachPreviewCard({ preview }: { preview: CoachPreviewPayload }) {
  const t = useTranslations('CoachRedeem');
  const [expanded, setExpanded] = useState(false);
  const bio = preview.bio ?? '';
  const needsTruncate = bio.length > BIO_TRUNCATE;
  const displayedBio = expanded || !needsTruncate ? bio : truncateAtWord(bio, BIO_TRUNCATE);

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm text-left">
      <div className="flex items-start gap-4">
        {preview.photo_signed_url ? (
          <img
            src={preview.photo_signed_url}
            alt={`${preview.display_name}, coach Ziko`}
            className="w-[72px] h-[72px] rounded-full object-cover border border-border"
          />
        ) : (
          <div className="w-[72px] h-[72px] rounded-full bg-background border border-border" aria-hidden />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-text">{preview.display_name}</h2>
          {preview.kyc_status === 'verified' && (
            <span className="inline-flex items-center gap-1 mt-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-bold">
              <IoShieldCheckmarkOutline aria-hidden /> {t('kyc.verified')}
            </span>
          )}
          {(preview.kyc_status === 'pending' || preview.kyc_status === 'submitted') && (
            <span className="inline-flex items-center gap-1 mt-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-3 py-1 text-xs font-bold">
              <IoTimeOutline aria-hidden /> {t('kyc.pending')}
            </span>
          )}
        </div>
      </div>

      {preview.specialties && preview.specialties.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {preview.specialties.map((s) => (
            <span key={s} className="border border-border bg-background text-text text-xs font-normal rounded-full px-3 py-1">
              {s}
            </span>
          ))}
        </div>
      )}

      {bio && (
        <p className="text-sm font-normal text-muted mt-4 whitespace-pre-line">
          {displayedBio}
          {needsTruncate && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-primary text-sm font-normal underline"
              >
                {expanded ? t('bioLess') : t('bioMore')}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
