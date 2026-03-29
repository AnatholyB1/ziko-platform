import { differenceInDays, isToday, isPast, parseISO, startOfDay } from 'date-fns';

export type ExpiryStatus = 'expired' | 'today' | 'soon' | 'ok' | 'none';

export function getExpiryStatus(expirationDate: string | null): ExpiryStatus {
  if (!expirationDate) return 'none';
  const date = parseISO(expirationDate);
  if (isPast(startOfDay(date)) && !isToday(date)) return 'expired';
  if (isToday(date)) return 'today';
  const daysUntil = differenceInDays(date, startOfDay(new Date()));
  if (daysUntil <= 7) return 'soon';
  return 'ok';
}

export const EXPIRY_COLORS: Record<ExpiryStatus, { dot: string; bg: string }> = {
  expired: { dot: '#F44336', bg: '#F4433608' },
  today:   { dot: '#F44336', bg: '#F4433608' },
  soon:    { dot: '#FF9800', bg: '#FF980008' },
  ok:      { dot: '#4CAF50', bg: 'transparent' },
  none:    { dot: 'transparent', bg: 'transparent' },
};

export function getExpiryLabel(
  expirationDate: string | null,
  t: (key: string, opts?: any) => string,
): string | null {
  if (!expirationDate) return null;
  const status = getExpiryStatus(expirationDate);
  if (status === 'expired') return t('pantry.expiry_expired');
  if (status === 'today') return t('pantry.expiry_today');
  if (status === 'soon') {
    const days = differenceInDays(parseISO(expirationDate), startOfDay(new Date()));
    return t('pantry.expiry_soon', { days });
  }
  return null;
}
