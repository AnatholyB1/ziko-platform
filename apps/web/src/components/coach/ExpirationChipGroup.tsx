'use client';
import { useTranslations } from 'next-intl';

export type ExpirationOption = '7d' | '14d' | '30d' | 'never';
const OPTIONS: ExpirationOption[] = ['7d', '14d', '30d', 'never'];

export function ExpirationChipGroup({
  value,
  onChange,
}: {
  value: ExpirationOption;
  onChange: (v: ExpirationOption) => void;
}) {
  const t = useTranslations('CoachInvitations.expiration');
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Expiration">
      {OPTIONS.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt)}
            className={
              selected
                ? 'border border-primary bg-primary/10 text-primary text-sm font-semibold rounded-full px-4 py-1.5'
                : 'border border-border bg-white text-text text-sm font-normal rounded-full px-4 py-1.5 cursor-pointer hover:bg-background'
            }
          >
            {t(opt)}
          </button>
        );
      })}
    </div>
  );
}

export function expirationToISO(opt: ExpirationOption): string | null {
  if (opt === 'never') return null;
  const days = opt === '7d' ? 7 : opt === '14d' ? 14 : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
