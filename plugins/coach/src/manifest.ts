import type { PluginManifest } from '@ziko/plugin-sdk';

const coachManifest: PluginManifest = {
  id: 'coach',
  name: 'Mon coach',
  version: '1.0.0',
  description: 'Connecte-toi à ton coach personnel.',
  icon: 'person-outline',
  category: 'coaching',
  price: 'free',
  requiredPermissions: ['read_profile'],
  userDataKeys: ['coach_link'],
  aiSkills: [],
  aiTools: [],
  mandatory: true,
  routes: [
    {
      path: '/(plugins)/coach/dashboard',
      title: 'Mon coach',
      icon: 'person-outline',
      showInTabBar: false,
    },
  ],
};

export default coachManifest;
