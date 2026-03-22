import * as HabitsTools from './habits.js';
import * as NutritionTools from './nutrition.js';
import * as StretchingTools from './stretching.js';
import * as SleepTools from './sleep.js';
import * as MeasurementsTools from './measurements.js';
import * as TimerTools from './timer.js';
import * as AiProgramsTools from './ai-programs.js';
import * as JournalTools from './journal.js';
import * as HydrationTools from './hydration.js';
import * as CardioTools from './cardio.js';

// Local copy of AITool type (from @ziko/plugin-sdk) to avoid workspace dep on Vercel
export interface AIToolParameter {
  type: 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  enum?: string[];
}

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}

// ── Tool executor type ─────────────────────────────────────
export interface ToolExecutor {
  schema: AITool;
  execute: (params: Record<string, unknown>, userId: string) => Promise<unknown>;
}

// ── Habits tool schemas ────────────────────────────────────
const habitsToolSchemas: AITool[] = [
  {
    name: 'habits_get_today',
    description: "Get the user's active habits and their completion status for today.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'habits_log',
    description: "Mark a habit as done or update its count value for today.",
    parameters: {
      type: 'object',
      properties: {
        habit_id: { type: 'string', description: 'The UUID of the habit to log' },
        value: { type: 'integer', description: 'Value to log (1 for boolean habits, actual count for count habits)' },
      },
      required: ['habit_id'],
    },
  },
  {
    name: 'habits_get_streaks',
    description: "Get the current streak (consecutive days completed) for each of the user's habits.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'habits_create',
    description: "Create a new habit for the user.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the habit, e.g. "Drink 2L water"' },
        emoji: { type: 'string', description: 'Single emoji representing the habit' },
        type: { type: 'string', enum: ['boolean', 'count'], description: 'boolean = done/not done; count = numeric target' },
        target: { type: 'integer', description: 'Target value (use 1 for boolean habits)' },
        unit: { type: 'string', description: 'Unit label for count habits, e.g. "glasses", "minutes"' },
      },
      required: ['name'],
    },
  },
];

// ── Nutrition tool schemas ─────────────────────────────────
const nutritionToolSchemas: AITool[] = [
  {
    name: 'nutrition_get_today',
    description: "Get all meals the user has logged today, with full macro breakdown.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date YYYY-MM-DD (defaults to today)' },
      },
    },
  },
  {
    name: 'nutrition_log_meal',
    description: "Log a food entry for the user. Use this when the user says they ate something.",
    parameters: {
      type: 'object',
      properties: {
        meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        food_name: { type: 'string', description: 'Name of the food or meal' },
        calories: { type: 'integer', description: 'Total calories (kcal)' },
        protein_g: { type: 'number', description: 'Protein in grams' },
        carbs_g: { type: 'number', description: 'Carbohydrates in grams' },
        fat_g: { type: 'number', description: 'Fat in grams' },
        serving_g: { type: 'number', description: 'Serving size in grams (optional)' },
      },
      required: ['meal_type', 'food_name', 'calories'],
    },
  },
  {
    name: 'nutrition_get_summary',
    description: "Get a macro summary for today vs the user's estimated goals (calories & protein).",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date YYYY-MM-DD (defaults to today)' },
      },
    },
  },
  {
    name: 'nutrition_delete_entry',
    description: "Delete a previously logged nutrition entry by its ID. Ask for confirmation first.",
    parameters: {
      type: 'object',
      properties: {
        entry_id: { type: 'string', description: 'UUID of the nutrition log entry to delete' },
      },
      required: ['entry_id'],
    },
  },
];

// ── Registry ───────────────────────────────────────────────
const executors: Record<string, ToolExecutor['execute']> = {
  habits_get_today: HabitsTools.habits_get_today,
  habits_log: HabitsTools.habits_log,
  habits_get_streaks: HabitsTools.habits_get_streaks,
  habits_create: HabitsTools.habits_create,
  nutrition_get_today: NutritionTools.nutrition_get_today,
  nutrition_log_meal: NutritionTools.nutrition_log_meal,
  nutrition_get_summary: NutritionTools.nutrition_get_summary,
  nutrition_delete_entry: NutritionTools.nutrition_delete_entry,
  stretching_get_routines: StretchingTools.stretching_get_routines,
  stretching_log_session: StretchingTools.stretching_log_session,
  stretching_get_history: StretchingTools.stretching_get_history,
  sleep_log: SleepTools.sleep_log,
  sleep_get_history: SleepTools.sleep_get_history,
  sleep_get_recovery_score: SleepTools.sleep_get_recovery_score,
  measurements_log: MeasurementsTools.measurements_log,
  measurements_get_history: MeasurementsTools.measurements_get_history,
  measurements_get_progress: MeasurementsTools.measurements_get_progress,
  timer_get_presets: TimerTools.timer_get_presets,
  timer_create_preset: TimerTools.timer_create_preset,
  ai_programs_generate: AiProgramsTools.ai_programs_generate,
  ai_programs_list: AiProgramsTools.ai_programs_list,
  ai_programs_adjust: AiProgramsTools.ai_programs_adjust,
  journal_log_mood: JournalTools.journal_log_mood,
  journal_get_history: JournalTools.journal_get_history,
  journal_get_trends: JournalTools.journal_get_trends,
  hydration_log: HydrationTools.hydration_log,
  hydration_get_today: HydrationTools.hydration_get_today,
  hydration_set_goal: HydrationTools.hydration_set_goal,
  cardio_log_session: CardioTools.cardio_log_session,
  cardio_get_history: CardioTools.cardio_get_history,
  cardio_get_stats: CardioTools.cardio_get_stats,
};

