// Email sign-up with optional email confirmation.
// Backward compatible: when the project auto-confirms (mailer_autoconfirm=true) signUp
// returns a session and the caller goes straight to onboarding. When confirmation is on,
// no session is returned: the user types the 6-digit code from the email (OTP), which
// avoids any deep link round trip.
import { supabase } from './supabase';

export type SignUpResult =
  | { status: 'signed-in' }
  | { status: 'needs-verification'; email: string }
  | { status: 'error'; message: string };

export type VerifyResult = { status: 'verified' } | { status: 'error'; message: string };

const MSG_GENERIC = 'Une erreur est survenue. Réessaie dans un instant.';
const MSG_BAD_CODE = 'Code invalide ou expiré. Vérifie le code ou demande-en un nouveau.';

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { app: 'ziko', full_name: name } },
  });
  if (error) return { status: 'error', message: error.message || MSG_GENERIC };
  if (data?.session) return { status: 'signed-in' };
  return { status: 'needs-verification', email };
}

export async function verifySignupCode(email: string, code: string): Promise<VerifyResult> {
  const token = code.replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(token)) return { status: 'error', message: MSG_BAD_CODE };
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error || !data?.session) return { status: 'error', message: MSG_BAD_CODE };
  return { status: 'verified' };
}

export async function resendSignupCode(email: string): Promise<VerifyResult> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) return { status: 'error', message: error.message || MSG_GENERIC };
  return { status: 'verified' };
}
