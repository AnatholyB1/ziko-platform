import type { PluginManifest } from '@ziko/plugin-sdk';

/**
 * The aiSystemPromptAddition is dynamically computed at runtime by the PluginLoader
 * using the user's stored persona settings. The static manifest returned here only
 * describes metadata, routes and permissions; the dynamic prompt injection is applied
 * in apps/mobile/src/lib/PluginLoader.tsx via buildPersonaSystemPrompt().
 */
const personaManifest: PluginManifest = {
  id: 'persona',
  name: 'AI Persona & Habits',
  version: '1.0.0',
  description: "Customize your AI coach's personality, name, and coaching style. Build daily habit streaks and get personalised motivational support.",
  icon: 'person-circle-outline',
  category: 'persona',
  price: 'free',
  requiredPermissions: ['read_profile', 'write_profile'],
  userDataKeys: ['persona'],
  aiSkills: [],
  // aiSystemPromptAddition is injected dynamically from persona_settings — see PluginLoader
  routes: [
    {
      path: '/(plugins)/persona/customize',
      title: 'My AI Coach',
      icon: 'person-circle-outline',
      showInTabBar: true,
    },
  ],
};

export default personaManifest;
