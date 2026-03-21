import type { PluginManifest } from '@ziko/plugin-sdk';

const communityManifest: PluginManifest = {
  id: 'community',
  name: 'Communauté',
  version: '1.0.0',
  description:
    'Invite tes amis, discute en chat, partage des programmes, lance des défis 1v1 ou en équipe, encourage les habitudes de tes potes et envoie-leur de l\'XP ou des pièces !',
  icon: 'people',
  category: 'social',
  price: 'free',
  requiredPermissions: [
    'read_profile',
    'read_workout_history',
    'read_community',
    'write_community',
    'notifications',
  ],
  userDataKeys: ['community'],

  aiSkills: [
    {
      name: 'community_info',
      description:
        'Answer questions about friends, challenges, community stats and social features',
      triggerKeywords: [
        'ami', 'friend', 'communauté', 'community', 'défi', 'challenge',
        'équipe', 'team', '1v1', 'classement', 'leaderboard', 'inviter',
        'invite', 'chat', 'message', 'encourager',
      ],
      contextProvider: () => ({ skill: 'community_info' }),
    },
  ],

  aiSystemPromptAddition: `
## Community Plugin
You have access to the user's community data. When they ask about friends, challenges, or social features:
- Reference their active challenges and leaderboard positions
- Mention friends' workout streaks or stats when comparing
- Suggest creating challenges or encouraging friends
- Help compose invitation or encouragement messages
`,

  routes: [
    {
      path: '/(plugins)/community/dashboard',
      title: 'Communauté',
      icon: 'people',
      showInTabBar: true,
    },
    {
      path: '/(plugins)/community/friends',
      title: 'Amis',
      icon: 'person-add',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/community/chat',
      title: 'Messages',
      icon: 'chatbubbles',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/community/conversation',
      title: 'Chat',
      icon: 'chatbubble',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/community/challenges',
      title: 'Défis',
      icon: 'trophy',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/community/challenge-detail',
      title: 'Défi',
      icon: 'trophy',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/community/create-challenge',
      title: 'Nouveau Défi',
      icon: 'add-circle',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/community/compare',
      title: 'Comparer',
      icon: 'stats-chart',
      showInTabBar: false,
    },
    {
      path: '/(plugins)/community/invite',
      title: 'Inviter',
      icon: 'share',
      showInTabBar: false,
    },
  ],
};

export default communityManifest;
