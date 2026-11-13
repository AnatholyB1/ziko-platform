// Libelles francais purs (pluriels, accueil), testables sans React Native. UAT run 6 :
// "1 series completees", "1 jours", "490 kcal" sans objectif.

// `frCount` (`1 série`, `2 séries` ; 0 et 1 au singulier) vit dans @ziko/plugin-sdk (formatFr) : une seule source.
// Import relatif direct (module pur) : l'index du SDK tire react-native, inutilisable dans les tests node.
import { frCount } from '../../../../packages/plugin-sdk/src/formatFr';
export { frCount };

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
