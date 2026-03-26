// RPE 10 base percentages of 1RM (Tuchscherer / RTS methodology)
export const RPE10_PCT: Record<number, number> = {
  1: 100, 2: 97, 3: 94, 4: 91, 5: 89,
  6: 86, 7: 83, 8: 81, 9: 78, 10: 76,
  11: 74, 12: 71,
};

/**
 * Returns the estimated % of 1RM for a given reps × RPE combination.
 * Each full RPE point below 10 = –4%. Half-RPE = –2%.
 */
export function rpeToPercent(reps: number, rpe: number): number {
  const base = RPE10_PCT[Math.min(12, Math.max(1, reps))] ?? 71;
  return Math.max(10, Math.round((base - (10 - rpe) * 4) * 10) / 10);
}

/**
 * Estimates 1RM from a set performed at a given RPE.
 */
export function calc1RM(weight: number, reps: number, rpe: number): number {
  const pct = rpeToPercent(reps, rpe) / 100;
  return Math.round(weight / pct);
}

/** Reps in reserve deduced from RPE */
export function rpeToRIR(rpe: number): number {
  return Math.round((10 - rpe) * 2) / 2;
}

export const RPE_VALUES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export const TRAINING_ZONES = [
  { label: '50%', pct: 0.5 },
  { label: '60%', pct: 0.6 },
  { label: '65%', pct: 0.65 },
  { label: '70%', pct: 0.7 },
  { label: '75%', pct: 0.75 },
  { label: '80%', pct: 0.8 },
  { label: '85%', pct: 0.85 },
  { label: '90%', pct: 0.9 },
  { label: '92.5%', pct: 0.925 },
  { label: '95%', pct: 0.95 },
  { label: '97.5%', pct: 0.975 },
  { label: '100%', pct: 1 },
];
