import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

function admin() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Tool: ai_programs_generate ─────────────────────────────
export async function ai_programs_generate(
  params: Record<string, unknown>,
  userId: string,
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

  const db = admin();

  // Fetch user profile for context
  const { data: profile } = await db
    .from('user_profiles')
    .select('name, weight_kg, height_cm, goal')
    .eq('id', userId)
    .single();

  // Fetch available exercises
  const { data: exercises } = await db
    .from('exercises')
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

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages: [{ role: 'user', content: prompt }],
  });

  let programData: any;
  try {
    programData = JSON.parse(text);
  } catch {
    programData = { raw: text };
  }

  const programName = programData.name ?? `${goal} ${split_type} ${days_per_week}d`;

  const { data, error } = await db
    .from('ai_generated_programs')
    .insert({
      user_id: userId,
      name: programName,
      goal,
      split_type,
      days_per_week,
      experience: experience_level,
      equipment,
      program_data: programData,
      is_active: true,
    })
    .select('id, name, goal, days_per_week')
    .single();

  if (error) throw new Error(error.message);
  return { success: true, program: { ...data, program_data: programData } };
}

// ── Tool: ai_programs_list ─────────────────────────────────
export async function ai_programs_list(
  _params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const db = admin();

  const { data, error } = await db
    .from('ai_generated_programs')
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
): Promise<unknown> {
  const { program_id, adjustment } = params as {
    program_id: string;
    adjustment: string;
  };

  if (!program_id) throw new Error('program_id is required');
  if (!adjustment) throw new Error('adjustment is required');

  const db = admin();

  // Fetch current program
  const { data: program, error: fetchErr } = await db
    .from('ai_generated_programs')
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
    model: anthropic('claude-sonnet-4-20250514'),
    messages: [{ role: 'user', content: prompt }],
  });

  let adjusted: any;
  try {
    adjusted = JSON.parse(text);
  } catch {
    adjusted = program.program_data;
  }

  const { error } = await db
    .from('ai_generated_programs')
    .update({ program_data: adjusted })
    .eq('id', program_id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return { success: true, program_id, adjustment, program_data: adjusted };
}
