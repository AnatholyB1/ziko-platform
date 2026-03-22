import type { PluginManifest } from '@ziko/plugin-sdk';

const timerManifest: PluginManifest = {
  id: 'timer',
  name: 'Timer & Chrono',
  version: '1.0.0',
  description:
    'Minuteur HIIT, Tabata, EMOM et intervalles personnalisés. Chronomètre de repos et historique des temps.',
  icon: 'timer-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile', 'notifications'],
  userDataKeys: ['timer'],

  aiSkills: [
    {
      name: 'timer_recommendation',
      description: 'Recommend timer presets (HIIT, Tabata, EMOM) based on workout type',
      triggerKeywords: [
        'timer', 'minuteur', 'chrono', 'HIIT', 'tabata', 'EMOM',
        'intervalle', 'interval', 'repos', 'rest', 'work rest',
      ],
      contextProvider: () => ({ skill: 'timer_recommendation' }),
    },
  ],

  aiTools: [
    {
      name: 'timer_get_presets',
      description: 'Get available timer presets (HIIT, Tabata, EMOM, custom).',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'timer_create_preset',
      description: 'Create a custom timer preset.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Preset name' },
          type: { type: 'string', enum: ['hiit', 'tabata', 'emom', 'custom'], description: 'Timer type' },
          work_seconds: { type: 'integer', description: 'Work interval in seconds' },
          rest_seconds: { type: 'integer', description: 'Rest interval in seconds' },
          rounds: { type: 'integer', description: 'Number of rounds' },
        },
        required: ['name', 'type', 'work_seconds', 'rounds'],
      },
    },
  ],

  aiSystemPromptAddition: `
## Timer Plugin
You can help users set up workout timers. When they mention HIIT, Tabata, EMOM or intervals:
- Suggest appropriate work/rest ratios for their fitness level
- Tabata standard: 20s work / 10s rest × 8 rounds
- EMOM: Every Minute On the Minute
- HIIT: customizable work/rest intervals
`,

  routes: [
    {
      path: '/(plugins)/timer/dashboard',
      title: 'Timer',
      icon: 'timer-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/timer/manager',
      title: 'Gérer les chronos',
      icon: 'settings-outline',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/timer/editor',
      title: 'Éditeur chrono',
      icon: 'create-outline',
      showInTabBar: false,
    },
  ],
};

export default timerManifest;
