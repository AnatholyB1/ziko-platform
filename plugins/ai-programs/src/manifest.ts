import type { PluginManifest } from '@ziko/plugin-sdk';

const aiProgramsManifest: PluginManifest = {
  id: 'ai-programs',
  name: 'Programmes IA',
  version: '1.0.0',
  description:
    'Génération automatique de programmes d\'entraînement par l\'IA selon ton profil et ton objectif. Progression automatique et adaptation intelligente.',
  icon: 'sparkles-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history', 'write_workout'],
  userDataKeys: ['ai-programs'],

  aiSkills: [
    {
      name: 'program_generation',
      description: 'Generate personalized workout programs based on user profile, goals, and available equipment',
      triggerKeywords: [
        'programme', 'program', 'plan', 'routine', 'split',
        'PPL', 'push pull', 'full body', 'upper lower',
        'générer', 'generate', 'créer un programme', 'create program',
      ],
      contextProvider: () => ({ skill: 'program_generation' }),
    },
    {
      name: 'program_adaptation',
      description: 'Adapt and progress existing programs based on performance data',
      triggerKeywords: [
        'adapter', 'adapt', 'progression', 'augmenter', 'increase',
        'plateau', 'stagnation', 'trop facile', 'too easy', 'trop dur', 'too hard',
        'modifier programme', 'change program',
      ],
      contextProvider: () => ({ skill: 'program_adaptation' }),
    },
  ],

  aiTools: [
    {
      name: 'ai_programs_generate',
      description: 'Generate a personalized workout program using AI.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', enum: ['muscle_gain', 'fat_loss', 'strength', 'endurance', 'general_fitness'], description: 'Training goal' },
          days_per_week: { type: 'integer', description: 'Training days per week (2-6)' },
          split_type: { type: 'string', enum: ['full_body', 'upper_lower', 'ppl', 'bro_split', 'custom'], description: 'Program split type' },
          experience_level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: 'User experience level' },
          equipment: { type: 'string', enum: ['full_gym', 'home', 'bodyweight', 'dumbbells_only'], description: 'Available equipment' },
        },
        required: ['goal', 'days_per_week'],
      },
    },
    {
      name: 'ai_programs_list',
      description: 'List all AI-generated programs for the user.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'ai_programs_adjust',
      description: 'Adjust difficulty of an AI-generated program based on feedback.',
      parameters: {
        type: 'object',
        properties: {
          program_id: { type: 'string', description: 'Program UUID' },
          adjustment: { type: 'string', enum: ['easier', 'harder', 'more_volume', 'less_volume'], description: 'Type of adjustment' },
        },
        required: ['program_id', 'adjustment'],
      },
    },
  ],

  aiSystemPromptAddition: `
## AI Programs Plugin
You can generate entire workout programs personalized to the user. When they ask for a program:
- Ask about their goal, experience level, available days, and equipment
- Generate structured programs with exercises, sets, reps, and rest times
- Consider their recent workout history for appropriate difficulty
- Offer to adjust programs if they find them too easy or hard
- Support common splits: Full Body, Upper/Lower, Push/Pull/Legs, Bro Split
`,

  routes: [
    {
      path: '/(plugins)/ai-programs/dashboard',
      title: 'Programmes IA',
      icon: 'sparkles-outline',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/ai-programs/generate',
      title: 'Générer',
      icon: 'add-circle-outline',
      showInTabBar: false,
    },
  ],
};

export default aiProgramsManifest;
