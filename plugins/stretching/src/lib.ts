// Phase 18 : logique pure du plugin Stretching (testable sans React Native).
// Dates : tout est en date LOCALE (cle 'YYYY-MM-DD'), jamais toISOString (UTC = decalage pres de minuit, G-05).

export type Zone = 'back' | 'legs' | 'shoulders' | 'hips';
export type Measure = 'duration' | 'reps';

export const ZONES: Zone[] = ['back', 'legs', 'shoulders', 'hips'];

export const ZONE_LABELS: Record<string, string> = {
  back: 'Dos',
  legs: 'Jambes',
  shoulders: 'Épaules',
  hips: 'Hanches',
  // anciennes valeurs libres des routines existantes (jsonb)
  chest: 'Pecs',
  quads: 'Jambes',
  hamstrings: 'Jambes',
  calves: 'Jambes',
  glutes: 'Hanches',
  hip_flexors: 'Hanches',
  arms: 'Bras',
  core: 'Abdos',
  full_body: 'Corps entier',
};

export const zoneLabel = (z: string | null | undefined): string => (z && ZONE_LABELS[z]) || 'Autre';

/** Ligne de la table ziko_stretching_exercises (catalogue user_id null, ou exercice perso). */
export interface LibraryExercise {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string;
  measure: Measure;
  duration_seconds: number | null;
  reps: number | null;
  sides: 1 | 2;
  instructions: string;
}

/** Exercice tel que stocke (instantane ordonne) dans ziko_stretching_routines.exercises (jsonb). */
export interface RoutineExercise {
  exercise_id?: string;
  name: string;
  muscle_group: string;
  measure: Measure;
  duration_seconds: number;
  reps: number;
  sides: 1 | 2;
  instructions: string;
}

export interface RoutineRow {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  is_default: boolean;
  duration_minutes?: number;
  muscle_groups?: string[];
  type?: string;
}

export interface LogRow {
  date: string; // 'YYYY-MM-DD'
  duration_sec: number | null;
  routine_name?: string | null;
}

// ─── Exercices ────────────────────────────────────────────────────────────────

const REPS_SECONDS = 3; // estimation d'une repetition pour la duree d'une routine

export function isPerso(e: Pick<LibraryExercise, 'user_id'>): boolean {
  return e.user_id != null;
}

/** Normalise un element jsonb (anciennes routines : duration_seconds seulement). */
export function normalizeRoutineExercise(raw: any): RoutineExercise {
  const measure: Measure = raw?.measure === 'reps' ? 'reps' : 'duration';
  const dur = Number(raw?.duration_seconds);
  const reps = Number(raw?.reps);
  return {
    exercise_id: typeof raw?.exercise_id === 'string' ? raw.exercise_id : undefined,
    name: String(raw?.name ?? ''),
    muscle_group: String(raw?.muscle_group ?? 'full_body'),
    measure,
    duration_seconds: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 30,
    reps: Number.isFinite(reps) && reps > 0 ? Math.round(reps) : 10,
    sides: raw?.sides === 2 ? 2 : 1,
    instructions: String(raw?.instructions ?? ''),
  };
}

export function normalizeRoutine(raw: any): RoutineRow {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    exercises: Array.isArray(raw.exercises) ? raw.exercises.map(normalizeRoutineExercise) : [],
    is_default: raw.is_default === true,
    duration_minutes: raw.duration_minutes ?? undefined,
    muscle_groups: Array.isArray(raw.muscle_groups) ? raw.muscle_groups : undefined,
    type: raw.type ?? undefined,
  };
}

export function exerciseFromLibrary(l: LibraryExercise): RoutineExercise {
  return {
    exercise_id: l.id,
    name: l.name,
    muscle_group: l.muscle_group,
    measure: l.measure,
    duration_seconds: l.duration_seconds ?? 30,
    reps: l.reps ?? 10,
    sides: l.sides,
    instructions: l.instructions ?? '',
  };
}

/** "45 s", "30 s par côté", "10 répétitions", "8 répétitions par côté". */
export function formatMeasure(e: Pick<RoutineExercise, 'measure' | 'duration_seconds' | 'reps' | 'sides'>): string {
  const base = e.measure === 'reps' ? `${e.reps} répétition${e.reps > 1 ? 's' : ''}` : `${e.duration_seconds} s`;
  return e.sides === 2 ? `${base} par côté` : base;
}

export function exerciseSeconds(e: Pick<RoutineExercise, 'measure' | 'duration_seconds' | 'reps' | 'sides'>): number {
  const one = e.measure === 'reps' ? e.reps * REPS_SECONDS : e.duration_seconds;
  return one * e.sides;
}

export function routineSeconds(list: RoutineExercise[]): number {
  return list.reduce((s, e) => s + exerciseSeconds(e), 0);
}

export function routineMinutes(list: RoutineExercise[]): number {
  const s = routineSeconds(list);
  return s === 0 ? 0 : Math.max(1, Math.round(s / 60));
}

/** "5 exercices · 6 min" */
export function routineSummary(list: RoutineExercise[]): string {
  const n = list.length;
  return `${n} exercice${n > 1 ? 's' : ''} · ${routineMinutes(list)} min`;
}

export function routineMuscleGroups(list: RoutineExercise[]): string[] {
  return Array.from(new Set(list.map((e) => e.muscle_group)));
}

// ─── Bibliotheque : filtres ───────────────────────────────────────────────────

