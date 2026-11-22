// Decision de redirection au demarrage (cold start hors ligne, UAT run 6), logique pure.
//
// Avant : `profile` null => onboarding. Hors ligne la lecture du profil echoue, `profile` reste null
// alors que la session persistee est valide : l'athlete etait renvoye a l'onboarding. On distingue
// maintenant "lu avec succes et absent/incomplet" (onboarding) de "lecture echouee" (mode degrade).

export type ProfileReadStatus = 'unknown' | 'loaded' | 'missing' | 'error';
export type AppGate = 'login' | 'onboarding' | 'wait' | 'app';

/** Classe le resultat de `.from('ziko_user_profiles')...single()`. */
export function classifyProfileRead(res: {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}): ProfileReadStatus {
  if (res.data) return 'loaded';
  if (res.error) return res.error.code === 'PGRST116' ? 'missing' : 'error';
  return 'missing';
}

export function decideAppGate(input: {
  hasSession: boolean;
  profile: { onboarding_done?: boolean | null } | null;
  profileStatus: ProfileReadStatus;
}): AppGate {
  if (!input.hasSession) return 'login';
  if (input.profile?.onboarding_done) return 'app';
  if (input.profile) return 'onboarding'; // profil lu mais onboarding incomplet
  switch (input.profileStatus) {
    case 'missing':
    case 'loaded':
      return 'onboarding'; // lu avec succes et reellement absent/incomplet
    case 'error':
      return 'app'; // reseau indisponible : mode degrade, pas d'onboarding
    default:
      return 'wait'; // lecture pas encore terminee
  }
}

export const profileCacheKey = (uid: string) => `ziko_profile_cache_${uid}`;

/** Relit un profil mis en cache ; null si absent, illisible ou d'un autre utilisateur. */
export function parseCachedProfile<T extends { id?: string }>(raw: string | null, uid: string): T | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && p.id === uid ? (p as T) : null;
  } catch {
    return null;
  }
}
