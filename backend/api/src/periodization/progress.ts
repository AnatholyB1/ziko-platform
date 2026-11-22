// Phase 24 (v1.20) - ATEL-09 / D-04 : fin de programme. Module PUR (aucun I/O).
// Regle NEUTRE : la fin est calendaire (ou toutes les seances faites). Une seance manquee ne retarde ni
// ne penalise rien : le programme se termine a la date prevue quoi qu'il arrive.

const DAY_MS = 86400000;

export interface ProgramTiming {
  startedAt: string | null;
  createdAt: string;
  programData: unknown;
  daysPerWeek: number | null;
}

export type ProgressState = 'in_progress' | 'ended' | 'unknown';

export interface ProgressEvaluation {
  state: ProgressState;
  weeksCount: number | null;
  plannedSessions: number | null;
  doneSessions: number;
  startedAt: string;
  endsAt: string | null;
  reason: 'calendar' | 'all_sessions' | null;
}

/** Nombre de semaines : weeks[] prime, sinon weeks_count numerique ; null si inconnu (pas de cloture auto). */
export function weeksCountOf(programData: unknown): number | null {
  const pd = (programData ?? {}) as Record<string, unknown>;
  if (Array.isArray(pd.weeks) && pd.weeks.length > 0) return pd.weeks.length;
  const n = Number(pd.weeks_count);
  return Number.isFinite(n) && n >= 1 && n <= 52 ? Math.round(n) : null;
}

/** Seances par semaine : colonne days_per_week, sinon moyenne des seances des semaines, sinon null. */
export function sessionsPerWeekOf(daysPerWeek: number | null, programData: unknown): number | null {
  if (typeof daysPerWeek === 'number' && daysPerWeek >= 1) return Math.min(7, Math.round(daysPerWeek));
  const pd = (programData ?? {}) as Record<string, any>;
  if (Array.isArray(pd.weeks) && pd.weeks.length > 0) {
    const total = pd.weeks.reduce((n: number, w: any) => n + (Array.isArray(w?.sessions) ? w.sessions.length : 0), 0);
    return total > 0 ? Math.max(1, Math.round(total / pd.weeks.length)) : null;
  }
  return null;
}

/** Debut effectif : activation, sinon creation (programmes actifs avant la migration, D-03). */
export function effectiveStart(t: Pick<ProgramTiming, 'startedAt' | 'createdAt'>): Date {
  return new Date(t.startedAt ?? t.createdAt);
}

export function evaluateProgress(t: ProgramTiming, doneSessions: number, now: Date = new Date()): ProgressEvaluation {
  const start = effectiveStart(t);
  const weeks = weeksCountOf(t.programData);
  const perWeek = sessionsPerWeekOf(t.daysPerWeek, t.programData);
  const planned = weeks !== null && perWeek !== null ? weeks * perWeek : null;
  if (weeks === null || Number.isNaN(start.getTime())) {
    return {
      state: 'unknown',
      weeksCount: weeks,
      plannedSessions: planned,
      doneSessions,
      startedAt: Number.isNaN(start.getTime()) ? t.createdAt : start.toISOString(),
      endsAt: null,
      reason: null,
    };
  }
  const base = { weeksCount: weeks, plannedSessions: planned, doneSessions, startedAt: start.toISOString() };
  const endsAt = new Date(start.getTime() + weeks * 7 * DAY_MS);
  if (now.getTime() >= endsAt.getTime()) return { ...base, state: 'ended', endsAt: endsAt.toISOString(), reason: 'calendar' };
  if (planned !== null && doneSessions >= planned) {
    return { ...base, state: 'ended', endsAt: endsAt.toISOString(), reason: 'all_sessions' };
  }
  return { ...base, state: 'in_progress', endsAt: endsAt.toISOString(), reason: null };
}
