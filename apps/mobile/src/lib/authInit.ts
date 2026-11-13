/**
 * Demarrage de session (revue A #16), logique pure et testable sans supabase ni React Native.
 *
 * 1) `getSession()` peut rejeter : sans `.catch` ni `finally`, `isInitialized` restait a false (splash infini).
 * 2) Dans le callback `onAuthStateChange` de supabase-js, il ne faut PAS `await` d'appel supabase :
 *    auth-js tient un verrou pendant le callback, une requete authentifiee y attend le meme verrou
 *    (deadlock connu). On differe donc le chargement du profil hors du callback.
 */
export interface InitialSessionDeps {
  getSession: () => Promise<{ data: { session: { user?: unknown } | null }; error?: unknown }>;
  /**
   * Demarrage a froid HORS LIGNE (run5) : si getSession ne rend pas de session a cause d'une erreur reseau
   * (refresh impossible, jeton d'acces expire), on relit la session PERSISTEE : l'app s'ouvre en mode degrade
   * au lieu de l'ecran Bienvenue. Une erreur PERMANENTE (jeton revoque) reste une vraie deconnexion (regle P2).
   */
  readPersistedSession?: () => Promise<{ user?: unknown } | null>;
  isPermanentError?: (err: unknown) => boolean;
  applySession: (session: { user?: unknown } | null) => void;
  refreshProfile: () => Promise<unknown>;
  /** Toujours appele une fois (succes ou echec) : isLoading=false, isInitialized=true. */
  done: () => void;
}

export async function loadInitialSession(deps: InitialSessionDeps): Promise<void> {
  try {
    const res = await deps.getSession();
    let session = res.data.session;
    if (!session && res.error && deps.readPersistedSession && !deps.isPermanentError?.(res.error)) {
      try {
        const persisted = await deps.readPersistedSession();
        if (persisted?.user) session = persisted;
      } catch {
        /* stockage illisible : deconnecte */
      }
    }
    deps.applySession(session);
    if (session?.user) {
      try {
        await deps.refreshProfile();
      } catch {
        /* profil indisponible : l'app s'ouvre, le profil sera relu plus tard */
      }
    }
  } catch {
    /* session illisible : on considere l'utilisateur deconnecte plutot que de bloquer au splash */
  } finally {
    deps.done();
  }
}

/** Planifie `refresh` hors de la pile du callback auth (jamais d'await dans le callback). */
export function deferProfileRefresh(
  refresh: () => Promise<unknown>,
  schedule: (fn: () => void) => void = (fn) => {
    setTimeout(fn, 0);
  },
): void {
  schedule(() => {
    void Promise.resolve()
      .then(refresh)
      .catch(() => {});
  });
}

/** Cle de stockage par defaut de supabase-js v2 : sb-<premier label du host>-auth-token. */
export function supabaseStorageKey(supabaseUrl: string): string {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'supabase.auth.token';
  }
}

/** Relit la session persistee (sans reseau). Rend null si absente, illisible ou sans jeton de rafraichissement. */
export async function readPersistedSession<T = { user?: unknown }>(
  storage: { getItem: (k: string) => Promise<string | null> },
  supabaseUrl: string,
): Promise<T | null> {
  const raw = await storage.getItem(supabaseStorageKey(supabaseUrl));
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const s = parsed?.currentSession ?? parsed;
  return s && typeof s === 'object' && s.refresh_token && s.user ? (s as T) : null;
}
