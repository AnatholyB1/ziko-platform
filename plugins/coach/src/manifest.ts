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
  aiTools: [
    {
      name: 'coach_get_link',
      description: 'Check coach link status. Returns coach name, specialties, KYC verification, and link date when linked.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'coach_revoke_link',
      description: 'Unlink current coach. IMPORTANT: Always ask for explicit user confirmation before calling with confirmed: true.',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean', description: 'Must be true after user explicitly agrees' },
        },
        required: ['confirmed'],
      },
    },
  ],
  aiSystemPromptAddition: 'User has a Mon coach plugin installed. Use coach_get_link to check their current coach link status. To unlink their coach, use coach_revoke_link with { confirmed: true } — but only after the user explicitly agrees.',
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
