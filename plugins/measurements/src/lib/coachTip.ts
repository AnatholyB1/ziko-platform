// Conseil coach du tableau de bord Mesures. UAT run2 P15 : le texte "mesures stables" etait affiche en dur,
// meme sans aucune mesure. Pure, sans React Native (testable sous vitest node).

export const STABLE_WEIGHT_TOLERANCE_KG = 0.5;

const BASE = 'Pèse-toi le matin à jeun, toujours au même moment.';

/** `rows` : mesures les plus recentes d'abord (jusqu'a 2 suffisent). */
export function weightCoachTip(rows: Array<{ weight_kg?: number | null }> | null | undefined): string {
  const weights = (rows ?? [])
    .map((r) => r?.weight_kg)
    .filter((w): w is number => typeof w === 'number' && Number.isFinite(w));
  if (weights.length === 0) return `${BASE} Ajoute ta première mesure pour suivre ton évolution.`;
  if (weights.length === 1) return `${BASE} Une deuxième mesure permettra de suivre ta tendance.`;
  const delta = Math.abs(weights[0] - weights[1]);
  if (delta <= STABLE_WEIGHT_TOLERANCE_KG) return `${BASE} Tes dernières mesures sont stables.`;
  return `${BASE} Ton poids évolue, garde le même rituel pour comparer.`;
}
