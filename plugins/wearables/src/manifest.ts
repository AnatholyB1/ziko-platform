import type { PluginManifest } from '@ziko/plugin-sdk';

const wearablesManifest: PluginManifest = {
  id: 'wearables',
  name: 'Wearables & Santé',
  version: '1.0.0',
  description:
    'Connecte Apple Health (iOS) et Health Connect (Android) pour synchroniser pas, fréquence cardiaque, sommeil, calories et entraînements.',
  icon: 'watch-outline',
  category: 'health',
  price: 'free',
  requiredPermissions: ['read_profile'],
  userDataKeys: ['wearables'],

  aiSkills: [
    {
      name: 'health_sync',
      description: 'Sync and analyze health data from wearable devices (Apple Watch, Samsung, Fitbit, etc.)',
      triggerKeywords: [
        'wearable', 'montre', 'watch', 'apple health', 'health connect',
        'fitbit', 'garmin', 'samsung health', 'google fit',
        'pas', 'steps', 'fréquence cardiaque', 'heart rate',
        'synchroniser', 'sync', 'connecter', 'connect',
      ],
      contextProvider: () => ({ skill: 'health_sync' }),
    },
    {
      name: 'activity_summary',
      description: 'Provide daily activity summary from wearable data: steps, calories, heart rate, sleep',
      triggerKeywords: [
        'résumé activité', 'activity summary', 'bilan santé',
        'calories brûlées', 'burned calories', 'pas aujourd\'hui',
        'steps today', 'activité', 'activity',
      ],
      contextProvider: () => ({ skill: 'activity_summary' }),
    },
  ],

  aiTools: [
    {
      name: 'wearables_get_steps',
      description: 'Get step count from wearable for a date range.',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD), defaults to today' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD), defaults to today' },
        },
      },
    },
    {
      name: 'wearables_get_heart_rate',
      description: 'Get heart rate data from wearable for a date range.',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        },
      },
    },
    {
      name: 'wearables_get_summary',
      description: 'Get a full health summary (steps, calories, heart rate, sleep) for a date.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date (YYYY-MM-DD), defaults to today' },
        },
      },
    },
    {
      name: 'wearables_sync_status',
      description: 'Get the current sync status and last sync timestamps for each data type.',
      parameters: { type: 'object', properties: {} },
    },
  ],

  aiSystemPromptAddition: `
## Wearables & Health Plugin
You can access the user's wearable health data synced from Apple Health (iOS) or Health Connect (Android).
Data types available: steps, heart rate, sleep sessions, calories burned, exercise sessions, weight, body fat.
- Wearable data is synced on-demand from the device — it may lag behind real-time.
- Steps goal: typically 10,000/day. Heart rate resting: 60-80bpm is normal for adults.
- Use this data to give holistic fitness advice combining workout, nutrition, and recovery.
`,

  routes: [
    {
      path: '/(plugins)/wearables/dashboard',
      title: 'Wearables',
      icon: 'watch-outline',
      showInTabBar: true,
    },
  ],
};

export default wearablesManifest;
