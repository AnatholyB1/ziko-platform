import type { PluginManifest } from '@ziko/plugin-sdk';

const habitsManifest: PluginManifest = {
  id: 'habits',
  name: 'Daily Habits & Goals',
  version: '1.0.0',
  description:
    'Track your daily goals: water intake, workouts, sleep, nutrition and custom habits. Get smart reminders and celebrate streaks — fully connected to your AI coach, workout history and nutrition plugin.',
  icon: 'checkmark-circle-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: [
    'read_profile',
    'read_workout_history',
    'read_nutrition',
    'notifications',
  ],
  userDataKeys: ['habits'],

  aiSkills: [
    {
      name: 'habit_analysis',
      description: 'Analyse the user\'s habit streaks and completion rate',
      triggerKeywords: ['habit', 'streak', 'routine', 'daily goal', 'habitude', 'objectif'],
      contextProvider: () => ({ skill: 'habit_analysis' }),
    },
    {
      name: 'habit_coaching',
      description: 'Give advice on building good habits and breaking bad ones',
      triggerKeywords: ['build habit', 'consistency', 'motivation', 'tracking', 'routine'],
      contextProvider: () => ({ skill: 'habit_coaching' }),
    },
  ],

  aiTools: [
    {
      name: 'habits_get_today',
      description: "Get the user's active habits and their completion status for today.",
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'habits_log',
      description: 'Mark a habit as done or update its count value for today.',
      parameters: {
        type: 'object',
        properties: {
          habit_id: { type: 'string', description: 'UUID of the habit to log' },
          value: { type: 'integer', description: 'Value to log (1 for boolean habits)' },
        },
        required: ['habit_id'],
      },
    },
    {
      name: 'habits_get_streaks',
      description: "Get the current streak for each of the user's habits.",
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'habits_create',
      description: 'Create a new habit for the user.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the habit' },
          emoji: { type: 'string', description: 'Single emoji' },
          type: { type: 'string', enum: ['boolean', 'count'] },
          target: { type: 'integer', description: 'Target value' },
          unit: { type: 'string', description: 'Unit for count habits' },
        },
        required: ['name'],
      },
    },
  ],

  aiSystemPromptAddition: `
## Daily Habits Plugin
You have access to the user's daily habit tracker. When they ask about their habits or consistency:
- Reference their current streaks and completion rates
- Be specific about which habits they are excelling at vs struggling with
- Suggest habit stacking (attaching new habits to existing ones)
- Celebrate milestones (7-day, 30-day streaks)
`,

  routes: [
    {
      path: '/(plugins)/habits/dashboard',
      title: 'Habits',
      icon: 'checkmark-circle-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/habits/log',
      title: 'Add Habit',
      icon: 'add-circle-outline',
      showInTabBar: false,
    },
  ],
};

export default habitsManifest;
