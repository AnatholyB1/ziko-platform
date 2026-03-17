import type { PluginManifest } from '@ziko/plugin-sdk';

const nutritionManifest: PluginManifest = {
  id: 'nutrition',
  name: 'Nutrition Tracker',
  version: '1.0.0',
  description:
    'Track your daily nutrition: log meals, monitor macros, and get AI-powered dietary advice tailored to your fitness goals.',
  icon: 'nutrition-icon',
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
      path: '/(plugins)/nutrition/dashboard',
      title: 'Nutrition',
      icon: 'leaf',
      showInTabBar: true,
    },
  ],
};

export default nutritionManifest;
