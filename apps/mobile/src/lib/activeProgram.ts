import { normalizePlanSessions } from './workoutPlan';

// Programme ACTIF de l'athlete, quelle que soit sa table (run5 : l'accueil affichait "Aucun programme actif"
// alors que le programme COACH etait actif). P7 garantit 0 ou 1 programme actif sur l'ensemble :
//   - ziko_ai_generated_programs (IA / atelier) : seances dans `program_data` ;
//   - ziko_workout_programs (coach / manuel)    : seances dans ziko_program_workouts + ziko_program_exercises.
// Les deux sont ramenes a UNE forme ({ id, kind, name, goal, program_data }) : `program_data.sessions` est lu par
// normalizePlanSessions, donc l'accueil, l'ecran Seance et startPlannedSession traitent les deux de la meme facon.
// Module pur (client injecte), sans React.

export type ActiveProgramKind = 'ai' | 'coach';

export interface ActiveProgram {
  id: string;
  kind: ActiveProgramKind;
  name: string | null;
  goal: string | null;
  program_data: Record<string, any> | null;
  [k: string]: any;
}

type Client = { from: (table: string) => any };

/** Lignes ziko_program_workouts (+ program_exercises imbriques) -> program_data.sessions (day_of_week ISO 1..7). */
export function coachWorkoutsToProgramData(workouts: any[] | null | undefined): Record<string, any> {
  const sorted = [...(workouts ?? [])].sort(
    (a, b) => (a?.day_of_week ?? 99) - (b?.day_of_week ?? 99) || (a?.order_index ?? 0) - (b?.order_index ?? 0),
  );
  return {
    day_index_base: 1,
    sessions: sorted.map((w) => ({
      workout_id: w.id,
      name: w.name ?? 'Séance',
      day_of_week: typeof w.day_of_week === 'number' ? w.day_of_week : undefined,
      exercises: [...(w.program_exercises ?? [])]
        .sort((a, b) => (a?.order_index ?? 0) - (b?.order_index ?? 0))
        .map((e: any) => ({
          name: e.exercises?.name_fr || e.exercises?.name || e.name || '',
          sets: e.sets ?? undefined,
          reps: e.reps ?? (e.reps_min != null && e.reps_max != null ? `${e.reps_min}-${e.reps_max}` : null),
          exercise_id: e.exercise_id ?? null,
          rest_seconds: e.rest_seconds ?? null,
        }))
        .filter((e: any) => e.name),
    })),
  };
}

/** Choix pur : au plus un actif attendu ; en cas d'incoherence, le plus recemment cree gagne (jamais les deux). */
export function chooseActive(coach: any | null, ai: any | null): { kind: ActiveProgramKind; row: any } | null {
  if (coach && ai) {
    const c = Date.parse(coach.created_at ?? '') || 0;
    const a = Date.parse(ai.created_at ?? '') || 0;
    return c > a ? { kind: 'coach', row: coach } : { kind: 'ai', row: ai };
  }
  if (coach) return { kind: 'coach', row: coach };
  if (ai) return { kind: 'ai', row: ai };
  return null;
}

function fromCoachRow(row: any, workouts: any[]): ActiveProgram {
  return {
    ...row,
    id: row.id,
    kind: 'coach',
    name: row.name ?? null,
    goal: null,
    program_data: coachWorkoutsToProgramData(workouts),
  };
}

async function loadCoachWorkouts(client: Client, programId: string): Promise<any[]> {
  const { data } = await client
    .from('ziko_program_workouts')
    .select('*, program_exercises:ziko_program_exercises(*, exercises:ziko_exercises(name, name_fr))')
    .eq('program_id', programId)
    .order('day_of_week');
  return (data as any[]) ?? [];
}

/** Programme actif (une des deux tables) ou null. Une erreur de lecture est propagee (pas de faux "aucun programme"). */
export async function getActiveProgram(client: Client, userId: string): Promise<ActiveProgram | null> {
  const [w, a] = await Promise.all([
    client
      .from('ziko_workout_programs')
      .select('*')
      .or(`user_id.eq.${userId},assigned_to_user_id.eq.${userId}`)
      .eq('is_template', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1),
    client
      .from('ziko_ai_generated_programs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  if (w.error && a.error) throw w.error;
  const coach = (w.data as any[] | null)?.[0] ?? null;
  const ai = (a.data as any[] | null)?.[0] ?? null;
  if (!coach && !ai && (w.error || a.error)) throw (w.error ?? a.error);
  const picked = chooseActive(coach, ai);
  if (!picked) return null;
  if (picked.kind === 'ai') return { ...picked.row, kind: 'ai' } as ActiveProgram;
  return fromCoachRow(picked.row, await loadCoachWorkouts(client, picked.row.id));
}

/** Programme (par id) pour demarrer une seance : table IA d'abord, puis table coach. */
export async function loadProgramForSession(
  client: Client,
  userId: string,
  programId: string,
): Promise<{ program: ActiveProgram | null; error: boolean }> {
  const ai = await client
    .from('ziko_ai_generated_programs')
    .select('id, goal, name, program_data')
    .eq('id', programId)
    .eq('user_id', userId)
    .maybeSingle();
  if (ai.error) return { program: null, error: true };
  if (ai.data) return { program: { ...(ai.data as any), kind: 'ai' }, error: false };
  const coach = await client
    .from('ziko_workout_programs')
    .select('*')
    .eq('id', programId)
    .or(`user_id.eq.${userId},assigned_to_user_id.eq.${userId}`)
    .maybeSingle();
  if (coach.error) return { program: null, error: true };
  if (!coach.data) return { program: null, error: false };
  return { program: fromCoachRow(coach.data, await loadCoachWorkouts(client, programId)), error: false };
}

export type ActiveProgramView = 'loading' | 'error' | 'empty' | 'no-sessions' | 'ready';

/** Vrai si le programme contient au moins une seance planifiee (meme lecture que l'ecran Seance et l'accueil). */
export function programHasSessions(p: ActiveProgram | null | undefined): boolean {
  return !!p && normalizePlanSessions(p.program_data).length > 0;
}

/**
 * Etat d'affichage du programme actif, commun a l'accueil et a l'onglet Entrainement.
 * Run 7 : l'onglet affichait "Aucun programme actif" apres reconnexion car une erreur de lecture etait avalee
 * (resultat null mis en cache). Une erreur n'est JAMAIS un "aucun programme" ; un programme sans seance a son propre message.
 */
export function activeProgramView(s: {
  isLoading: boolean;
  isError: boolean;
  program: ActiveProgram | null | undefined;
}): ActiveProgramView {
  if (s.program) return programHasSessions(s.program) ? 'ready' : 'no-sessions';
  if (s.isLoading) return 'loading';
  if (s.isError) return 'error';
  return 'empty';
}
