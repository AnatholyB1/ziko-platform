import { generateText } from 'ai';
import { AGENT_MODEL } from '../config/models.js';
import { clientForUser } from './db.js';

// ── Tool: ai_programs_generate ────────────────────────────────
export async function ai_programs_generate(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const {
    goal,
    days_per_week,
    split_type = 'full_body',
    experience_level = 'intermediate',
    equipment = 'full_gym',
  } = params as {
    goal: string;
    days_per_week: number;
    split_type?: string;
    experience_level?: string;
    equipment?: string;
  };

  if (!goal) throw new Error('goal is required');
  if (!days_per_week) throw new Error('days_per_week is required');

  const db = clientForUser(userToken);

  // Fetch user profile for context
  const { data: profile } = await db
    .from('ziko_user_profiles')
    .select('name, weight_kg, height_cm, goal')
    .eq('id', userId)
    .single();

  // Fetch available exercises
  const { data: exercises } = await db
    .from('ziko_exercises')
    .select('name, category, muscle_groups')
    .limit(100);

  const prompt = `Generate a ${days_per_week}-day ${split_type} workout program.
Goal: ${goal}
Experience: ${experience_level}
Equipment: ${equipment}
User weight: ${profile?.weight_kg ?? 75}kg

Available exercises: ${(exercises ?? []).map((e: any) => e.name).join(', ')}

Return ONLY valid JSON:
{
  "name": "Program Name",
  "days": [
    {
      "day": 1,
      "name": "Day Name",
      "exercises": [
        { "name": "Exercise Name", "sets": 3, "reps": "8-12", "rest_sec": 90 }
      ]
    }
  ]
}`;

  let rawText = '';
  try {
    const { text } = await generateText({
      model: AGENT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 4000,
    });
    rawText = text;
  } catch (genErr) {
    console.error('[ai_programs_generate] generateText failed:', genErr);
    throw new Error(`Failed to generate program: ${genErr instanceof Error ? genErr.message : String(genErr)}`);
  }

  const programData = parseProgramJson(rawText);
  if (!programData) {
    // Never store raw model text as a program (it would become an empty/unreadable "active" one).
    throw new Error("Le programme généré est illisible (JSON invalide). Réessaie la génération.");
  }

  const programName = programData.name ?? `${goal} ${split_type} ${days_per_week}d`;

  // Inserted inactive: activation goes through ziko_set_active_program (single active program).
  const { data, error } = await db
    .from('ziko_ai_generated_programs')
    .insert({
      user_id: userId,
      name: programName,
      goal,
      split_type,
      days_per_week,
      experience: experience_level,
      equipment,
      program_data: programData,
      is_active: false,
    })
    .select('id, name, goal, days_per_week')
    .single();

  if (error) throw new Error(error.message);

  const { error: rpcError } = await db.rpc('ziko_set_active_program', {
    p_kind: 'ai',
    p_program_id: (data as { id: string }).id,
  });
  if (rpcError) {
    // Do not leave an orphan, never-activated row behind.
    await db.from('ziko_ai_generated_programs').delete().eq('id', (data as { id: string }).id);
    throw new Error(`Impossible d'activer le programme: ${rpcError.message}`);
  }
  return { success: true, program: { ...data, is_active: true, program_data: programData } };
}

/** Parses the model output into a program object; returns null when no valid JSON object is found. */
export function parseProgramJson(rawText: string): Record<string, any> | null {
  const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
  const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const v = JSON.parse(jsonStr);
    if (isObj(v)) return v;
  } catch {
    /* fall through */
  }
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const v = JSON.parse(match[0]);
      if (isObj(v)) return v;
    } catch {
      /* fall through */
    }
  }
  return null;
}

// ── Tool: ai_programs_list ─────────────────────────────────
export async function ai_programs_list(
  _params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const db = clientForUser(userToken);

  const { data, error } = await db
    .from('ziko_ai_generated_programs')
    .select('id, name, goal, split_type, days_per_week, is_active, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return { programs: data ?? [] };
}

// ── Tool: ai_programs_adjust ───────────────────────────────
export async function ai_programs_adjust(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const { program_id, adjustment } = params as {
    program_id: string;
    adjustment: string;
  };

  if (!program_id) throw new Error('program_id is required');
  if (!adjustment) throw new Error('adjustment is required');

  const db = clientForUser(userToken);

  // Fetch current program
  const { data: program, error: fetchErr } = await db
    .from('ziko_ai_generated_programs')
    .select('*')
    .eq('id', program_id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !program) throw new Error('Program not found');

  const prompt = `Adjust this workout program to be "${adjustment}".
Current program: ${JSON.stringify(program.program_data)}

Return ONLY valid JSON with the same structure but adjusted.
For "easier": reduce sets/reps, increase rest.
For "harder": increase sets/reps, decrease rest.
For "more_volume": add more sets.
For "less_volume": remove sets.`;

  const { text } = await generateText({
    model: AGENT_MODEL,
    messages: [{ role: 'user', content: prompt }],
  });

  let adjusted: any;
  try {
    adjusted = JSON.parse(text);
  } catch {
    adjusted = program.program_data;
  }

  const { error } = await db
    .from('ziko_ai_generated_programs')
    .update({ program_data: adjusted })
    .eq('id', program_id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return { success: true, program_id, adjustment, program_data: adjusted };
}
