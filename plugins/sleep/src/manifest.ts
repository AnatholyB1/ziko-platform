import type { PluginManifest } from '@ziko/plugin-sdk';

const sleepManifest: PluginManifest = {
  id: 'sleep',
  name: 'Sommeil & Récupération',
  version: '1.0.0',
  description:
    'Suivi du sommeil, score de récupération quotidien et conseils IA pour optimiser ton repos selon ton volume d\'entraînement.',
  icon: 'moon-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history'],
  userDataKeys: ['sleep'],

  aiSkills: [
    {
      name: 'sleep_analysis',
      description: 'Analyze the user\'s sleep patterns, duration and quality trends',
      triggerKeywords: [
        'sommeil', 'sleep', 'dormir', 'insomnie', 'insomnia',
        'fatigué', 'tired', 'repos', 'rest', 'récupération', 'recovery',
      ],
      contextProvider: () => ({ skill: 'sleep_analysis' }),
    },
    {
      name: 'recovery_coaching',
      description: 'Provide recovery advice based on training load and sleep quality',
      triggerKeywords: [
        'récupérer', 'recover', 'surentraînement', 'overtraining',
        'courbatures', 'soreness', 'jour de repos', 'rest day',
      ],
      contextProvider: () => ({ skill: 'recovery_coaching' }),
    },
  ],

  aiTools: [
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
      description: 'Get the user\'s sleep logs for recent days.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of days (default 7)' },
        },
      },
    },
    {
      name: 'sleep_get_recovery_score',
      description: 'Get today\'s recovery score based on sleep and training load.',
      parameters: { type: 'object', properties: {} },
    },
  ],

  aiSystemPromptAddition: `
## Sleep & Recovery Plugin
You can track and analyze the user's sleep data. When they mention fatigue, sleep, or recovery:
- Reference their recent sleep duration and quality trends
- Calculate recovery score based on sleep vs training volume
- Suggest optimal bedtime based on their schedule
- Recommend rest days when recovery score is low
`,

  routes: [
    {
      path: '/(plugins)/sleep/dashboard',
      title: 'Sommeil',
      icon: 'moon-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/sleep/log',
      title: 'Logger sommeil',
      icon: 'add-circle-outline',
      showInTabBar: false,
    },
  ],
};

export default sleepManifest;
