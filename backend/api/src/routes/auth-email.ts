// Application-level email verification (Resend), independent from Supabase "Confirm email".
//   POST /auth/email/send-code               Bearer, sends a 6-digit code to the account email
//   POST /auth/email/verify-code             Bearer, { code } -> sets ziko_user_profiles.email_verified_at
//   POST /auth/email/mark-verified-social    Bearer, marks verified when a google/apple identity proves the email
//
// No service role here: every DB call is an RPC made with the USER's JWT (publishable key). The RPCs
// derive identity from auth.uid() and additionally require EMAIL_VERIFY_RPC_SECRET, whose SHA-256 is
// stored in the database (see supabase/portfolio-migrations/20261107180000_ziko_email_verification.sql),
// so a client cannot call them directly to verify itself.
import { Hono, type MiddlewareHandler } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';
import { createUserRateLimiter } from '../middleware/rateLimiter.js';
import { VerifyEmailCode } from '@ziko/email/templates/VerifyEmailCode';

export const COOLDOWN_SECONDS = 60;
export const DEFAULT_FROM = 'Ziko <no-reply@mail.ziko-app.com>';

export type AttemptStatus = 'pending' | 'none' | 'expired' | 'too_many';
export interface AttemptRow {
  status: AttemptStatus;
  code_hash: string | null;
  salt: string | null;
}

export interface SocialIdentity {
  provider: string;
  email?: string | null;
  emailVerified?: boolean | null;
}
export interface AuthUserInfo {
  email: string;
  identities: SocialIdentity[];
}

/** Everything that touches the outside world, injectable for tests and for the local proof harness. */
export interface AuthEmailDeps {
  rpc: {
    codeAge(jwt: string): Promise<number | null>;
    createCode(jwt: string, hash: string, salt: string): Promise<void>;
    verifyAttempt(jwt: string): Promise<AttemptRow>;
    confirm(jwt: string): Promise<void>;
    markVerifiedSocial(jwt: string): Promise<void>;
  };
  getUser(jwt: string): Promise<AuthUserInfo | null>;
  sendMail(args: { from: string; to: string; subject: string; html: string }): Promise<{ error?: unknown }>;
  hasMailKey(): boolean;
  from(): string;
  /** per-user hourly cap, runs after authMiddleware */
  rateLimit: MiddlewareHandler;
  authenticate: MiddlewareHandler;
}

