import type { PluginManifest } from '@ziko/plugin-sdk';

const nutritionManifest: PluginManifest = {
  id: 'nutrition',
  name: 'Nutrition Tracker',
  version: '1.0.0',
  description:
    'Track your daily nutrition: log meals, monitor macros, and get AI-powered dietary advice tailored to your fitness goals.',
  icon: 'restaurant',
  category: 'nutrition',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history'],
  userDataKeys: ['nutrition'],

  aiSkills: [
    {
      name: 'meal_planning',
      description: 'Propose personalised meal plans based on user goal and TDEE',
      triggerKeywords: ['meal plan', 'what to eat', 'diet', 'repas', 'nutrition plan', 'food ideas'],
      contextProvider: () => ({ skill: 'meal_planning' }),
    },
    {
      name: 'calorie_feedback',
      description: "Comment on today's logged meals and daily caloric/macro totals",
      triggerKeywords: ['calories', 'did I eat', 'my intake', 'macros', 'protein today'],
      contextProvider: () => ({ skill: 'calorie_feedback' }),
    },
    {
      name: 'nutrition_coaching',
      description: 'Answer nutrition questions with user profile context',
      triggerKeywords: ['protein', 'carbs', 'fat', 'lose weight', 'gain muscle', 'food', 'nutrition'],
      contextProvider: () => ({ skill: 'nutrition_coaching' }),
    },
  ],

  aiTools: [
    {
      name: 'nutrition_get_today',
      description: "Get all meals the user has logged today with macro breakdown.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'ISO date YYYY-MM-DD (defaults to today)' },
        },
      },
    },
    {
      name: 'nutrition_log_meal',
      description: 'Log a food entry. Use when the user says they ate something.',
      parameters: {
        type: 'object',
        properties: {
          meal_type: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          food_name: { type: 'string', description: 'Name of the food or meal' },
          calories: { type: 'integer', description: 'Calories in kcal' },
          protein_g: { type: 'number', description: 'Protein in grams' },
          carbs_g: { type: 'number', description: 'Carbs in grams' },
          fat_g: { type: 'number', description: 'Fat in grams' },
          serving_g: { type: 'number', description: 'Serving size in grams (optional)' },
        },
        required: ['meal_type', 'food_name', 'calories'],
      },
    },
    {
      name: 'nutrition_get_summary',
      description: "Get a macro summary for today vs the user's goals.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'ISO date YYYY-MM-DD (defaults to today)' },
        },
      },
    },
    {
      name: 'nutrition_delete_entry',
      description: 'Delete a logged nutrition entry by ID. Ask for confirmation first.',
      parameters: {
        type: 'object',
        properties: {
          entry_id: { type: 'string', description: 'UUID of the entry to delete' },
        },
        required: ['entry_id'],
      },
    },
  ],

  aiSystemPromptAddition: `
## Nutrition Plugin Context
You have access to the user's daily nutrition logs. When discussing food or diet:
- Reference their actual logged meals and macros for the day
- Calculate suggestions based on their TDEE (Total Daily Energy Expenditure)
- For muscle gain: aim for caloric surplus + ≥2g protein per kg bodyweight
- For fat loss: aim for moderate deficit (300-500kcal) + high protein
- Always suggest whole, minimally processed foods as default
`,

  routes: [
    {
      path: '/(plugins)/nutrition/log',
      title: 'Log Meal',
      icon: 'fork-knife',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/nutrition/calculator',
      title: 'TDEE Calculator',
      icon: 'calculator',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/nutrition/dashboard',
      title: 'Nutrition',
      icon: 'leaf',
      showInTabBar: true,
    },
  ],
};

export default nutritionManifest;
