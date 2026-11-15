// Formatage francais unique (UAT run 7) : decimale a la virgule, espace avant l'unite, pluriels (0 et 1 au singulier).
// Pur, sans React : utilisable par l'app, les plugins et les tests.

/** `1 série`, `2 séries` ; 0 et 1 au singulier (regle francaise). */
export function frCount(n: number, singular: string, plural?: string): string {
  const abs = Math.abs(n);
  return `${n} ${abs < 2 ? singular : (plural ?? `${singular}s`)}`;
}

/** Nombre a la francaise : virgule decimale, sans zeros inutiles si `trim` (12,1 ; 2,0 -> 2). */
export function formatDecimalFr(n: number, digits = 1, trim = false): string {
  if (!Number.isFinite(n)) return '0';
  let s = n.toFixed(digits);
  if (trim && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

/** Millilitres -> `2,0 L` (espace avant L, virgule). */
export function formatLitersFr(ml: number, digits = 1): string {
  return `${formatDecimalFr(Math.max(0, ml) / 1000, digits)} L`;
}

/** `70,5 kg`. */
export function formatKgFr(kg: number, digits = 1): string {
  return `${formatDecimalFr(kg, digits)} kg`;
}

/** `490 kcal` : arrondi, espace avant l'unite. */
export function formatKcalFr(kcal: number): string {
  return `${Math.round(Number.isFinite(kcal) ? kcal : 0)} kcal`;
}
