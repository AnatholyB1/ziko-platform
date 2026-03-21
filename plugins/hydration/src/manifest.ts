import type { PluginManifest } from '@ziko/plugin-sdk';

const hydrationManifest: PluginManifest = {
  id: 'hydration',
  name: 'Hydratation',
  version: '1.0.0',
  description:
    'Suivi de consommation d\'eau quotidienne. Compteur de verres, objectif personnalisé selon le poids et rappels.',
  icon: 'water-outline',
  category: 'health',
  price: 'free',
  requiredPermissions: ['read_profile'],
  userDataKeys: ['hydration'],

  aiSkills: [
    {
      name: 'hydration_tracking',
      description: 'Track and analyze daily water intake, suggest optimal hydration based on weight and activity',
      triggerKeywords: [
        'eau', 'water', 'hydratation', 'hydration', 'boire', 'drink',
        'verre', 'glass', 'litre', 'soif', 'thirsty', 'déshydraté',
      ],
      contextProvider: () => ({ skill: 'hydration_tracking' }),
    },
  ],

  aiTools: [
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
      description: 'Get today\'s water intake total and goal.',
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
  ],

  aiSystemPromptAddition: `
## Hydration Plugin
You can track the user's daily water intake. General guidelines:
- Recommend ~30-35ml per kg of body weight as a baseline
- Increase by 500-750ml on workout days
- A standard glass = 250ml, a bottle = 500ml
- Encourage regular sipping rather than chugging
`,

  routes: [
    {
      path: '/(plugins)/hydration/dashboard',
      title: 'Hydratation',
      icon: 'water-outline',
      showInTabBar: true,
    },
  ],
};

export default hydrationManifest;
