// D-12 in-app channel (mobile): window during which the re-login notice is shown.
// Pure module (no env or storage access) - mirrors apps/web/src/lib/reloginNotice.ts.

export const NOTICE_LEAD_DAYS = 21;
export const NOTICE_TAIL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReloginNoticeState {
  visible: boolean;
  cutover: Date | null;
  phase: 'before' | 'after' | null;
}

function parseCutover(iso: string | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject overflowed dates such as 2026-02-31
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export function getReloginNoticeState(
  now: Date,
  cutoverIso: string | undefined,
): ReloginNoticeState {
  const cutover = parseCutover(cutoverIso);
  if (!cutover) return { visible: false, cutover: null, phase: null };

  const start = cutover.getTime() - NOTICE_LEAD_DAYS * DAY_MS;
  const end = cutover.getTime() + NOTICE_TAIL_DAYS * DAY_MS;
  const t = now.getTime();

  if (t < start || t > end) return { visible: false, cutover: null, phase: null };
  return { visible: true, cutover, phase: t < cutover.getTime() ? 'before' : 'after' };
}

/** Storage key recording that the notice was acknowledged for a given cutover date. */
export function reloginAckKey(cutoverIso: string): string {
  return `relogin_notice_ack_${cutoverIso}`;
}
