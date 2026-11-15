// Pure logic for the planned-session flow (phase 6, TRAIN-01..05).
// No React / native imports so it is unit-testable with vitest in node.
//
// Day convention used everywhere in this module: dayIndex 0 = Monday ... 6 = Sunday.

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string | number | null;
  exercise_id?: string | null;
  rest_seconds?: number | null;
}

export interface PlanSession {
  name: string;
  focus?: string;
  exercises: PlanExercise[];
  /** Resolved weekday, 0 = Monday ... 6 = Sunday. */
  dayIndex: number;
  /** Position of the session in the source array (stable id for the planned session). */
  sourceIndex: number;
}

type RawSession = Record<string, any>;

/** JS Date#getDay() (0 = Sunday) -> Monday-first index (0 = Monday). */
export function jsDayToIndex(jsDay: number): number {
  return (((jsDay + 6) % 7) + 7) % 7;
}

/** Postgres/ISO style 1 = Monday ... 7 = Sunday -> index. */
export function isoDayToIndex(isoDay: number): number {
  return (((isoDay - 1) % 7) + 7) % 7;
}

/** Evenly spread layouts when a program carries no usable weekday information. */
const DEFAULT_LAYOUTS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function defaultDayLayout(count: number): number[] {
  if (count <= 0) return [];
  if (DEFAULT_LAYOUTS[count]) return DEFAULT_LAYOUTS[count];
  return Array.from({ length: Math.min(count, 7) }, (_, i) => i);
}

/** Finds the session array inside the (loosely typed) JSONB `program_data`. */
export function extractRawSessions(programData: any, weekNumber = 1): RawSession[] {
  if (!programData || typeof programData !== 'object') return [];
  if (Array.isArray(programData.weeks) && programData.weeks.length > 0) {
    const weeks: any[] = programData.weeks;
    const week =
      weeks.find((w) => (w?.w ?? w?.week_number) === weekNumber) ?? weeks[weekNumber - 1] ?? weeks[0];
    if (Array.isArray(week?.sessions)) return week.sessions;
  }
  for (const key of ['sessions', 'workouts', 'days']) {
    if (Array.isArray(programData[key])) return programData[key];
  }
  return [];
}

/**
 * Base of `day_index` (0 = Monday-first / 1 = ISO Monday=1). Explicit convention first:
 * `program_data.day_index_base` (0 | 1). Without it nothing is guessed from the *shape* of the
 * data except the one unambiguous case: a literal 0 can only exist in a 0-based program.
 * Otherwise the repo-wide convention applies (ISO, 1 = Monday, same as `day_of_week`).
 * Writers that emit `day_index` should set `day_index_base` (review A #9).
 */
export function resolveDayIndexBase(programData: any, raws: RawSession[]): 0 | 1 {
  const declared = programData?.day_index_base;
  if (declared === 0 || declared === 1) return declared;
  return raws.some((r) => r?.day_index === 0) ? 0 : 1;
}

/** Reads an explicit weekday from a raw session, returns null when absent/invalid. */
export function readExplicitDayIndex(raw: RawSession, indexBasedZero: boolean): number | null {
  if (typeof raw.day_index === 'number' && Number.isFinite(raw.day_index)) {
    // day_index is 0-based (0 = Monday) when the program uses 0, otherwise 1-based.
    const v = raw.day_index;
    if (v < 0 || v > 7) return null;
    return indexBasedZero ? v % 7 : isoDayToIndex(v);
  }
  const iso = raw.day_of_week ?? raw.day;
  if (typeof iso === 'number' && Number.isFinite(iso)) {
    if (iso === 0) return 6; // 0 = Sunday (JS convention)
    if (iso >= 1 && iso <= 7) return isoDayToIndex(iso);
  }
  return null;
}

function normalizeExercises(raw: RawSession): PlanExercise[] {
  const list: any[] = raw.exercises ?? raw.sets ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e === 'object' && typeof e.name === 'string' && e.name.trim() !== '')
    .map((e) => ({
      name: String(e.name).trim(),
      sets: Number.isFinite(Number(e.sets)) && Number(e.sets) > 0 ? Math.round(Number(e.sets)) : 3,
      reps: e.reps ?? null,
      exercise_id: typeof e.exercise_id === 'string' && e.exercise_id ? e.exercise_id : null,
      rest_seconds:
        Number.isFinite(Number(e.rest_seconds ?? e.rest_sec ?? e.rest)) &&
        Number(e.rest_seconds ?? e.rest_sec ?? e.rest) > 0
          ? Math.round(Number(e.rest_seconds ?? e.rest_sec ?? e.rest))
          : null,
    }));
}

/**
 * Normalizes program_data (several shapes exist in prod: weeks[].sessions, sessions, workouts,
 * days) into sessions with a resolved weekday. Explicit weekdays are honoured only when they
 * are distinct (the import path defaults every session to day 1, which would stack them all on
 * Monday); otherwise sessions are spread over the week by frequency (3 -> Mon/Wed/Fri...).
 */
