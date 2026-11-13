// v1.20 Phase 16 (MEAS-08) - libelles purs des modifications d'objectif faites par l'IA.
// La raison est toujours montree a la personne (bandeau de l'onglet Objectifs) ; aucune pénalité, ton neutre.

export type RevisionReason = 'stagnation' | 'pace' | 'injury_pause' | 'main_goal_change';

export interface GoalRevisionRow {
  id: string;
  goal_id: string;
  measure_key: string;
  reason: RevisionReason | string;
  reason_detail: string | null;
  old_target: number;
  new_target: number;
  old_target_date: string | null;
  new_target_date: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export const REVISION_REASON_LABELS: Record<RevisionReason, string> = {
  stagnation: 'Ta progression est stable depuis plus de 4 semaines',
  pace: 'Ton rythme ne correspondait plus à la cible',
  injury_pause: 'Tu as signalé une blessure ou une pause',
  main_goal_change: "Ton objectif principal a changé",
};

export function reasonLabel(reason: string): string {
  return (REVISION_REASON_LABELS as Record<string, string>)[reason] ?? 'Ajustement de ton coach IA';
}

function fmt(n: number): string {
  return String(Math.round(Number(n) * 10) / 10).replace('.', ',');
}

/** "Cible 80 → 85 kg" ; ajoute la nouvelle date si elle change. */
export function describeRevisionChange(r: Pick<GoalRevisionRow, 'old_target' | 'new_target' | 'old_target_date' | 'new_target_date'>, unit: string): string {
  const parts: string[] = [];
  if (Number(r.old_target) !== Number(r.new_target)) parts.push(`Cible ${fmt(r.old_target)} → ${fmt(r.new_target)} ${unit}`);
  if (r.new_target_date && r.new_target_date !== r.old_target_date) {
    const [y, m, d] = r.new_target_date.slice(0, 10).split('-');
    parts.push(`Nouvelle date : ${d}/${m}/${y}`);
  }
  return parts.join(' · ') || 'Objectif ajusté';
}

/** Revisions non acquittees, la plus recente d'abord. */
export function unacknowledged(rows: GoalRevisionRow[]): GoalRevisionRow[] {
  return rows
    .filter((r) => !r.acknowledged_at)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}
