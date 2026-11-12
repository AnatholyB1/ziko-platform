// Phase 18 : acces donnees Supabase du plugin Stretching (client injecte, testable avec un faux client).
import {
  normalizeRoutine, localDateKey, routineSeconds, routineMinutes, routineMuscleGroups,
  type LibraryExercise, type LogRow, type RoutineExercise, type RoutineRow, type ExerciseDraft,
} from './lib';

export function generateId(): string {
  return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function fail(error: any, fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

// ─── Bibliotheque ─────────────────────────────────────────────────────────────

export async function fetchLibrary(supabase: any): Promise<LibraryExercise[]> {
  const { data, error } = await supabase
    .from('ziko_stretching_exercises')
    .select('id, user_id, name, muscle_group, measure, duration_seconds, reps, sides, instructions')
    .order('name', { ascending: true });
  if (error) fail(error, 'Impossible de charger la bibliothèque');
  return (data ?? []) as LibraryExercise[];
}

export async function createExercise(supabase: any, userId: string, d: ExerciseDraft): Promise<LibraryExercise> {
  const row = {
    user_id: userId,
    name: d.name.trim(),
    muscle_group: d.zone,
    measure: d.measure,
    duration_seconds: d.measure === 'duration' ? d.duration_seconds : null,
    reps: d.measure === 'reps' ? d.reps : null,
    sides: d.sides,
    instructions: d.instructions.trim(),
  };
  const { data, error } = await supabase.from('ziko_stretching_exercises').insert(row).select().single();
  if (error) fail(error, "Impossible d'enregistrer l'exercice");
  return data as LibraryExercise;
}

// ─── Routines ─────────────────────────────────────────────────────────────────

export async function fetchRoutines(supabase: any, userId: string): Promise<RoutineRow[]> {
  const { data, error } = await supabase
    .from('ziko_stretching_routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Impossible de charger les routines');
  return (data ?? []).map(normalizeRoutine);
}

export async function fetchRoutine(supabase: any, userId: string, id: string): Promise<RoutineRow | null> {
  const { data, error } = await supabase
    .from('ziko_stretching_routines')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) fail(error, 'Impossible de charger la routine');
  return data ? normalizeRoutine(data) : null;
}

/** Routine par defaut de l'athlete (null si aucune : alors aucune carte en debut de seance, ST-4). */
export async function fetchDefaultRoutine(supabase: any, userId: string): Promise<RoutineRow | null> {
  const { data, error } = await supabase
    .from('ziko_stretching_routines')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .limit(1);
  if (error) fail(error, 'Impossible de charger la routine par défaut');
  const row = (data ?? [])[0];
  return row ? normalizeRoutine(row) : null;
}

export interface RoutineInput {
  id?: string;
  name: string;
  exercises: RoutineExercise[];
  is_default: boolean;
}

/**
 * Cree ou met a jour une routine. Si `is_default`, retire d'abord le defaut des autres routines
 * (l'index unique partiel garantit 1 seul defaut) ; en cas d'echec de l'ecriture, restaure l'ancien defaut.
 */
export async function saveRoutine(supabase: any, userId: string, input: RoutineInput): Promise<string> {
  const id = input.id ?? generateId();
  const payload = {
    name: input.name.trim(),
    type: 'custom',
    muscle_groups: routineMuscleGroups(input.exercises),
    duration_minutes: routineMinutes(input.exercises),
    exercises: input.exercises,
    is_default: input.is_default,
  };

  let previousDefaultIds: string[] = [];
  if (input.is_default) {
    const { data: prev, error: e0 } = await supabase
      .from('ziko_stretching_routines')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .neq('id', id);
    if (e0) fail(e0, 'Impossible de vérifier la routine par défaut');
    previousDefaultIds = (prev ?? []).map((r: any) => r.id);
    if (previousDefaultIds.length > 0) {
      const { error: e1 } = await supabase
        .from('ziko_stretching_routines')
        .update({ is_default: false })
        .eq('user_id', userId)
        .in('id', previousDefaultIds);
      if (e1) fail(e1, 'Impossible de retirer l\'ancienne routine par défaut');
    }
  }

  const write = input.id
    ? await supabase.from('ziko_stretching_routines').update(payload).eq('id', id).eq('user_id', userId)
    : await supabase.from('ziko_stretching_routines').insert({ id, user_id: userId, ...payload });

  if (write.error) {
    if (previousDefaultIds.length > 0) {
      await supabase
        .from('ziko_stretching_routines')
        .update({ is_default: true })
        .eq('user_id', userId)
        .in('id', previousDefaultIds);
    }
    fail(write.error, 'Impossible de sauvegarder la routine');
  }
  return id;
}

export async function deleteRoutine(supabase: any, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('ziko_stretching_routines').delete().eq('id', id).eq('user_id', userId);
  if (error) fail(error, 'Impossible de supprimer la routine');
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export async function fetchLogs(supabase: any, userId: string, now: Date = new Date()): Promise<LogRow[]> {
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 400);
  const { data, error } = await supabase
    .from('ziko_stretching_logs')
    .select('id, date, duration_sec, routine_name')
    .eq('user_id', userId)
    .gte('date', localDateKey(since))
    .order('date', { ascending: false })
    .limit(2000);
  if (error) fail(error, 'Impossible de charger le suivi');
  return (data ?? []) as LogRow[];
}

/**
 * Ecrit le log d'une routine terminee. Ne touche jamais aux tables de seance d'entrainement :
 * un log de stretching ne compte pas comme serie validee (G-04).
 */
export async function insertLog(
  supabase: any,
  userId: string,
  routine: { id: string; name: string; exercises: RoutineExercise[] },
  now: Date = new Date(),
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ziko_stretching_logs')
    .insert({
      user_id: userId,
      routine_id: routine.id,
      routine_name: routine.name,
      duration_sec: routineSeconds(routine.exercises),
      exercises: routine.exercises.map((e) => ({ name: e.name, muscle_group: e.muscle_group })),
      date: localDateKey(now),
    })
    .select('id')
    .single();
  if (error) fail(error, 'Impossible d\'enregistrer la séance');
  return (data as any)?.id ?? null;
}
