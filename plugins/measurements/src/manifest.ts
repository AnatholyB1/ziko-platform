import type { PluginManifest } from '@ziko/plugin-sdk';

const measurementsManifest: PluginManifest = {
  id: 'measurements',
  name: 'Mesures & Progression',
  version: '1.0.0',
  description:
    'Suivi du poids, tour de taille, bras, cuisses, % de graisse. Photos avant/après et graphiques de progression long terme.',
  icon: 'resize-outline',
  category: 'analytics',
  price: 'free',
  requiredPermissions: ['read_profile', 'write_profile', 'camera'],
  userDataKeys: ['measurements'],

  aiSkills: [
    {
      name: 'body_progress',
      description: 'Analyze body measurement trends (weight, body fat, circumferences)',
      triggerKeywords: [
        'poids', 'weight', 'mensurations', 'measurements', 'tour de',
        'graisse', 'body fat', 'bras', 'arm', 'cuisse', 'taille', 'waist',
        'progression corporelle', 'body progress', 'avant après', 'before after',
      ],
      contextProvider: () => ({ skill: 'body_progress' }),
    },
  ],

  aiTools: [
    {
      name: 'measurements_log',
      description: 'Log body measurements for today.',
      parameters: {
        type: 'object',
        properties: {
          weight_kg: { type: 'number', description: 'Weight in kg' },
          body_fat_pct: { type: 'number', description: 'Body fat percentage' },
          waist_cm: { type: 'number', description: 'Waist circumference in cm' },
          chest_cm: { type: 'number', description: 'Chest circumference in cm' },
          arm_cm: { type: 'number', description: 'Arm circumference in cm' },
          thigh_cm: { type: 'number', description: 'Thigh circumference in cm' },
          hip_cm: { type: 'number', description: 'Hip circumference in cm' },
        },
      },
    },
    {
      name: 'measurements_get_history',
      description: 'Get body measurement history.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of days (default 30)' },
        },
      },
    },
    {
      name: 'measurements_get_progress',
      description: 'Get body measurement progress comparing current vs N days ago.',
      parameters: {
        type: 'object',
        properties: {
          compare_days: { type: 'integer', description: 'Compare with N days ago (default 30)' },
        },
      },
    },
  ],

  aiSystemPromptAddition: `
## Body Measurements Plugin
You can track and analyze the user's body measurements. When they ask about weight, body composition, or physical changes:
- Reference their weight trend (gaining/losing/stable)
- Compare current measurements to their starting point
- Relate body changes to their training and nutrition
- Encourage progress photos for visual tracking
`,

  routes: [
    {
      path: '/(plugins)/measurements/dashboard',
      title: 'Mesures',
      icon: 'resize-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/measurements/log',
      title: 'Nouvelle mesure',
      icon: 'add-circle-outline',
      showInTabBar: false,
    },
  ],
};

export default measurementsManifest;
