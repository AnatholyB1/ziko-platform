// Navigation et rafraichissement partages par les ecrans qui creent / activent un programme (UATN-03).
// Module pur (pas d'import React Native) : testable avec vitest en node.

/** Cles TanStack Query a invalider apres creation / activation (liste Programmes, accueil, onglet Entrainement). */
export const PROGRAM_QUERY_KEYS: ReadonlyArray<readonly string[]> = [
  ['programs'],
  ['program', 'active'],
  ['active-program'],
  ['ai_programs'],
  ['ai_program_active'],
];

type QueryClientLike = { invalidateQueries: (filters: { queryKey: readonly string[] }) => Promise<unknown> | unknown };

/** La carte "Crée ton premier entraînement" de l'accueil et l'onglet Entrainement relisent le programme actif. */
export async function refreshProgramQueries(qc: QueryClientLike): Promise<void> {
  await Promise.all(PROGRAM_QUERY_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export const TRAINING_DASHBOARD_ROUTE = '/(app)/workout';

type RouterLike = { dismissTo?: (href: any) => void; replace: (href: any) => void };

/**
 * Revient au tableau de l'onglet Entrainement en vidant la pile imbriquee (assistant, liste Programmes, atelier...) :
 * UAT phase 3, l'onglet gardait l'ecran du dessus et un tap sur l'onglet ne revenait pas au tableau.
 * `dismissTo` depile jusqu'a l'ecran `index` s'il est dans la pile, sinon l'ouvre ; `replace` en repli.
 */
export function goToTrainingDashboard(router: RouterLike): void {
  if (typeof router.dismissTo === 'function') {
    router.dismissTo(TRAINING_DASHBOARD_ROUTE);
    return;
  }
  router.replace(TRAINING_DASHBOARD_ROUTE);
}
