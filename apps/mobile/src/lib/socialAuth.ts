import { Platform } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { markVerifiedSocial } from './emailVerification';

export type SocialAuthResult =
  | { status: 'success'; isNewUser: boolean }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const MSG_GENERIC = 'La connexion a échoué. Réessaie dans un instant.';
const MSG_NETWORK = 'Connexion impossible : vérifie ta connexion internet et réessaie.';
const MSG_PLAY = 'Google Play Services est indisponible ou obsolète sur cet appareil.';
const MSG_NO_TOKEN = 'Aucun jeton reçu du fournisseur. Réessaie.';

/** Apple Sign-In is only offered on iOS. */
export function isAppleSignInSupported(): boolean {
  return Platform.OS === 'ios';
}

/** A user is "new" when the account was created by this very sign-in. */
export function isFreshAccount(
  user: { created_at?: string; last_sign_in_at?: string } | null | undefined,
): boolean {
  if (!user?.created_at || !user.last_sign_in_at) return false;
  const delta = Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.created_at));
  return Number.isFinite(delta) && delta < 10_000;
}

function isNetworkError(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  return m.includes('network') || m.includes('fetch') || m.includes('timeout');
}

const MSG_EMAIL_FIRST =
  'Un compte existe déjà avec cet email. Connecte-toi d’abord par email, puis réessaie.';

function isEmailTakenError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  const m = String(err?.message ?? '').toLowerCase();
  return (
    err?.code === 'email_exists' ||
    err?.code === 'identity_already_exists' ||
    m.includes('already registered') ||
    m.includes('already been registered')
  );
}

function errorResult(e: unknown): SocialAuthResult {
  if (isEmailTakenError(e)) return { status: 'error', message: MSG_EMAIL_FIRST };
  return { status: 'error', message: isNetworkError(e) ? MSG_NETWORK : MSG_GENERIC };
}

type SocialUser = {
  id?: string;
  identities?: { provider?: string }[] | null;
} | null | undefined;

function randomPassword(): string {
  return Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Anti pre-hijack. GoTrue auto-links a Google/Apple identity to an existing email account. If that
 * email/password account was registered by someone else without proving the address
 * (mailer_autoconfirm=true), the pre-registrant still holds the password and live sessions.
 * Right after a social sign-in (fresh session, the provider proved the email) we therefore:
 *   1. replace the password with a random one nobody knows,
 *   2. revoke every other session (refresh tokens) with signOut({ scope: 'others' }),
 *   3. ask the backend to record the email as verified (it re-checks the identity server side).
 * Only when the account has an 'email' identity AND is not verified yet. Never blocks the sign-in.
 * Limits: an access JWT already issued to the attacker stays valid until it expires (default 1h);
 * the email identity stays linked; it only protects clients that run this code.
 */
export async function hardenAfterSocialSignIn(user: SocialUser): Promise<'skipped' | 'hardened' | 'failed'> {
  try {
    if (!user?.id) return 'skipped';
    const hasEmailIdentity = (user.identities ?? []).some((i) => i?.provider === 'email');
    const { data: profile } = await supabase
      .from('ziko_user_profiles')
      .select('email_verified_at')
      .eq('id', user.id)
      .maybeSingle();
    if ((profile as { email_verified_at?: string | null } | null)?.email_verified_at) return 'skipped';

    if (hasEmailIdentity) {
      const upd = await supabase.auth.updateUser({ password: randomPassword() });
      if (upd.error) return 'failed'; // do not mark verified if the pre-registrant was not cut off
      const out = await supabase.auth.signOut({ scope: 'others' });
      if (out.error) return 'failed';
    }
    await markVerifiedSocial();
    return 'hardened';
  } catch {
    return 'failed';
  }
}

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<SocialAuthResult> {
  try {
    configureGoogle();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return { status: 'cancelled' };
    const idToken = response.data?.idToken;
    if (!idToken) return { status: 'error', message: MSG_NO_TOKEN };

    // NOTE: google-signin 16.1.4 exposes no nonce option, so no nonce is sent;
    // the Supabase Google provider must have "Skip Nonce Check" enabled.
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return errorResult(error);
    await hardenAfterSocialSignIn(data?.user);
    return { status: 'success', isNewUser: isFreshAccount(data?.user) };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) return { status: 'cancelled' };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { status: 'error', message: MSG_PLAY };
    }
    return errorResult(e);
  }
}

function randomNonce(): string {
  const bytes = Crypto.getRandomBytes(32);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signInWithApple(): Promise<SocialAuthResult> {
  if (!isAppleSignInSupported()) {
    return { status: 'error', message: 'La connexion Apple n’est disponible que sur iOS.' };
  }
  try {
    if (!(await AppleAuthentication.isAvailableAsync())) {
      return { status: 'error', message: 'La connexion Apple n’est pas disponible sur cet appareil.' };
    }
    // Raw nonce goes to Supabase, its SHA-256 hash goes to Apple.
    const rawNonce = randomNonce();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { status: 'error', message: MSG_NO_TOKEN };

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return errorResult(error);
    await hardenAfterSocialSignIn(data?.user);

    // Apple only sends the name on the very first authorization.
    const fn = credential.fullName;
    const fullName = [fn?.givenName, fn?.familyName].filter(Boolean).join(' ').trim();
    if (fullName) {
      try {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      } catch {
        /* non-blocking */
      }
    }
    return { status: 'success', isNewUser: isFreshAccount(data?.user) };
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    return errorResult(e);
  }
}

/**
 * Turns a result into UI side effects. Cancelled is silent; errors go to
 * `alert`; success routes to onboarding (new) or the app (returning).
 */
export async function handleSocialResult(
  result: SocialAuthResult,
  deps: {
    alert: (title: string, message: string) => void;
    replace: (href: string) => void;
    beforeRoute?: () => Promise<void>;
  },
): Promise<void> {
  if (result.status === 'cancelled') return;
  if (result.status === 'error') {
    deps.alert('Connexion impossible', result.message);
    return;
  }
  if (deps.beforeRoute) await deps.beforeRoute().catch(() => {});
  deps.replace(result.isNewUser ? '/(auth)/onboarding/step-1' : '/(app)');
}
