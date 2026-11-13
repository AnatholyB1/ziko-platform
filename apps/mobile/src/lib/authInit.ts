/**
 * Demarrage de session (revue A #16), logique pure et testable sans supabase ni React Native.
 *
 * 1) `getSession()` peut rejeter : sans `.catch` ni `finally`, `isInitialized` restait a false (splash infini).
 * 2) Dans le callback `onAuthStateChange` de supabase-js, il ne faut PAS `await` d'appel supabase :
 *    auth-js tient un verrou pendant le callback, une requete authentifiee y attend le meme verrou
 *    (deadlock connu). On differe donc le chargement du profil hors du callback.
 */
export interface InitialSessionDeps {
  getSession: () => Promise<{ data: { session: { user?: unknown } | null } }>;
  applySession: (session: { user?: unknown } | null) => void;
  refreshProfile: () => Promise<unknown>;
  /** Toujours appele une fois (succes ou echec) : isLoading=false, isInitialized=true. */
  done: () => void;
}

export async function loadInitialSession(deps: InitialSessionDeps): Promise<void> {
  try {
    const {
      data: { session },
    } = await deps.getSession();
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
