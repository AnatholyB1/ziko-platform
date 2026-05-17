'use client';
import { useTranslations } from 'next-intl';

const CHARSET_RE = /[^A-Z2-9]/g;

export function CodeInput({
  value,
  onChange,
  disabled,
  ariaErrorId,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaErrorId?: string;
}) {
  const t = useTranslations('CoachRedeem.stateA');
  return (
    <input
      type="text"
      inputMode="text"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      maxLength={6}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(CHARSET_RE, ''))}
      placeholder={t('inputPlaceholder')}
      aria-label={t('inputLabel')}
      aria-describedby={ariaErrorId}
      className="w-full max-w-xs h-14 rounded-xl border border-border bg-white text-center text-2xl font-bold font-mono tabular-nums tracking-widest uppercase text-text focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted disabled:opacity-50"
    />
  );
}