// ── Tool schemas from plugin manifests ─────────────────────
const stretchingToolSchemas: AITool[] = [
  {
    name: 'stretching_get_routines',
    description: 'Get available stretching routines filtered by muscle group or type (pre/post workout).',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['pre_workout', 'post_workout', 'recovery', 'full_body'], description: 'Type of routine' },
        muscle_group: { type: 'string', description: 'Target muscle group (optional)' },
      },
    },
  },
  {
    name: 'stretching_log_session',
    description: 'Log a completed stretching session.',
    parameters: {
      type: 'object',
      properties: {
        routine_id: { type: 'string', description: 'UUID of the routine completed' },
        duration_seconds: { type: 'integer', description: 'Total duration in seconds' },
      },
      required: ['duration_seconds'],
    },
  },
  {
    name: 'stretching_get_history',
    description: "Get the user's recent stretching session history.",
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days to look back (default 7)' },
      },
    },
  },
];

const sleepToolSchemas: AITool[] = [
  {
    name: 'sleep_log',
    description: 'Log a sleep entry with bedtime, wake time and quality rating.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
        bedtime: { type: 'string', description: 'Bedtime (HH:MM)' },
        wake_time: { type: 'string', description: 'Wake time (HH:MM)' },
        quality: { type: 'integer', description: 'Quality 1-5' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['bedtime', 'wake_time', 'quality'],
    },
  },
  {
    name: 'sleep_get_history',
    description: "Get the user's sleep logs for recent days.",
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days (default 7)' },
      },
    },
  },
  {
    name: 'sleep_get_recovery_score',
    description: "Get today's recovery score based on sleep and training load.",
    parameters: { type: 'object', properties: {} },
  },
];

const measurementsToolSchemas: AITool[] = [
  {
    name: 'measurements_log',
    description: 'Log body measurements for today.',
    parameters: {
      type: 'object',
      properties: {
        weight_kg: { type: 'number', description: 'Weight in kg' },
        body_fat_pct: { type: 'number', description: 'Body fat percentage' },
        waist_cm: { type: 'number', description: 'Waist circumference in cm' },
        chest_cm: { type: 'number', description: 'Chest circumference in cm' },
        arm_cm: { type: 'number', description: 'Arm circumference in cm' },
        thigh_cm: { type: 'number', description: 'Thigh circumference in cm' },
        hip_cm: { type: 'number', description: 'Hip circumference in cm' },
      },
    },
  },
  {
    name: 'measurements_get_history',
    description: 'Get body measurement history.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days (default 30)' },
      },
    },
  },
  {
    name: 'measurements_get_progress',
    description: 'Get body measurement progress comparing current vs N days ago.',
    parameters: {
      type: 'object',
      properties: {
        compare_days: { type: 'integer', description: 'Compare with N days ago (default 30)' },
      },
    },
  },
];

const timerToolSchemas: AITool[] = [
  {
    name: 'timer_get_presets',
    description: 'Get available timer presets (HIIT, Tabata, EMOM, custom).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'timer_create_preset',
    description: 'Create a custom timer preset.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Preset name' },
        type: { type: 'string', enum: ['hiit', 'tabata', 'emom', 'custom'], description: 'Timer type' },
        work_seconds: { type: 'integer', description: 'Work interval in seconds' },
        rest_seconds: { type: 'integer', description: 'Rest interval in seconds' },
        rounds: { type: 'integer', description: 'Number of rounds' },
      },
      required: ['name', 'type', 'work_seconds', 'rounds'],
    },
  },
];

