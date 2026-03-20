import type { PluginManifest } from '@ziko/plugin-sdk';

const gamificationManifest: PluginManifest = {
  id: 'gamification',
  name: 'Récompenses',
  version: '1.0.0',
  description:
    'Gagne de l\'XP et des pièces en t\'entraînant et en complétant tes habitudes. Monte de niveau et débloque des objets dans la boutique !',
  icon: 'trophy',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile', 'read_workout_history'],
  userDataKeys: ['gamification'],

  aiSkills: [
    {
      name: 'gamification_info',
      description:
        'Answer questions about user level, XP, coins, streak, and shop items',
      triggerKeywords: [
        'level', 'niveau', 'xp', 'experience', 'coins', 'pièces',
        'streak', 'série', 'boutique', 'shop', 'récompense', 'reward',
        'badge', 'titre', 'title',
      ],
      contextProvider: () => ({ skill: 'gamification_info' }),
    },
  ],

  routes: [
    {
      path: '/(plugins)/gamification/dashboard',
      title: 'Récompenses',
      icon: 'trophy',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/gamification/shop',
      title: 'Boutique',
      icon: 'cart',
      showInTabBar: false,
    },
  ],
};

export default gamificationManifest;
