// v1.20 Phase 16 (MEAS-02) - evenement SSE `goal` de la conversation d'onboarding : un objectif de mesure
// vient d'etre enregistre en base par l'IA. Pur (aucune I/O) pour etre teste ; l'ecran n'affiche une carte
// que pour un evenement valide (jamais pour une valeur inventee cote client).

export interface OnboardingGoal {
  id: string | null;
  measure: string;
  measure_key: string;
  start_value: number;
  target_value: number;
  unit: string;
  target_date: string | null;
}

/** Valide la charge utile `goal` ; renvoie null si elle est inexploitable. */
export function parseGoalEvent(raw: unknown): OnboardingGoal | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const start = Number(g.start_value);
  const target = Number(g.target_value);
  if (typeof g.measure_key !== 'string' || !Number.isFinite(start) || !Number.isFinite(target) || start === target) return null;
  if (typeof g.unit !== 'string' || !g.unit) return null;
  return {
    id: typeof g.id === 'string' ? g.id : null,
    measure: typeof g.measure === 'string' && g.measure ? g.measure : g.measure_key,
    measure_key: g.measure_key,
    start_value: start,
    target_value: target,
    unit: g.unit,
    target_date: typeof g.target_date === 'string' && g.target_date ? g.target_date : null,
  };
}

const num = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** "Poids : 82 → 76 kg" */
export function goalSummary(g: OnboardingGoal): string {
  return `${g.measure} : ${num(g.start_value)} → ${num(g.target_value)} ${g.unit}`;
}

/** "Baisse de 6 kg" / "Hausse de 4 cm". */
export function goalDirectionLabel(g: OnboardingGoal): string {
  const diff = Math.abs(g.target_value - g.start_value);
  return `${g.target_value < g.start_value ? 'Baisse' : 'Hausse'} de ${num(diff)} ${g.unit}`;
}

/** Ajoute sans doublon (meme id, ou meme mesure quand l'id manque). */
export function addGoal(list: OnboardingGoal[], g: OnboardingGoal): OnboardingGoal[] {
  const dup = list.some((x) => (g.id && x.id ? x.id === g.id : x.measure_key === g.measure_key));
  return dup ? list : [...list, g];
}
