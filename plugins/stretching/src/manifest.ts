import type { PluginManifest } from '@ziko/plugin-sdk';

const stretchingManifest: PluginManifest = {
  id: 'stretching',
  name: 'Stretching & Mobilité',
  version: '1.0.0',
  description:
    'Routines d\'étirement guidées pré et post-workout, minuteur intégré, recommandations IA basées sur tes muscles travaillés.',
  icon: 'body-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history'],
  userDataKeys: ['stretching'],

  aiSkills: [
    {
      name: 'stretching_recommendation',
      description:
        'Recommend stretching routines based on the user\'s last workout muscles',
      triggerKeywords: [
        'stretch', 'étirement', 'mobilité', 'mobility', 'souplesse',
        'flexibility', 'échauffement', 'warm up', 'cool down', 'récupération',
      ],
      contextProvider: () => ({ skill: 'stretching_recommendation' }),
    },
    {
      name: 'stretching_coaching',
      description:
        'Provide advice on stretching techniques, injury prevention and mobility work',
      triggerKeywords: [
        'raideur', 'stiffness', 'tension', 'douleur musculaire',
        'muscle pain', 'foam roll', 'yoga', 'posture',
      ],
      contextProvider: () => ({ skill: 'stretching_coaching' }),
    },
  ],

  aiTools: [
    {
      name: 'stretching_get_routines',
      description: 'Get available stretching routines filtered by muscle group or type (pre/post workout).',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['pre_workout', 'post_workout', 'recovery', 'full_body'], description: 'Type of routine' },
          muscle_group: { type: 'string', description: 'Target muscle group (optional)' },
        },
      },
    },
    {
      name: 'stretching_log_session',
      description: 'Log a completed stretching session.',
      parameters: {
        type: 'object',
        properties: {
          routine_id: { type: 'string', description: 'UUID of the routine completed' },
          duration_seconds: { type: 'integer', description: 'Total duration in seconds' },
        },
        required: ['duration_seconds'],
      },
    },
    {
      name: 'stretching_get_history',
      description: 'Get the user\'s recent stretching session history.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Number of days to look back (default 7)' },
        },
      },
    },
  ],

  aiSystemPromptAddition: `
## Stretching & Mobility Plugin
You can recommend stretching routines based on the user's recent workouts. When they mention tightness, soreness, or mobility:
- Suggest pre-workout dynamic stretches or post-workout static stretches
- Reference which muscles were trained recently
- Encourage regular mobility work for injury prevention
- Use the stretching tools to log and track their sessions
`,

  routes: [
    {
      path: '/(plugins)/stretching/dashboard',
      title: 'Stretching',
      icon: 'body-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/stretching/session',
      title: 'Session',
      icon: 'timer-outline',
      showInTabBar: false,
    },
  ],
};

export default stretchingManifest;
