// Supabase access for the Programmes screen (phase 7). The client is injected so the module is
// unit-testable with a mock. All writes of `is_active` go through the ziko_set_active_program RPC
// (migration 202612010703) : no client-side "deactivate all then activate one" any more.

import {
  buildProgramList,
  duplicateName,
  menuActionsFor,
  needsCoachConfirmation,
  validateProgramName,
  type ProgramItem,
  type ProgramKind,
} from './programs';

type Client = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

function fail(error: { message?: string } | null | undefined, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export async function loadAllPrograms(client: Client, userId: string): Promise<ProgramItem[]> {
  const [w, a] = await Promise.all([
    client
      .from('ziko_workout_programs')
      .select('id,user_id,name,days_per_week,is_active,created_at,updated_at,created_by_coach_id,assigned_to_user_id,is_template,current_cycle_week,cycle_weeks,weeks_count')
      .or(`user_id.eq.${userId},assigned_to_user_id.eq.${userId}`)
      .eq('is_template', false),
    client
      .from('ziko_ai_generated_programs')
      .select('id,user_id,name,goal,days_per_week,is_active,created_at,program_data')
      .eq('user_id', userId),
  ]);
  // Never fall back to a fake program on error (A05).
  if (w.error) fail(w.error, 'Impossible de charger tes programmes');
  if (a.error) fail(a.error, 'Impossible de charger tes programmes');
  return buildProgramList((w.data ?? []) as any[], (a.data ?? []) as any[], userId);
}

/**
 * For entry points other than the Programmes screen (program detail, AI programs tab): returns the
 * name of the active COACH program that activating the target would replace, or null when no A08
 * confirmation is needed. Never throws: on a load error returns null (the RPC stays the guard).
 */
export async function coachProgramReplacedBy(
  client: Client,
  userId: string,
  kind: ProgramKind,
  programId: string,
): Promise<string | null> {
  try {
    const items = await loadAllPrograms(client, userId);
    const target = items.find((i) => i.kind === kind && i.id === programId);
    if (!target || !needsCoachConfirmation(items, target)) return null;
    return items.find((i) => i.isActive && i.source === 'coach')?.name ?? null;
  } catch {
    return null;
  }
}

export async function setActiveProgram(client: Client, kind: ProgramKind, programId: string): Promise<void> {
  const { error } = await client.rpc('ziko_set_active_program', { p_kind: kind, p_program_id: programId });
  if (error) fail(error, "Impossible d'activer ce programme");
}

export async function renameProgram(client: Client, item: ProgramItem, rawName: string): Promise<string> {
  if (!menuActionsFor(item).includes('rename')) throw new Error('Ce programme ne peut pas être renommé.');
  const v = validateProgramName(rawName);
  if (!v.ok) throw new Error(v.error);
  const table = item.kind === 'workout' ? 'ziko_workout_programs' : 'ziko_ai_generated_programs';
  const { error } = await client.from(table).update({ name: v.name }).eq('id', item.id);
  if (error) fail(error, 'Impossible de renommer ce programme');
  return v.name;
}

export async function deleteProgram(client: Client, item: ProgramItem): Promise<void> {
  if (!menuActionsFor(item).includes('delete')) throw new Error('Ce programme ne peut pas être supprimé.');
  const table = item.kind === 'workout' ? 'ziko_workout_programs' : 'ziko_ai_generated_programs';
  // No auto-activation of another program afterwards (D-09).
  const { error } = await client.from(table).delete().eq('id', item.id);
  if (error) fail(error, 'Impossible de supprimer ce programme');
}

/** Copy is always personal (user_id = me, no coach fields) and INACTIVE (D-08, D-09). */
export async function duplicateProgram(
  client: Client,
  userId: string,
  item: ProgramItem,
  existingNames: string[],
): Promise<ProgramItem> {
  const name = duplicateName(item.name, existingNames);

  if (item.kind === 'ai') {
    const { data: src, error: e1 } = await client
      .from('ziko_ai_generated_programs')
      .select('goal,split_type,days_per_week,experience,equipment,program_data')
      .eq('id', item.id)
      .single();
    if (e1 || !src) fail(e1, 'Programme introuvable');
    const { data: ins, error: e2 } = await client
      .from('ziko_ai_generated_programs')
      .insert({ ...src, user_id: userId, name, is_active: false })
      .select('id,user_id,name,goal,days_per_week,is_active,created_at,program_data')
      .single();
    if (e2 || !ins) fail(e2, 'Impossible de dupliquer ce programme');
    return { ...item, id: String(ins.id), name, isActive: false, source: item.source === 'ai' ? 'ai' : 'created' };
  }

  const { data: src, error: e1 } = await client
    .from('ziko_workout_programs')
    .select('*, program_workouts:ziko_program_workouts(*, program_exercises:ziko_program_exercises(*))')
    .eq('id', item.id)
    .single();
  if (e1 || !src) fail(e1, 'Programme introuvable');

  const { data: created, error: e2 } = await client
    .from('ziko_workout_programs')
    .insert({
      user_id: userId,
      name,
      description: src.description ?? null,
      days_per_week: src.days_per_week ?? null,
      cycle_weeks: src.cycle_weeks ?? null,
      progression_type: src.progression_type ?? null,
      progression_value: src.progression_value ?? null,
      weeks_data: src.weeks_data ?? null,
      goal: src.goal ?? null,
      weeks_count: src.weeks_count ?? null,
      is_active: false,
      is_template: false,
    })
    .select('id')
    .single();
  if (e2 || !created) fail(e2, 'Impossible de dupliquer ce programme');

  try {
    for (const w of (src.program_workouts ?? []) as any[]) {
      const { data: nw, error: e3 } = await client
        .from('ziko_program_workouts')
        .insert({ program_id: created.id, name: w.name, day_of_week: w.day_of_week ?? null, order_index: w.order_index ?? 0 })
        .select('id')
        .single();
      if (e3 || !nw) fail(e3, 'Impossible de copier les séances');
      const exos = ((w.program_exercises ?? []) as any[]).map((x) => ({
        workout_id: nw.id,
        exercise_id: x.exercise_id,
        sets: x.sets,
        reps: x.reps,
        rest_seconds: x.rest_seconds,
        notes: x.notes,
        order_index: x.order_index ?? 0,
        reps_min: x.reps_min,
        reps_max: x.reps_max,
        duration_seconds: x.duration_seconds,
        duration_min: x.duration_min,
        duration_max: x.duration_max,
        weight_kg: x.weight_kg,
      }));
      if (exos.length > 0) {
        const { error: e4 } = await client.from('ziko_program_exercises').insert(exos);
        if (e4) fail(e4, 'Impossible de copier les exercices');
      }
    }
  } catch (err) {
    // No half-copied program left behind (child rows cascade).
    await client.from('ziko_workout_programs').delete().eq('id', created.id);
    throw err;
  }

  return { ...item, id: String(created.id), name, isActive: false, source: 'created', kind: 'workout', progress: null };
}
