// ARCH-03: per-request JWT client — no admin keys (SUPABASE_PUBLISHABLE_KEY only)
import { createClient } from '@supabase/supabase-js';
import type {
  CreateProgramBody,
  UpdateProgramBody,
  CreateFolderBody,
  CreateExerciseBody,
} from './types.js';

export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}

// ----- GET / — list coach's templates + seed templates (PROG-01, PROG-08) -----
export async function listPrograms(
  jwt: string,
  coachId: string,
): Promise<{ programs: any[] }> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('workout_programs')
    .select('id, name, description, goal, weeks_count, folder_id, is_template, created_by_coach_id, created_at, updated_at')
    .or(`and(created_by_coach_id.eq.${coachId},is_template.eq.true),and(is_template.eq.true,created_by_coach_id.is.null)`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return { programs: data ?? [] };
}

// ----- POST / — create a new template (PROG-01) -----
export async function createProgram(
  jwt: string,
  coachId: string,
  body: CreateProgramBody,
): Promise<any> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('workout_programs')
    .insert({
      user_id: coachId,
      name: body.name,
      description: body.description ?? null,
      goal: body.goal ?? null,
      weeks_count: body.weeks_count,
      folder_id: body.folder_id ?? null,
      is_template: true,
      created_by_coach_id: coachId,
      weeks_data: body.weeks_data ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ----- GET /:id — single program (RLS handles visibility) -----
export async function getProgram(
  jwt: string,
  _coachId: string,
  id: string,
): Promise<any | null> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('workout_programs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

// ----- PUT /:id — update a program (coach can only edit their own) -----
export async function updateProgram(
  jwt: string,
  coachId: string,
  id: string,
  body: UpdateProgramBody,
): Promise<any> {
  const db = createUserClient(jwt);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.goal !== undefined) updates.goal = body.goal;
  if (body.weeks_count !== undefined) updates.weeks_count = body.weeks_count;
  if (body.folder_id !== undefined) updates.folder_id = body.folder_id;
  if (body.weeks_data !== undefined) updates.weeks_data = body.weeks_data;

  const { data, error } = await db
    .from('workout_programs')
    .update(updates)
    .eq('id', id)
    .eq('created_by_coach_id', coachId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ----- DELETE /:id — delete own template (PROG-05) -----
export async function deleteProgram(
  jwt: string,
  coachId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('workout_programs')
    .delete()
    .eq('id', id)
    .eq('created_by_coach_id', coachId)
    .eq('is_template', true)
    .select('id');
  if (error) throw new Error(error.message);
  return { deleted: (data ?? []).length > 0 };
}

// ----- POST /:id/assign — fork template per client (T-27-04-01) -----
// RLS on INSERT enforces is_coach_of() for assigned_to_user_id.
// WHERE created_by_coach_id=coachId on the SELECT prevents forking others' templates.
export async function assignProgram(
  jwt: string,
  coachId: string,
  templateId: string,
  clientIds: string[],
): Promise<{ assigned: number }> {
  const db = createUserClient(jwt);

  // Fetch template — WHERE created_by_coach_id=coachId guards IDOR (T-27-04-01)
  const { data: template, error: fetchErr } = await db
    .from('workout_programs')
    .select('name, description, goal, weeks_count, weeks_data')
    .eq('id', templateId)
    .eq('created_by_coach_id', coachId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!template) throw new Error('Template not found or not owned by coach');

  const today = new Date().toISOString().split('T')[0]; // CURRENT_DATE

  await Promise.all(
    clientIds.map((clientId) =>
      db
        .from('workout_programs')
        .insert({
          user_id: coachId,
          created_by_coach_id: coachId,
          assigned_to_user_id: clientId,
          template_source_id: templateId,
          is_template: false,
          name: template.name,
          description: template.description,
          goal: template.goal,
          weeks_count: template.weeks_count,
          weeks_data: template.weeks_data,
          start_date: today,
        }),
    ),
  );

  return { assigned: clientIds.length };
}

// ----- POST /:id/duplicate — copy template with ' (copie)' suffix (PROG-04) -----
export async function duplicateProgram(
  jwt: string,
  coachId: string,
  id: string,
): Promise<any> {
  const db = createUserClient(jwt);

  const { data: original, error: fetchErr } = await db
    .from('workout_programs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!original) throw new Error('Program not found');

  const { data, error } = await db
    .from('workout_programs')
    .insert({
      user_id: coachId,
      name: `${original.name} (copie)`,
      description: original.description,
      goal: original.goal,
      weeks_count: original.weeks_count,
      folder_id: original.folder_id,
      is_template: true,
      created_by_coach_id: coachId,
      weeks_data: original.weeks_data ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ----- GET /folders — list coach's folders -----
export async function listFolders(
  jwt: string,
  coachId: string,
): Promise<{ folders: any[] }> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_program_folders')
    .select('*')
    .eq('coach_id', coachId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return { folders: data ?? [] };
}

// ----- POST /folders — create a new folder -----
export async function createFolder(
  jwt: string,
  coachId: string,
  body: CreateFolderBody,
): Promise<any> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_program_folders')
    .insert({ coach_id: coachId, name: body.name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ----- GET /exercises?q= — search exercises (PROG-08, read_exercises RLS) -----
// RLS read_exercises policy limits results to public (is_custom=FALSE) + own (user_id=auth.uid()).
// Supabase JS client doesn't support raw CASE ordering, so we fetch both groups and sort in JS.
export async function searchExercises(
  jwt: string,
  query: string,
): Promise<{ exercises: any[] }> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('exercises')
    .select('id, name, category, muscle_groups')
    .ilike('name', `%${query}%`)
    .limit(10);
  if (error) throw new Error(error.message);

  // Sort: prefix matches first (name starts with query), then alphabetically
  const lower = query.toLowerCase();
  const sorted = (data ?? []).sort((a: any, b: any) => {
    const aPrefix = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.name.localeCompare(b.name);
  });

  return { exercises: sorted };
}

// ----- POST /exercises — create user-defined exercise -----
export async function createExercise(
  jwt: string,
  body: CreateExerciseBody,
): Promise<any> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('exercises')
    .insert({
      name: body.name,
      category: body.category ?? null,
      is_user_defined: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
