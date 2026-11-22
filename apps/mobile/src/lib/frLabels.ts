// Libelles francais purs (pluriels, accueil), testables sans React Native. UAT run 6 :
// "1 series completees", "1 jours", "490 kcal" sans objectif.

/** `1 série`, `2 séries` ; 0 et 1 au singulier. Meme contrat que `frCount` de @ziko/plugin-sdk (formatFr) : l'index du
 *  SDK tire react-native (inutilisable en test node) et un import relatif sort du projet TS mobile. */
export function frCount(n: number, singular: string, plural?: string): string {
  const abs = Math.abs(n);
  return `${n} ${abs < 2 ? singular : (plural ?? `${singular}s`)}`;
}

/** `1 série complétée`, `3 séries complétées`. */
export function setsCompletedLabel(n: number): string {
  return frCount(n, 'série complétée', 'séries complétées');
}

/** `1 jour`, `5 jours` (badge streak de l'accueil). */
export function daysLabel(n: number): string {
  return frCount(n, 'jour', 'jours');
}

/** Sous-titre de l'anneau Nutrition de l'accueil : toujours avec l'objectif quand il existe. */
export function nutritionRingSub(kcal: number, goal: number | null | undefined): string {
  if (!(kcal > 0)) return 'Loggue ton repas';
  const k = Math.round(kcal);
  return goal && goal > 0 ? `${k} / ${Math.round(goal)} kcal` : `${k} kcal`;
}