export type LibraryFilter = 'all' | 'mine' | Zone;

export function filterLibrary(list: LibraryExercise[], filter: LibraryFilter): LibraryExercise[] {
  if (filter === 'all') return list;
  if (filter === 'mine') return list.filter(isPerso);
  return list.filter((e) => e.muscle_group === filter);
}

/** Compteurs des puces : le compteur de `all` = nombre de lignes affichees sous `Tous` (ST-1). */
export function filterCounts(list: LibraryExercise[]): Record<string, number> {
  const out: Record<string, number> = { all: list.length, mine: list.filter(isPerso).length };
  for (const z of ZONES) out[z] = list.filter((e) => e.muscle_group === z).length;
  return out;
}

export interface ExerciseDraft {
  name: string;
  zone: Zone | null;
  measure: Measure;
  duration_seconds: number;
  reps: number;
  sides: 1 | 2;
  instructions: string;
}

/** Message d'erreur de validation (null = valide). */
export function validateExerciseDraft(d: ExerciseDraft): string | null {
  if (!d.name.trim()) return 'Donne un nom à ton exercice';
  if (d.name.trim().length > 80) return 'Le nom est trop long (80 caractères maximum)';
  if (!d.zone) return 'Choisis une zone';
  if (d.measure === 'duration' && !(d.duration_seconds >= 5 && d.duration_seconds <= 600)) return 'La durée doit être entre 5 et 600 s';
  if (d.measure === 'reps' && !(d.reps >= 1 && d.reps <= 100)) return 'Le nombre de répétitions doit être entre 1 et 100';
  return null;
}

// ─── Routines ─────────────────────────────────────────────────────────────────

/** Deplace l'element `idx` de `dir` (-1 monter, +1 descendre) ; hors bornes = copie identique. */
export function moveItem<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const target = idx + dir;
  if (idx < 0 || idx >= arr.length || target < 0 || target >= arr.length) return arr.slice();
  const next = arr.slice();
  const tmp = next[idx];
  next[idx] = next[target];
  next[target] = tmp;
  return next;
}

/** Marque `id` par defaut et retire le defaut de toutes les autres : exactement 1 (ST-3). */
export function applyDefault<T extends { id: string; is_default: boolean }>(routines: T[], id: string): T[] {
  return routines.map((r) => ({ ...r, is_default: r.id === id }));
}

/** Retire le defaut partout (case decochee). */
export function clearDefault<T extends { is_default: boolean }>(routines: T[]): T[] {
  return routines.map((r) => ({ ...r, is_default: false }));
}

export function pickDefaultRoutine<T extends { is_default: boolean }>(routines: T[]): T | null {
  return routines.find((r) => r.is_default) ?? null;
}

/** Carte de debut de seance (STRE-06) : seulement avec une routine par defaut non vide et non passee. */
export function shouldShowDefaultCard(routine: { exercises: unknown[] } | null | undefined, skipped: boolean): boolean {
  return !!routine && routine.exercises.length > 0 && !skipped;
}

// ─── Dates locales ────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

/** Lundi (local) de la semaine contenant d. */
export function startOfWeek(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  return addDays(d, -dow);
}

// ─── Suivi ────────────────────────────────────────────────────────────────────

export interface StretchStats {
  weekSessions: number;
  weekMinutes: number;
  streak: number;
  last: LogRow | null;
  days: Set<string>;
}

/**
 * Serie = jours consecutifs (date locale) avec au moins un log, en remontant depuis aujourd'hui
 * (ou depuis hier si aujourd'hui n'a pas encore de seance : la serie n'est pas cassee avant la fin de la journee).
 */
export function computeStats(logs: LogRow[], now: Date = new Date()): StretchStats {
  const days = new Set(logs.map((l) => l.date));
  const weekStart = localDateKey(startOfWeek(now));
  const weekEnd = localDateKey(addDays(startOfWeek(now), 6));
  const week = logs.filter((l) => l.date >= weekStart && l.date <= weekEnd);
  const weekSeconds = week.reduce((s, l) => s + (l.duration_sec ?? 0), 0);

  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(localDateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const last = logs.length === 0
    ? null
    : logs.reduce((a, b) => (b.date >= a.date ? b : a));

  return {
    weekSessions: week.length,
    weekMinutes: Math.round(weekSeconds / 60),
    streak,
    last,
    days,
  };
}

export interface CalendarCell {
  key: string;
  day: number;
  inMonth: boolean;
  hasSession: boolean;
  isToday: boolean;
}

export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Grille du mois (semaines lundi-dimanche) ; les jours hors mois sont marques inMonth=false. */
export function buildMonthGrid(now: Date, sessionDays: Set<string>): CalendarCell[][] {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const todayKey = localDateKey(now);
  const weeks: CalendarCell[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= last) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = localDateKey(cursor);
      week.push({
        key,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === now.getMonth(),
        hasSession: sessionDays.has(key),
        isToday: key === todayKey,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** "12 novembre, séance réalisée" (accessibilite du calendrier). */
export function calendarCellLabel(c: CalendarCell): string {
  const d = parseDateKey(c.key);
  const base = `${d.getDate()} ${MONTH_NAMES[d.getMonth()].toLowerCase()}`;
  return c.hasSession ? `${base}, séance réalisée` : base;
}

export function lastSessionLabel(dateKey: string, now: Date = new Date()): string {
  const a = parseDateKey(dateKey);
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return `Il y a ${diff} j`;
}