export function normalizePlanSessions(programData: any, weekNumber = 1): PlanSession[] {
  const raws = extractRawSessions(programData, weekNumber);
  if (raws.length === 0) return [];

  const hasZeroIndex = resolveDayIndexBase(programData, raws) === 0;
  const explicit = raws.map((r) => readExplicitDayIndex(r ?? {}, hasZeroIndex));
  const allExplicit = explicit.every((d) => d !== null);
  const distinct = new Set(explicit).size === explicit.length;
  const useExplicit = allExplicit && distinct;
  const layout = defaultDayLayout(raws.length);

  return raws.map((r, i) => ({
    name: String(r?.name ?? r?.title ?? `Séance ${i + 1}`),
    focus: typeof r?.focus === 'string' ? r.focus : undefined,
    exercises: normalizeExercises(r ?? {}),
    dayIndex: useExplicit ? (explicit[i] as number) : layout[i] ?? i % 7,
    sourceIndex: i,
  }));
}

/** 7 slots Monday..Sunday; null = real rest day. */
export function buildWeekLayout(sessions: PlanSession[]): Array<PlanSession | null> {
  const slots: Array<PlanSession | null> = Array(7).fill(null);
  for (const s of sessions) {
    if (slots[s.dayIndex] === null) slots[s.dayIndex] = s;
    else {
      // collision safety: put it on the next free day rather than dropping it
      for (let k = 1; k < 7; k++) {
        const idx = (s.dayIndex + k) % 7;
        if (slots[idx] === null) {
          slots[idx] = s;
          break;
        }
      }
    }
  }
  return slots;
}

/**
 * The session to start "today": the one planned for today's weekday, otherwise the next
 * upcoming one (wrapping), so the button never opens an empty quick session.
 */
export function pickSessionForToday(
  sessions: PlanSession[],
  todayIndex: number,
): { session: PlanSession; isToday: boolean } | null {
  if (sessions.length === 0) return null;
  const slots = buildWeekLayout(sessions);
  for (let k = 0; k < 7; k++) {
    const s = slots[(todayIndex + k) % 7];
    if (s) return { session: s, isToday: k === 0 };
  }
  return null;
}

/** "8-12" | "10" | 10 | null -> program_exercises-style rep fields. */
export function parseReps(reps: string | number | null | undefined): {
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
} {
  if (typeof reps === 'number' && Number.isFinite(reps)) {
    return { reps: Math.round(reps), reps_min: null, reps_max: null };
  }
  if (typeof reps === 'string') {
    const range = reps.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      return { reps: null, reps_min: Math.min(a, b), reps_max: Math.max(a, b) };
    }
    const single = reps.match(/(\d+)/);
    if (single) return { reps: parseInt(single[1], 10), reps_min: null, reps_max: null };
  }
  return { reps: null, reps_min: null, reps_max: null };
}

// ── TRAIN-03: empty sessions are neither stored nor counted ──────────────────────

export interface CountableSessionLike {
  total_sets?: number | null;
  total_volume_kg?: number | null;
  ended_at?: string | null;
}

/**
 * A session counts if at least one set was validated (total_sets > 0, or legacy volume > 0),
 * OR it is a legacy FINISHED session that never got totals (total_sets NULL + ended_at set).
 * An explicit total_sets = 0 (written at the end of an empty session) is not counted, and neither
 * is a session still open / killed mid-way (total_sets NULL, no ended_at).
 */
export function isCountableSession(s: CountableSessionLike): boolean {
  if ((s.total_sets ?? 0) > 0 || (s.total_volume_kg ?? 0) > 0) return true;
  return s.total_sets == null && !!s.ended_at;
}

/** PostgREST `.or()` twin of isCountableSession (same predicate, evaluated server side). */
export const COUNTABLE_SESSION_OR_FILTER =
  'total_sets.gt.0,total_volume_kg.gt.0,and(total_sets.is.null,ended_at.not.is.null)';

export function filterCountableSessions<T extends CountableSessionLike>(sessions: T[]): T[] {
  return sessions.filter(isCountableSession);
}

/** Write guard: a finished/abandoned session with no validated set must not be persisted. */
export function shouldPersistSession(completedSetsCount: number): boolean {
  return completedSetsCount > 0;
}

/** Nom par defaut d'une seance sans programme (remplace l'ancien 'Quick Workout' anglais). */
export const DEFAULT_SESSION_NAME = 'Séance libre';

/**
 * Nom affichable d'une seance : un nom de jour de programme trop court / peu parlant ("A", "B", "1") est
 * prefixe du nom du programme quand il existe ; sinon 'Séance libre'.
 */
export function resolveSessionName(raw: string | null | undefined, programName?: string | null): string {
  const name = (raw ?? '').trim();
  const prog = (programName ?? '').trim();
  if (name.length >= 3) return name;
  if (name && prog) return `${prog} · ${name}`;
  if (prog) return prog;
  return DEFAULT_SESSION_NAME;
}
