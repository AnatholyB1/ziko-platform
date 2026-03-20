import type { PluginManifest } from '@ziko/plugin-sdk';

const statsManifest: PluginManifest = {
  id: 'stats',
  name: 'Analytics',
  version: '1.0.0',
  description:
    'Centre d\'analytics complet — séances, habitudes, nutrition, gamification, conversations IA. Charts interactifs, KPIs, tendances.',
  icon: 'stats-chart',
  category: 'analytics',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history', 'read_habits', 'read_nutrition'],
  userDataKeys: ['stats', 'habits', 'nutrition', 'gamification', 'ai'],

  aiSkills: [
    {
      name: 'full_analytics',
      description:
        'Answer questions about workout stats, habits completion, nutrition macros, gamification XP/levels, and AI conversation activity',
      triggerKeywords: [
        'stats', 'analytics', 'progress', 'PR', 'personal record',
        'volume', 'trend', 'progression', 'how much', 'how many sessions',
        'statistiques', 'évolution', 'progrès', 'habitudes', 'nutrition',
        'calories', 'macros', 'protéines', 'XP', 'level', 'niveau',
        'streak', 'coins', 'pièces', 'conversations', 'coach',
      ],
      contextProvider: () => ({ skill: 'full_analytics' }),
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
