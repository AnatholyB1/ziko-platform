// Client for the backend email-verification endpoints (POST /auth/email/*).
// The backend, not Supabase, sends the 6-digit code (Resend) and records email_verified_at.
import { supabase } from './supabase';

export { isEmailVerified } from '@ziko/plugin-sdk';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type SendCodeResult =
  | { status: 'sent'; cooldown: number }
  | { status: 'cooldown'; retryAfter: number }
  | { status: 'error'; message: string };

export type VerifyCodeResult =
  | { status: 'verified' }
  | { status: 'error'; reason: 'bad' | 'expired' | 'too_many' | 'none' | 'network'; message: string };

const MSG_GENERIC = 'Une erreur est survenue. Réessaie dans un instant.';
const MSG: Record<string, string> = {
  bad: 'Code incorrect. Vérifie le code reçu par email.',
  expired: 'Ce code a expiré. Demande-en un nouveau.',
  too_many: 'Trop d’essais. Demande un nouveau code.',
  none: 'Aucun code en attente. Demande-en un nouveau.',
  network: 'Connexion impossible : vérifie ta connexion internet et réessaie.',
};

async function call(path: string, body?: unknown): Promise<Response | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    return await fetch(`${API_URL}/auth/email/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** Sends a code to the signed-in account's email (the address is never client-supplied). */
export async function sendVerificationCode(): Promise<SendCodeResult> {
  const res = await call('send-code');
  if (!res) return { status: 'error', message: MSG.network };
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 60;
    return { status: 'cooldown', retryAfter };
  }
  if (!res.ok) return { status: 'error', message: MSG_GENERIC };
  const json = (await res.json().catch(() => ({}))) as { cooldown?: number };
  return { status: 'sent', cooldown: json.cooldown ?? 60 };
}

export async function verifyEmailCode(rawCode: string): Promise<VerifyCodeResult> {
  const code = rawCode.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return { status: 'error', reason: 'bad', message: MSG.bad };
  const res = await call('verify-code', { code });
  if (!res) return { status: 'error', reason: 'network', message: MSG.network };
  if (res.ok) return { status: 'verified' };
  const json = (await res.json().catch(() => ({}))) as { status?: string };
  const reason = (['bad', 'expired', 'too_many', 'none'] as const).find((r) => r === json.status) ?? 'bad';
  return { status: 'error', reason, message: MSG[reason] };
}

/** After a Google/Apple sign-in: the server re-checks the identity with the user's JWT. */
export async function markVerifiedSocial(): Promise<boolean> {
  const res = await call('mark-verified-social');
  return Boolean(res?.ok);
}
