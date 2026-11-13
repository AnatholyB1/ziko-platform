/**
 * Cles TanStack Query reellement utilisees par l'accueil (useHomeData.ts). L'accueil est un onglet
 * qui reste monte, avec staleTime 5 min : sans invalidation explicite apres une seance, un log d'eau
 * ou un repas, il affiche des donnees perimees (revue A #2). Source unique de la liste a invalider.
 */
export const HOME_QUERY_KEYS: ReadonlyArray<readonly string[]> = [
  ['program', 'active'],
  ['workouts', 'weekly'],
  ['workouts', 'recent'],
  ['session_streak'],
  ['streak'],
  ['sleep'],
  ['hydration', 'today'],
  ['nutrition', 'today'],
  ['quicklog', 'weight'],
  ['quicklog', 'mood'],
  ['nutrition', 'goal'],
];

type InvalidatingClient = { invalidateQueries: (filters: { queryKey: readonly string[] }) => Promise<unknown> | unknown };

/** Invalidates (hence refetches, for mounted queries) every home query. Never throws. */
export async function invalidateHomeQueries(
  qc: InvalidatingClient,
  keys: ReadonlyArray<readonly string[]> = HOME_QUERY_KEYS,
): Promise<void> {
  await Promise.all(
    keys.map(async (queryKey) => {
      try {
        await qc.invalidateQueries({ queryKey });
      } catch {
        /* un refetch en echec ne doit pas bloquer les autres */
      }
    }),
  );
}
