import type { PluginManifest } from '@ziko/plugin-sdk';

/**
 * The aiSystemPromptAddition is dynamically computed at runtime by the PluginLoader
 * using the user's stored persona settings. The static manifest returned here only
 * describes metadata, routes and permissions; the dynamic prompt injection is applied
 * in apps/mobile/src/lib/PluginLoader.tsx via buildPersonaSystemPrompt().
 */
export const personaManifest: PluginManifest = {
  id: 'persona',
  name: 'AI Persona & Habits',
  version: '1.0.0',
  description: 'Customize your AI coach's personality, name, and coaching style. Build daily habit streaks and get personalized motivational support.',
  author: 'Ziko Team',
  icon: '🧠',
  permissions: ['profile:read', 'ai:customize'],
  aiSkills: [],
  // aiSystemPromptAddition is injected dynamically from persona_settings — see PluginLoader
  routes: [
    {
      path: '/(plugins)/persona/customize',
      component: 'PersonaCustomizeScreen',
      title: 'My AI Coach',
      inTabBar: true,
      tabIcon: 'person-circle-outline',
      tabLabel: 'My Coach',
    },
  ],
};
