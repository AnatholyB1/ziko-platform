// Session manager (v1.20 P2, SESS-01..03).
// Pure logic with an injected Supabase auth client so it is unit-testable.
// - foreground/background: start/stop Supabase auto refresh + explicit refresh on return
// - expiry detection: unrecoverable refresh failure -> status 'expired'
// - single fresh source: ensureFreshSession() / requireUser()
// - patchGetUser(): auth.getUser() without a jwt reads the (auto-refreshed) local
//   session instead of a network call that fails with an expired access token.

import type { Session, User } from '@supabase/supabase-js';

export interface AuthClientLike {
  getSession: () => Promise<{ data: { session: Session | null }; error?: any }>;
  refreshSession: () => Promise<{ data: { session: Session | null }; error?: any }>;
  startAutoRefresh?: () => Promise<void> | void;
  stopAutoRefresh?: () => Promise<void> | void;
  signOut?: (opts?: { scope?: 'local' | 'global' | 'others' }) => Promise<any>;
  getUser?: (jwt?: string) => Promise<any>;
}

export type FreshSessionResult =
  | { status: 'ok'; session: Session }
  | { status: 'none'; session: null }
  | { status: 'expired'; session: null }
  | { status: 'offline'; session: Session | null };

export class SessionExpiredError extends Error {
  constructor(message = 'Session expirée') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/** Refresh when fewer than this many seconds remain before expiry. */
export const REFRESH_SKEW_SECONDS = 60;

const PERMANENT_CODES = [
  'invalid_grant',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'bad_jwt',
];

/** True when a refresh error means the session can never be recovered (vs transient network). */
export function isPermanentAuthError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code ?? '').toLowerCase();
  if (PERMANENT_CODES.includes(code)) return true;
  const msg = String(err.message ?? '').toLowerCase();
  if (
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found') ||
    msg.includes('refresh_token_not_found') ||
    msg.includes('invalid_grant') ||
    msg.includes('already used')
  ) {
    return true;
  }
  const status = Number(err.status ?? 0);
  return status === 400 || status === 401 || status === 403;
}

function secondsLeft(session: Session, nowMs: number): number {
  if (typeof session.expires_at !== 'number') return Number.POSITIVE_INFINITY;
  return session.expires_at - Math.floor(nowMs / 1000);
}

export function createSessionManager(
  client: AuthClientLike,
  opts: { now?: () => number; skewSeconds?: number } = {},
) {
  const now = opts.now ?? (() => Date.now());
  const skew = opts.skewSeconds ?? REFRESH_SKEW_SECONDS;
  let inflight: Promise<FreshSessionResult> | null = null;

  async function doEnsure(): Promise<FreshSessionResult> {
    const { data, error } = await client.getSession();
    const session = data?.session ?? null;
    if (error && isPermanentAuthError(error)) return { status: 'expired', session: null };
    if (!session) return { status: 'none', session: null };

    if (secondsLeft(session, now()) > skew) return { status: 'ok', session };

    try {
      const res = await client.refreshSession();
      if (res.error) {
        if (isPermanentAuthError(res.error)) return { status: 'expired', session: null };
        return secondsLeft(session, now()) > 0
          ? { status: 'offline', session }
          : { status: 'offline', session: null };
      }
      if (res.data?.session) return { status: 'ok', session: res.data.session };
      return { status: 'expired', session: null };
    } catch (e) {
      // fetch/network failure thrown instead of returned
      if (isPermanentAuthError(e)) return { status: 'expired', session: null };
      return secondsLeft(session, now()) > 0
        ? { status: 'offline', session }
        : { status: 'offline', session: null };
    }
  }

  /** Returns a session that is valid now (refreshing if near expiry). Concurrent calls share one refresh. */
  function ensureFreshSession(): Promise<FreshSessionResult> {
    if (!inflight) {
      inflight = doEnsure().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  /** Current user from the fresh session, or throws SessionExpiredError. */
  async function requireUser(): Promise<User> {
    const r = await ensureFreshSession();
    if ((r.status === 'ok' || r.status === 'offline') && r.session?.user) return r.session.user;
    throw new SessionExpiredError();
  }

  /** AppState 'active': resume auto refresh and refresh now if needed. */
  async function handleForeground(): Promise<FreshSessionResult> {
    try {
      await client.startAutoRefresh?.();
    } catch {
      /* ignore */
    }
    return ensureFreshSession();
  }

  /** AppState background/inactive: stop the refresh timer (official RN pattern). */
  async function handleBackground(): Promise<void> {
    try {
      await client.stopAutoRefresh?.();
    } catch {
      /* ignore */
    }
  }

  /** Local sign-out of an unrecoverable session (no network call on the dead token). */
  async function clearExpiredSession(): Promise<void> {
    try {
      await client.signOut?.({ scope: 'local' });
    } catch {
      /* storage already cleared or offline: nothing else to do */
    }
  }

  return { ensureFreshSession, requireUser, handleForeground, handleBackground, clearExpiredSession };
}

export type SessionManager = ReturnType<typeof createSessionManager>;

/**
 * Makes `auth.getUser()` (no jwt) resolve from the locally managed session, which
 * the client refreshes automatically. The default implementation hits the network
 * with the stored access token and returns user=null when that token is expired,
 * which surfaced as "Utilisateur non connecté" on a still-valid session (SESS-03).
 * With an explicit jwt the original implementation is used unchanged.
 */
export function patchGetUser(client: AuthClientLike, manager: SessionManager): void {
  const original = client.getUser?.bind(client);
  client.getUser = async (jwt?: string) => {
    if (jwt !== undefined && original) return original(jwt);
    const r = await manager.ensureFreshSession();
    if ((r.status === 'ok' || r.status === 'offline') && r.session?.user) {
      return { data: { user: r.session.user }, error: null };
    }
    if (r.status === 'expired') {
      return { data: { user: null }, error: new SessionExpiredError() };
    }
    // no stored session: defer to the original (returns AuthSessionMissingError)
    return original ? original() : { data: { user: null }, error: new SessionExpiredError() };
  };
}