export function hashCode(code: string, salt: string, userId: string): string {
  return createHash('sha256').update(`${salt}:${userId}:${code}`).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function rpcSecret(): string {
  return process.env.EMAIL_VERIFY_RPC_SECRET ?? '';
}

function userClient(jwt: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

async function callRpc<T>(jwt: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await userClient(jwt).rpc(fn, { p_secret: rpcSecret(), ...args });
  if (error) throw new Error(`rpc ${fn} failed: ${error.code ?? ''} ${error.message}`);
  return data as T;
}

export function defaultDeps(): AuthEmailDeps {
  return {
    rpc: {
      codeAge: (jwt) => callRpc<number | null>(jwt, 'ziko_email_code_age', {}),
      createCode: async (jwt, hash, salt) => {
        await callRpc<void>(jwt, 'ziko_email_create_code', { p_hash: hash, p_salt: salt });
      },
      verifyAttempt: async (jwt) => {
        const rows = await callRpc<AttemptRow[]>(jwt, 'ziko_email_verify_attempt', {});
        return rows[0] ?? { status: 'none', code_hash: null, salt: null };
      },
      confirm: async (jwt) => {
        await callRpc<void>(jwt, 'ziko_email_confirm', {});
      },
      markVerifiedSocial: async (jwt) => {
        await callRpc<void>(jwt, 'ziko_email_mark_verified_social', {});
      },
    },
    getUser: async (jwt) => {
      const { data, error } = await userClient(jwt).auth.getUser(jwt);
      if (error || !data.user) return null;
      return {
        email: data.user.email ?? '',
        identities: (data.user.identities ?? []).map((i) => {
          const d = (i.identity_data ?? {}) as Record<string, unknown>;
          const ev = d.email_verified;
          return {
            provider: i.provider,
            email: typeof d.email === 'string' ? d.email : null,
            emailVerified: ev === undefined ? null : ev === true || ev === 'true',
          };
        }),
      };
    },
    sendMail: async (args) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      return resend.emails.send(args);
    },
    hasMailKey: () => Boolean(process.env.RESEND_API_KEY),
    from: () => process.env.EMAIL_FROM || DEFAULT_FROM,
    rateLimit: createUserRateLimiter(10, '1 h', 'auth-email-send'),
    authenticate: authMiddleware,
  };
}

/** True when a google/apple identity proves ownership of the account email. */
export function socialIdentityProvesEmail(u: AuthUserInfo): boolean {
  const mail = u.email.trim().toLowerCase();
  if (!mail) return false;
  return u.identities.some(
    (i) =>
      (i.provider === 'google' || i.provider === 'apple') &&
      (i.email ?? '').trim().toLowerCase() === mail &&
      i.emailVerified !== false,
  );
}

function bearer(authorization: string | undefined): string {
  return (authorization ?? '').replace(/^Bearer\s+/i, '');
}

export function createAuthEmailRouter(deps: AuthEmailDeps = defaultDeps()) {
  const router = new Hono();

  router.use('/email/*', (c, next) => deps.authenticate(c, next));

  router.post('/email/send-code', (c, next) => deps.rateLimit(c, next), async (c) => {
    const { userId, email } = c.get('auth');
    const jwt = bearer(c.req.header('Authorization'));
    if (!email) return c.json({ error: 'No email on this account' }, 400);
    if (!deps.hasMailKey()) return c.json({ error: 'Email service not configured' }, 503);

    const age = await deps.rpc.codeAge(jwt);
    if (age !== null && age < COOLDOWN_SECONDS) {
      const retryAfter = COOLDOWN_SECONDS - age;
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'cooldown', retryAfter }, 429);
    }

    const code = generateCode();
    const salt = randomBytes(16).toString('hex');
    await deps.rpc.createCode(jwt, hashCode(code, salt, userId), salt);

    const html = await render(VerifyEmailCode({ code }));
    const { error } = await deps.sendMail({
      from: deps.from(),
      to: email, // always the authenticated account email, never a client-supplied address
      subject: 'Ton code de confirmation Ziko',
      html,
    });
    if (error) {
      console.error('[auth-email] Resend error', error);
      return c.json({ error: 'Email could not be sent' }, 502);
    }
    return c.json({ status: 'sent', cooldown: COOLDOWN_SECONDS });
  });

  router.post('/email/verify-code', async (c) => {
    const { userId } = c.get('auth');
    const jwt = bearer(c.req.header('Authorization'));
    const body = (await c.req.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : '';
    if (!/^\d{6}$/.test(code)) return c.json({ status: 'bad' }, 400);

    const attempt = await deps.rpc.verifyAttempt(jwt);
    if (attempt.status === 'expired') return c.json({ status: 'expired' }, 410);
    if (attempt.status === 'too_many') return c.json({ status: 'too_many' }, 429);
    if (attempt.status !== 'pending' || !attempt.code_hash || !attempt.salt) {
      return c.json({ status: 'none' }, 400);
    }
    if (!safeEqualHex(hashCode(code, attempt.salt, userId), attempt.code_hash)) {
      return c.json({ status: 'bad' }, 400);
    }
    await deps.rpc.confirm(jwt);
    return c.json({ status: 'ok' });
  });

  router.post('/email/mark-verified-social', async (c) => {
    const jwt = bearer(c.req.header('Authorization'));
    const user = await deps.getUser(jwt);
    if (!user || !socialIdentityProvesEmail(user)) {
      return c.json({ status: 'not_proven' }, 403);
    }
    await deps.rpc.markVerifiedSocial(jwt);
    return c.json({ status: 'ok' });
  });

  return router;
}