const aiProgramsToolSchemas: AITool[] = [
  {
    name: 'ai_programs_generate',
    description: 'Generate a personalized workout program using AI.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', enum: ['muscle_gain', 'fat_loss', 'strength', 'endurance', 'general_fitness'], description: 'Training goal' },
        days_per_week: { type: 'integer', description: 'Training days per week (2-6)' },
        split_type: { type: 'string', enum: ['full_body', 'upper_lower', 'ppl', 'bro_split', 'custom'], description: 'Program split type' },
        experience_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: 'User experience level' },
        equipment: { type: 'string', enum: ['full_gym', 'home', 'bodyweight', 'dumbbells_only'], description: 'Available equipment' },
      },
      required: ['goal', 'days_per_week'],
    },
  },
  {
    name: 'ai_programs_list',
    description: 'List all AI-generated programs for the user.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'ai_programs_adjust',
    description: 'Adjust difficulty of an AI-generated program based on feedback.',
    parameters: {
      type: 'object',
      properties: {
        program_id: { type: 'string', description: 'Program UUID' },
        adjustment: { type: 'string', enum: ['easier', 'harder', 'more_volume', 'less_volume'], description: 'Type of adjustment' },
      },
      required: ['program_id', 'adjustment'],
    },
  },
];

const journalToolSchemas: AITool[] = [
  {
    name: 'journal_log_mood',
    description: 'Log a mood/mindset entry.',
    parameters: {
      type: 'object',
      properties: {
        mood: { type: 'integer', description: 'Mood 1-5 (1=bad, 5=great)' },
        energy: { type: 'integer', description: 'Energy level 1-5' },
        stress: { type: 'integer', description: 'Stress level 1-5 (1=low, 5=high)' },
        context: { type: 'string', enum: ['pre_workout', 'post_workout', 'morning', 'evening', 'general'], description: 'When this entry was logged' },
        notes: { type: 'string', description: 'Free text notes' },
      },
      required: ['mood'],
    },
  },
  {
    name: 'journal_get_history',
    description: "Get the user's mood journal history.",
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days (default 7)' },
      },
    },
  },
  {
    name: 'journal_get_trends',
    description: 'Get mood, energy and stress trends over time.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days (default 30)' },
      },
    },
  },
];

const hydrationToolSchemas: AITool[] = [
  {
    name: 'hydration_log',
    description: 'Log water intake (in ml).',
    parameters: {
      type: 'object',
      properties: {
        amount_ml: { type: 'integer', description: 'Amount in milliliters (e.g. 250 for a glass)' },
      },
      required: ['amount_ml'],
    },
  },
  {
    name: 'hydration_get_today',
    description: "Get today's water intake total and goal.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'hydration_set_goal',
    description: 'Set the daily water intake goal in ml.',
    parameters: {
      type: 'object',
      properties: {
        goal_ml: { type: 'integer', description: 'Daily goal in ml (e.g. 2500)' },
      },
      required: ['goal_ml'],
    },
  },
];

const cardioToolSchemas: AITool[] = [
  {
    name: 'cardio_log_session',
    description: 'Log a cardio session.',
    parameters: {
      type: 'object',
      properties: {
        activity_type: { type: 'string', enum: ['running', 'cycling', 'swimming', 'hiit', 'walking', 'elliptical', 'rowing', 'other'], description: 'Type of cardio activity' },
        duration_min: { type: 'number', description: 'Duration in minutes' },
        distance_km: { type: 'number', description: 'Distance in km (if applicable)' },
        calories_burned: { type: 'integer', description: 'Estimated calories burned' },
        avg_heart_rate: { type: 'integer', description: 'Average heart rate (optional)' },
        notes: { type: 'string', description: 'Session notes' },
      },
      required: ['activity_type', 'duration_min'],
    },
  },
  {
    name: 'cardio_get_history',
    description: "Get the user's cardio session history.",
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days (default 30)' },
        activity_type: { type: 'string', description: 'Filter by activity type (optional)' },
      },
    },
  },
  {
    name: 'cardio_get_stats',
    description: 'Get cardio statistics (total distance, total time, avg pace).',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days (default 30)' },
      },
    },
  },
];

export const allToolSchemas: AITool[] = [
  ...habitsToolSchemas,
  ...nutritionToolSchemas,
  ...stretchingToolSchemas,
  ...sleepToolSchemas,
  ...measurementsToolSchemas,
  ...timerToolSchemas,
  ...aiProgramsToolSchemas,
  ...journalToolSchemas,
  ...hydrationToolSchemas,
  ...cardioToolSchemas,
];

export function getToolExecutor(name: string): ToolExecutor['execute'] | undefined {
  return executors[name];
}

/** Convert tool schemas to OpenAI-compatible function definitions */
export function toOpenAITools(tools: AITool[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
