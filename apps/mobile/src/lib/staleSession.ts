// Seance "fantome" (run4) : "Seance en cours Lower 705 min" + "Reprendre" ouvrant une seance rapide vide.
// Une seance ouverte trop longtemps, ou sans aucune serie validee, n'est plus proposee a la reprise :
// elle est cloturee (ou supprimee si vide) sans credit ni XP. Module pur (horloge injectable).

/** Au-dela, une seance encore ouverte est consideree abandonnee. */
export const STALE_SESSION_HOURS = 6;
export const STALE_SESSION_MS = STALE_SESSION_HOURS * 60 * 60 * 1000;

export function sessionAgeMs(startedAt: string | null | undefined, now: number): number {
  const t = startedAt ? Date.parse(startedAt) : NaN;
  return Number.isFinite(t) ? Math.max(0, now - t) : Number.POSITIVE_INFINITY;
}

/** Date de debut absente/illisible => perimee (on ne peut pas la reprendre de facon fiable). */
export function isStaleSession(startedAt: string | null | undefined, now: number = Date.now()): boolean {
  return sessionAgeMs(startedAt, now) > STALE_SESSION_MS;
}

export type OpenSessionVerdict = 'resume' | 'discard' | 'autoclose';

/**
 * Au redemarrage de l'app (l'etat en memoire - exercices charges - est perdu) :
 *  - aucune serie validee -> 'discard' (rien a reprendre, on ne garde rien en base) ;
 *  - ouverte depuis plus de STALE_SESSION_HOURS -> 'autoclose' (cloture neutre) ;
 *  - sinon 'resume'.
 */
export function classifyRestoredSession(input: {
  startedAt: string | null | undefined;
  completedSets: number;
  now?: number;
}): OpenSessionVerdict {
  if (input.completedSets <= 0) return 'discard';
  return isStaleSession(input.startedAt, input.now ?? Date.now()) ? 'autoclose' : 'resume';
}

/** Pendant l'utilisation de l'app : seule l'anciennete decide (une seance neuve sans serie reste reprenable). */
export function classifyLiveSession(input: {
  startedAt: string | null | undefined;
  completedSets: number;
  now?: number;
}): OpenSessionVerdict {
  if (!isStaleSession(input.startedAt, input.now ?? Date.now())) return 'resume';
  return input.completedSets <= 0 ? 'discard' : 'autoclose';
}
