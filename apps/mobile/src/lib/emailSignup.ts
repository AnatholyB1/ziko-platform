// Email sign-up. Supabase keeps mailer_autoconfirm=true (shared project): signUp returns a session
// immediately. Email ownership is then proven by the Ziko backend (Resend code), which never blocks
// onboarding: the user can skip and verify later from the home banner.
import { supabase } from './supabase';
import {
  sendVerificationCode,
  verifyEmailCode,
  type SendCodeResult,
  type VerifyCodeResult,
} from './emailVerification';

export type SignUpResult =
  | { status: 'verify-email'; email: string; cooldown: number }
  | { status: 'signed-in' } // account created, code could not be sent: go on, verify later
  | { status: 'error'; message: string };

const MSG_GENERIC = 'Une erreur est survenue. Réessaie dans un instant.';
const MSG_NO_SESSION =
  'Compte créé, mais la connexion automatique a échoué. Connecte-toi avec ton email et ton mot de passe.';

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
  if (!data?.session) return { status: 'error', message: MSG_NO_SESSION };

  const sent = await sendVerificationCode();
  if (sent.status === 'sent') return { status: 'verify-email', email, cooldown: sent.cooldown };
  if (sent.status === 'cooldown') return { status: 'verify-email', email, cooldown: sent.retryAfter };
  return { status: 'signed-in' };
}

export function verifySignupCode(code: string): Promise<VerifyCodeResult> {
  return verifyEmailCode(code);
}

export function resendSignupCode(): Promise<SendCodeResult> {
  return sendVerificationCode();
}
