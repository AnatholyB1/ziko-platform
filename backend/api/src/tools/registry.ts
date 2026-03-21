import * as HabitsTools from './habits.js';
import * as NutritionTools from './nutrition.js';

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
};

export const allToolSchemas: AITool[] = [...habitsToolSchemas, ...nutritionToolSchemas];

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
