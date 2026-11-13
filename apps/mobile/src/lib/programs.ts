// Pure logic for the Programmes screen (phase 7, TRAIN-06..09). No React / native imports so it is
// unit-testable with vitest in node. Source of truth for "which program is active" is the DB
// (ziko_set_active_program keeps at most one active row across both tables); this module only
// normalizes rows for display and defends the "0 or 1 ACTIF badge" invariant (criterion A-1).

import { normalizePlanSessions } from './workoutPlan';

export type ProgramKind = 'workout' | 'ai';
/** ai = Atelier IA / outil IA ; coach = assigne par le coach ; created = cree par l'athlete. */
export type ProgramSource = 'ai' | 'coach' | 'created';
export type ProgramFilter = 'all' | 'ai' | 'coach' | 'created';
export type MenuAction = 'activate' | 'duplicate' | 'rename' | 'delete';

export type ProgramStatus = 'active' | 'paused' | 'completed' | 'not_started';

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  active: 'Actif',
  paused: 'En pause',
  completed: 'Terminé',
  not_started: 'Pas encore démarré',
};

/**
 * Statut visible sur chaque ligne de la liste (UAT run 6 : aucune etiquette). Actif = is_active ;
 * sinon Termine (completed_at), En pause (deja demarre : started_at, ou semaine de cycle > 1), sinon
 * Pas encore demarre. Un programme coach sans started_at est juge demarre des la semaine 2.
 */
export function deriveProgramStatus(
  row: { is_active?: unknown; completed_at?: unknown; started_at?: unknown },
  progress: { week: number } | null,
): ProgramStatus {
  if (row.is_active === true) return 'active';
  if (row.completed_at) return 'completed';
  if (row.started_at || (progress && progress.week > 1)) return 'paused';
  return 'not_started';
}

export interface ProgramItem {
  id: string;
  kind: ProgramKind;
  source: ProgramSource;
  name: string;
  /** Second line of the row, e.g. "Atelier IA · 6 séances par semaine". */
  subtitle: string;
  isActive: boolean;
  status: ProgramStatus;
  createdAt: string;
  daysPerWeek: number | null;
  /** Progress, only when the data really exists (workout programs with a cycle). */
  progress: { week: number; total: number; percent: number } | null;
}

export const PROGRAM_RULE_TEXT =
  "Un seul programme est actif à la fois. En activer un autre met l'actuel en pause.";

export const FILTER_LABELS: Record<ProgramFilter, string> = {
  all: 'Tous',
  ai: 'IA',
  coach: 'Coach',
  created: 'Créés',
};
export const FILTER_ORDER: ProgramFilter[] = ['all', 'ai', 'coach', 'created'];

type Row = Record<string, any>;

function sessionsPerWeekLabel(n: number | null): string {
  if (!n || n <= 0) return '';
  return `${n} séance${n > 1 ? 's' : ''} par semaine`;
}

function nameOf(row: Row, fallback: string): string {
  const raw = typeof row.name === 'string' ? row.name.trim() : '';
  return raw || fallback;
}

export function normalizeWorkoutRow(row: Row, userId: string): ProgramItem {
  const isCoach =
    (row.assigned_to_user_id != null && row.assigned_to_user_id === userId) ||
    (row.created_by_coach_id != null && row.created_by_coach_id !== userId);
  const source: ProgramSource = isCoach ? 'coach' : 'created';
  const days = Number.isFinite(Number(row.days_per_week)) ? Number(row.days_per_week) : null;
  const total = Number(row.weeks_count ?? row.cycle_weeks);
  const week = Number(row.current_cycle_week);
  const progress =
    Number.isFinite(total) && total > 0 && Number.isFinite(week) && week >= 1
      ? { week: Math.min(week, total), total, percent: Math.round((Math.min(week, total) / total) * 100) }
      : null;
  const parts = [isCoach ? 'Créé par ton coach' : 'Créé par moi', sessionsPerWeekLabel(days)].filter(Boolean);
  return {
    id: String(row.id),
    kind: 'workout',
    source,
    name: nameOf(row, 'Programme sans nom'),
    subtitle: parts.join(' · '),
    isActive: row.is_active === true,
    status: deriveProgramStatus(row, progress),
    createdAt: String(row.created_at ?? row.updated_at ?? ''),
    daysPerWeek: days,
    progress,
  };
}

export function normalizeAiRow(row: Row): ProgramItem {
  // Programs written by the 4-step wizard carry program_data.generated === true (created by the user).
  const fromWizard = row.program_data?.generated === true;
  const source: ProgramSource = fromWizard ? 'created' : 'ai';
  const days = Number.isFinite(Number(row.days_per_week)) ? Number(row.days_per_week) : null;
  const parts = [fromWizard ? 'Créé par moi' : 'Atelier IA', sessionsPerWeekLabel(days)].filter(Boolean);
  return {
    id: String(row.id),
    kind: 'ai',
    source,
    name: nameOf(row, 'Programme sans nom'),
    subtitle: parts.join(' · '),
    isActive: row.is_active === true,
    status: deriveProgramStatus(row, null),
    createdAt: String(row.created_at ?? ''),
    daysPerWeek: days,
    progress: null,
  };
}

/**
 * Merges both tables into one list: active first, then most recent. Defends the invariant
 * "0 or 1 active": if the DB ever returns several is_active rows (legacy duplicates before the
 * dedupe migration), only the most recent one keeps the ACTIF state.
 */
