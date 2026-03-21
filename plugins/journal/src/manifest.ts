import type { PluginManifest } from '@ziko/plugin-sdk';

const journalManifest: PluginManifest = {
  id: 'journal',
  name: 'Journal & Mindset',
  version: '1.0.0',
  description:
    'Journal d\'humeur pré/post séance, suivi du stress et de l\'énergie mentale. Notes motivationnelles et réflexions quotidiennes.',
  icon: 'journal-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history'],
  userDataKeys: ['journal'],

  aiSkills: [
    {
      name: 'mood_analysis',
      description: 'Analyze mood patterns and correlate with workout performance and habits',
      triggerKeywords: [
        'humeur', 'mood', 'énergie', 'energy', 'motivation',
        'moral', 'stress', 'anxiété', 'anxiety', 'mental',
        'journal', 'feeling', 'ressenti',
      ],
      contextProvider: () => ({ skill: 'mood_analysis' }),
    },
    {
      name: 'mindset_coaching',
      description: 'Provide mental coaching, motivation tips and mindset advice',
      triggerKeywords: [
        'démotivé', 'unmotivated', 'abandonner', 'give up',
        'confiance', 'confidence', 'mindset', 'mental',
        'positif', 'positive', 'gratitude',
      ],
      contextProvider: () => ({ skill: 'mindset_coaching' }),
    },
  ],

  aiTools: [
    {
      name: 'journal_log_mood',
      description: 'Log a mood/mindset entry.',
      parameters: {
        type: 'object',
        properties: {
          mood: { type: 'integer', description: 'Mood 1-5 (1=bad, 5=great)' },
          energy: { type: 'integer', description: 'Energy level 1-5' },
          stress: { type: 'integer', description: 'Stress level 1-5 (1=low, 5=high)' },
          context: { type: 'string', enum: ['pre_workout', 'post_workout', 'morning', 'evening', 'general'], description: 'When this entry was logged' },
          notes: { type: 'string', description: 'Free text notes' },
        },
        required: ['mood'],
      },
    },
    {
      name: 'journal_get_history',
      description: 'Get the user\'s mood journal history.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of days (default 7)' },
        },
      },
    },
    {
      name: 'journal_get_trends',
      description: 'Get mood, energy and stress trends over time.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of days (default 30)' },
        },
      },
    },
  ],

  aiSystemPromptAddition: `
## Journal & Mindset Plugin
You can track the user's mood, energy and stress levels. When they mention mental state or motivation:
- Reference their recent mood trends
- Correlate mood with workout days (often better mood post-workout)
- Offer gratitude exercises or breathing techniques for stress
- Encourage consistent journaling for self-awareness
`,

  routes: [
    {
      path: '/(plugins)/journal/dashboard',
      title: 'Journal',
      icon: 'journal-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/journal/entry',
      title: 'Nouvelle entrée',
      icon: 'add-circle-outline',
      showInTabBar: false,
    },
  ],
};

export default journalManifest;
