import type { PluginManifest } from '@ziko/plugin-sdk';

const manifest: PluginManifest = {
  id: 'rpe',
  /** Progressive unlock: athlete level required (1-5). */
  minLevel: 1,
  name: 'Calculateur RPE',
  description: 'Calcule ton 1RM estimé et les zones d\'entraînement à partir du RPE, de la charge et du nombre de reps.',
  version: '1.0.0',
  icon: 'calculator-outline',
  category: 'training',
  price: 'free',
  requiredPermissions: [],
  userDataKeys: [],
  routes: [
    {
      path: '/(plugins)/rpe/',
      title: 'Calculateur RPE',
      icon: 'calculator-outline',
      showInTabBar: false,
    },
  ],
  aiSkills: [
    {
      name: 'RPE Coaching',
      description: 'Calcule le 1RM estimé et les zones d\'entraînement à partir du RPE, de la charge et du nombre de reps.',
      triggerKeywords: ['rpe', '1rm', 'rep max', 'charge', 'effort', 'perceived exertion'],
      contextProvider: () => ({}),
    },
  ],
};

export default manifest;
