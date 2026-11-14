// Phase 24 (v1.20) - ATEL-07/08/09 : logique PURE de la suite de programmes et de la relance automatique.
// Langage NEUTRE (regle non punitive) : "termine", "bilan", "suite" ; jamais echec/manque/retard.

export type SequenceItemStatus = 'done' | 'active' | 'next' | 'planned';
export type RelaunchStatus = 'pending' | 'proposing' | 'proposed' | 'dismissed';
export type NextPhaseHint = 'progress' | 'consolidate' | 'reentry';

export interface LiftChange {
  exercise: string;
  start_e1rm_kg: number;
  end_e1rm_kg: number;
  delta_kg: number;
  delta_pct: number;
}

export interface ProgramResults {
  version: 1;
  window: { from: string; to: string };
  sessions_done: number;
  sessions_planned: number | null;
  adherence_pct: number | null;
  total_volume_kg: number;
  lifts: LiftChange[];
  records: Array<{ exercise: string; e1rm_kg: number; best_set: string }>;
  hint: NextPhaseHint;
}

export interface SequenceItem {
  id: string;
  position: number;
  name: string;
  goal: string | null;
  status: SequenceItemStatus;
  weeks: number | null;
  started_at: string | null;
  completed_at: string | null;
  results: ProgramResults | null;
}

export interface RelaunchView {
  id: string;
  status: RelaunchStatus;
  draft_id: string | null;
  program_id: string;
  program_name: string | null;
  sequence_id: string | null;
  results: ProgramResults | null;
}

export const PERIOD_COPY = {
  title: 'Ma suite de programmes',
  empty: 'Ta suite apparaît ici dès que tu enregistres un programme depuis l\'atelier.',
  bannerTitle: 'Programme terminé',
  bannerBody: 'Ton bilan est prêt. L\'atelier peut préparer la suite à partir de tes résultats.',
  bannerPreparing: 'L\'atelier prépare la suite à partir de tes résultats…',
  bannerReady: 'La suite est prête, à relire dans l\'atelier.',
  prepare: 'Préparer la suite',
  review: 'Voir la suite',
  later: 'Plus tard',
  resultsTitle: 'Bilan du programme',
  noSessions: 'Aucune séance enregistrée sur cette période : la suite repart d\'une base douce.',
  openSequence: 'Ma suite',
  loadError: 'Impossible de charger ta suite pour le moment.',
  retry: 'Réessayer',
} as const;

export const STATUS_LABEL: Record<SequenceItemStatus, string> = {
  done: 'TERMINÉ',
  active: 'EN COURS',
  next: 'SUIVANT',
  planned: 'PRÉVU',
};

export const HINT_LABEL: Record<NextPhaseHint, string> = {
  progress: 'La suite construit sur tes progrès.',
  consolidate: 'La suite consolide ce niveau avant de monter.',
  reentry: 'La suite reprend en douceur, avec moins de volume.',
};

const fr = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Lignes de bilan (neutres) : seances, volume, evolution du 1RM estime, direction de la suite. */
export function resultsLines(r: ProgramResults): string[] {
  const lines: string[] = [];
  if (r.sessions_done === 0) {
    lines.push(PERIOD_COPY.noSessions);
    return lines;
  }
  lines.push(
    r.sessions_planned
      ? `${r.sessions_done} séance${r.sessions_done > 1 ? 's' : ''} sur ${r.sessions_planned} prévues`
      : `${r.sessions_done} séance${r.sessions_done > 1 ? 's' : ''} réalisée${r.sessions_done > 1 ? 's' : ''}`,
  );
  if (r.total_volume_kg > 0) lines.push(`${Math.round(r.total_volume_kg).toLocaleString('fr-FR')} kg de volume total`);
  for (const l of r.lifts.slice(0, 3)) {
    const sign = l.delta_kg > 0 ? '+' : '';
    lines.push(`${l.exercise} : ${fr(l.start_e1rm_kg)} → ${fr(l.end_e1rm_kg)} kg estimés (${sign}${fr(l.delta_kg)} kg)`);
  }
  lines.push(HINT_LABEL[r.hint]);
  return lines;
}

export type BannerState = 'hidden' | 'preparing' | 'prepare' | 'ready';

/** Etat du bandeau de l'onglet Seance : cache si rien d'ouvert, sinon 3 etats selon l'avancement de la proposition. */
export function bannerState(relaunch: RelaunchView | null, proposing: boolean): BannerState {
  if (!relaunch || relaunch.status === 'dismissed') return 'hidden';
  if (relaunch.status === 'proposed') return 'ready';
  if (proposing || relaunch.status === 'proposing') return 'preparing';
  return 'prepare';
}

/** La proposition automatique n'est lancee que pour une relance `pending` (idempotent cote serveur). */
export function shouldPropose(relaunch: RelaunchView | null): boolean {
  return !!relaunch && relaunch.status === 'pending' && !!relaunch.draft_id;
}

/** `goalToLabel` traduit l'objectif brut (`strength` -> `Force`, UAT run 9 defaut 3) ; l'ecran passe `goalLabel` du SDK. */
export function itemSubtitle(i: SequenceItem, goalToLabel: (goal: string) => string = (g) => g): string {
  const parts: string[] = [];
  if (i.weeks) parts.push(`${i.weeks} semaine${i.weeks > 1 ? 's' : ''}`);
  if (i.goal) parts.push(goalToLabel(i.goal));
  return parts.join(' · ');
}

/** Dernier programme termine de la suite (affiche son bilan). */
export function lastDone(items: SequenceItem[]): SequenceItem | null {
  const done = items.filter((i) => i.status === 'done');
  return done.length ? done[done.length - 1]! : null;
}