export function buildProgramList(workoutRows: Row[], aiRows: Row[], userId: string): ProgramItem[] {
  const items = [
    ...workoutRows.filter((r) => r.is_template !== true).map((r) => normalizeWorkoutRow(r, userId)),
    ...aiRows.map((r) => normalizeAiRow(r)),
  ];
  const actives = items.filter((i) => i.isActive).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const keep = actives[0]?.id;
  const out = items.map((i) => (i.isActive && i.id !== keep ? { ...i, isActive: false, status: i.status === 'active' ? 'paused' : i.status } : i));
  return out.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function filterPrograms(items: ProgramItem[], filter: ProgramFilter): ProgramItem[] {
  return filter === 'all' ? items : items.filter((i) => i.source === filter);
}

export function countByFilter(items: ProgramItem[]): Record<ProgramFilter, number> {
  return {
    all: items.length,
    ai: items.filter((i) => i.source === 'ai').length,
    coach: items.filter((i) => i.source === 'coach').length,
    created: items.filter((i) => i.source === 'created').length,
  };
}

export function countActive(items: ProgramItem[]): number {
  return items.filter((i) => i.isActive).length;
}

/**
 * Menu entries (A06/A07), in display order. An active program never offers activation (A-3).
 * A coach-assigned program can only be activated or duplicated (the athlete has no RLS right to
 * rename or delete it, decision D-08).
 */
export function menuActionsFor(item: ProgramItem): MenuAction[] {
  // A07 (inactive): Activer, Dupliquer, Supprimer. A06 (active): Dupliquer, Renommer, Supprimer.
  const actions: MenuAction[] = [];
  if (!item.isActive) actions.push('activate');
  actions.push('duplicate');
  if (item.source !== 'coach') {
    if (item.isActive) actions.push('rename');
    actions.push('delete');
  }
  return actions;
}

/** Activating a non-coach program while the coach's program is active needs the A08 confirmation. */
export function needsCoachConfirmation(items: ProgramItem[], target: ProgramItem): boolean {
  if (target.isActive || target.source === 'coach') return false;
  return items.some((i) => i.isActive && i.source === 'coach');
}

export function activeProgram(items: ProgramItem[]): ProgramItem | null {
  return items.find((i) => i.isActive) ?? null;
}

/** "X (copie)", then "X (copie 2)"... avoiding collisions with existing names. */
export function duplicateName(name: string, existing: string[]): string {
  const base = name.replace(/\s*\(copie(?: \d+)?\)\s*$/, '').trim() || 'Programme';
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  let candidate = `${base} (copie)`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} (copie ${n})`;
    n += 1;
  }
  return candidate;
}

export function validateProgramName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Donne un nom à ton programme.' };
  if (name.length > 80) return { ok: false, error: 'Le nom est trop long (80 caractères maximum).' };
  return { ok: true, name };
}

export function deleteConfirmationText(name: string): string {
  return `Supprimer '${name}' ? Cette action est définitive.`;
}

export function activationToast(name: string): string {
  return `Programme actif : ${name}`;
}

// ── Wizard (4 steps) output, TRAIN-09 ──────────────────────────────────────────

export const WIZARD_GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Perte de poids',
  strength: 'Force',
  endurance: 'Endurance',
  body_comp: 'Composition',
  wellness: 'Bien-être',
};

export interface WizardInput {
  goal: string;
  weeks: number;
  /** 0 = Monday ... 6 = Sunday (index of the day buttons). */
  selectedDays: number[];
  exercises: string[];
}

/**
 * Row inserted into ziko_ai_generated_programs by the wizard. Fixes D-10: the previous insert
 * omitted the NOT NULL columns name / split_type / days_per_week, so it failed and the created
 * sessions never existed. Also writes program_data in the shape workoutPlan understands
 * (weeks[].sessions with a distinct ISO day_of_week per session) so P6 can start the session.
 */
export function buildWizardProgramRow(userId: string, input: WizardInput) {
  const days = [...new Set(input.selectedDays)].sort((a, b) => a - b);
  const perSession = input.exercises.map((name) => ({ name, sets: 3, reps: 10 }));
  const sessions = days.map((d, i) => ({
    name: `Séance ${i + 1}`,
    day_of_week: d + 1,
    exercises: perSession,
  }));
  const weeksCount = Math.max(1, Math.round(input.weeks));
  const goalLabel = WIZARD_GOAL_LABELS[input.goal] ?? input.goal;
  return {
    user_id: userId,
    name: `${goalLabel} · ${days.length} séance${days.length > 1 ? 's' : ''}/sem`,
    goal: input.goal,
    split_type: 'custom',
    days_per_week: Math.min(7, Math.max(1, days.length)),
    is_active: false,
    program_data: {
      generated: true,
      weeks_count: weeksCount,
      weeks: Array.from({ length: weeksCount }, (_, i) => ({ w: i + 1, sessions })),
      days,
      exercises: input.exercises,
    },
  };
}

export interface WizardSessionSummary {
  name: string;
  exerciseCount: number;
  dayIndex: number;
}

/** Sessions listed on the end-of-wizard screen (A09). */
export function wizardSessionSummaries(programData: unknown): WizardSessionSummary[] {
  return normalizePlanSessions(programData).map((s) => ({
    name: s.name,
    exerciseCount: s.exercises.length,
    dayIndex: s.dayIndex,
  }));
}

export const DAY_NAMES_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
