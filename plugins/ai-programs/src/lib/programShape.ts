// Pure helpers reading the loosely typed `program_data` JSONB of ai_generated_programs.
// UAT run2 P7: `weeks` can be a number, an array of `{ w, sessions }` or an object; rendering the raw
// value crashed with "Objects are not valid as a React child". Mirrors the shapes accepted by
// apps/mobile/src/lib/workoutPlan.ts (extractRawSessions).

const DEFAULT_WEEKS = 8;
const DEFAULT_SESSIONS_PER_WEEK = 3;

function positiveInt(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

/** Number of weeks of a program, whatever the shape of `program_data.weeks`. */
export function getProgramWeekCount(programData: any): number {
  if (!programData || typeof programData !== 'object') return DEFAULT_WEEKS;
  const weeks = programData.weeks;
  if (Array.isArray(weeks)) return weeks.length > 0 ? weeks.length : DEFAULT_WEEKS;
  const direct = positiveInt(weeks);
  if (direct !== null) return direct;
  if (weeks && typeof weeks === 'object') {
    for (const key of ['count', 'total', 'length', 'duration_weeks']) {
      const n = positiveInt((weeks as any)[key]);
      if (n !== null) return n;
    }
    const keys = Object.keys(weeks);
    if (keys.length > 0) return keys.length;
  }
  return positiveInt(programData.duration_weeks) ?? DEFAULT_WEEKS;
}

/** Sessions per week (first week for `weeks[]` programs). */
export function getProgramSessionsPerWeek(programData: any): number {
  if (!programData || typeof programData !== 'object') return DEFAULT_SESSIONS_PER_WEEK;
  const weeks = programData.weeks;
  if (Array.isArray(weeks) && Array.isArray(weeks[0]?.sessions) && weeks[0].sessions.length > 0) {
    return weeks[0].sessions.length;
  }
  if (Array.isArray(programData.sessions) && programData.sessions.length > 0) {
    return programData.sessions.length;
  }
  return (
    positiveInt(programData.sessions_per_week) ??
    positiveInt(programData.sessions) ??
    DEFAULT_SESSIONS_PER_WEEK
  );
}

/** Flat list of sessions for the progress ring (weeks[].sessions or sessions[]). */
export function getProgramSessionList(programData: any): any[] {
  if (!programData || typeof programData !== 'object') return [];
  if (Array.isArray(programData.weeks)) {
    const flat = programData.weeks.flatMap((w: any) => (Array.isArray(w?.sessions) ? w.sessions : []));
    if (flat.length > 0) return flat;
  }
  return Array.isArray(programData.sessions) ? programData.sessions : [];
}
