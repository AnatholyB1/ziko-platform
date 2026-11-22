// Run 7 (P22) : apres un logout global (refresh token revoque, JWT encore valide ~1 h) le backend repond 401 et Mon coach
// affichait « Vérifie ta connexion » comme pour une erreur reseau. On distingue : 401/403 = session expiree (bandeau +
// « Se reconnecter »), erreur reseau = « Vérifie ta connexion », le reste = erreur serveur. Module pur.

export type LoadFailure = 'expired' | 'offline' | 'server';

export function classifyLoadError(err: any): LoadFailure {
  const name = String(err?.name ?? '');
  const msg = String(err?.message ?? '').toLowerCase();
  const code = String(err?.code ?? '');
  const status = Number(err?.status ?? 0);
  if (
    name === 'SessionExpiredError' ||
    code === 'PGRST301' ||
    code === 'PGRST303' ||
    status === 401 ||
    status === 403 ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('session expir')
  ) {
    return 'expired';
  }
  // Une reponse HTTP a bien ete recue : ce n'est pas un probleme reseau.
  if (status > 0) return 'server';
  if (
    name === 'TypeError' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  ) {
    return 'offline';
  }
  return 'server';
}

export const LOAD_FAILURE_COPY: Record<LoadFailure, { title: string; body: string }> = {
  expired: { title: 'Session expirée', body: 'Reconnecte-toi pour retrouver ton coach.' },
  offline: { title: 'Impossible de charger', body: 'Vérifie ta connexion, puis réessaie.' },
  server: { title: 'Impossible de charger', body: 'Le service ne répond pas. Réessaie dans un instant.' },
};

/** Erreur typée pour une reponse HTTP non ok (porte le statut). */
export function httpError(message: string, status: number): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}
