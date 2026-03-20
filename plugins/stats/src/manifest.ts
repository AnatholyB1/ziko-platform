import type { PluginManifest } from '@ziko/plugin-sdk';

const statsManifest: PluginManifest = {
  id: 'stats',
  name: 'Analytics',
  version: '1.0.0',
  description:
    'Visualize your workout data with interactive charts — volume trends, muscle distribution, exercise progression, RPE tracking and more.',
  icon: 'stats-chart',
  category: 'analytics',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history'],
  userDataKeys: ['stats'],

  aiSkills: [
    {
      name: 'workout_analytics',
      description:
        'Answer questions about workout trends, volume progression, exercise PRs, and training frequency',
      triggerKeywords: [
        'stats', 'analytics', 'progress', 'PR', 'personal record',
        'volume', 'trend', 'progression', 'how much', 'how many sessions',
        'statistiques', 'évolution', 'progrès',
      ],
      contextProvider: () => ({ skill: 'workout_analytics' }),
    },
  ],

  routes: [
    {
      path: '/(plugins)/stats/dashboard',
      title: 'Analytics',
      icon: 'stats-chart',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/stats/exercise',
      title: 'Exercise Stats',
      icon: 'barbell',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/stats/session',
      title: 'Session Detail',
      icon: 'document-text',
      showInTabBar: false,
    },
  ],
};

export default statsManifest;
