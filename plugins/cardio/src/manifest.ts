import type { PluginManifest } from '@ziko/plugin-sdk';

const cardioManifest: PluginManifest = {
  id: 'cardio',
  name: 'Cardio & Running',
  version: '1.0.0',
  description:
    'Suivi des sessions cardio : course, vélo, natation, HIIT. Distance, durée, allure, calories brûlées et historique.',
  icon: 'fitness-outline',
  category: 'training',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history'],
  userDataKeys: ['cardio'],

  aiSkills: [
    {
      name: 'cardio_analysis',
      description: 'Analyze cardio performance, pace trends, distance progression and recovery',
      triggerKeywords: [
        'cardio', 'course', 'running', 'courir', 'run',
        'vélo', 'bike', 'cycling', 'natation', 'swimming',
        'allure', 'pace', 'distance', 'km', 'calories',
        'endurance', 'fréquence cardiaque', 'heart rate',
      ],
      contextProvider: () => ({ skill: 'cardio_analysis' }),
    },
    {
      name: 'running_coaching',
      description: 'Provide running plans, improve pace, and training periodization',
      triggerKeywords: [
        'plan course', 'running plan', 'marathon', 'semi',
        '5k', '10k', 'trail', 'interval', 'fractionné',
        'tempo', 'endurance fondamentale', 'easy run',
      ],
      contextProvider: () => ({ skill: 'running_coaching' }),
    },
  ],

  aiTools: [
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
      description: 'Get the user\'s cardio session history.',
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
  ],

  aiSystemPromptAddition: `
## Cardio & Running Plugin
You can track cardio activities. When discussing performance:
- Pace = minutes per km (e.g., 5:30/km)
- Encourage progressive overload (10% rule for weekly volume)
- For running plans: easy runs (80%), tempo/intervals (20%)
- Recovery between hard sessions is critical
`,

  routes: [
    {
      path: '/(plugins)/cardio/dashboard',
      title: 'Cardio',
      icon: 'fitness-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/cardio/log',
      title: 'Nouvelle session',
      icon: 'add-circle-outline',
      showInTabBar: false,
    },
  ],
};

export default cardioManifest;
