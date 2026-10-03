// D-12 in-app channel: window during which the re-login notice is shown.
// Pure module (no env access) - the banner reads the env var.

export const NOTICE_LEAD_DAYS = 21;
export const NOTICE_TAIL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReloginNoticeState {
  visible: boolean;
  cutover: Date | null;
  phase: 'before' | 'after' | null;
}

const HIDDEN: ReloginNoticeState = { visible: false, cutover: null, phase: null };

function parseCutover(iso: string | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject overflowed dates such as 2026-02-31
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export function getReloginNoticeState(now: Date, cutoverIso: string | undefined): ReloginNoticeState {
  const cutover = parseCutover(cutoverIso);
  if (!cutover) return { ...HIDDEN };

  const start = cutover.getTime() - NOTICE_LEAD_DAYS * DAY_MS;
  const end = cutover.getTime() + NOTICE_TAIL_DAYS * DAY_MS;
  const t = now.getTime();

  if (t < start || t > end) return { ...HIDDEN };
  return { visible: true, cutover, phase: t < cutover.getTime() ? 'before' : 'after' };
}
