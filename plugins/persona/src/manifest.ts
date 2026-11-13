import type { PluginManifest } from '@ziko/plugin-sdk';

/**
 * The aiSystemPromptAddition is dynamically computed at runtime by the PluginLoader
 * using the user's stored persona settings. The static manifest returned here only
 * describes metadata, routes and permissions; the dynamic prompt injection is applied
 * in apps/mobile/src/lib/PluginLoader.tsx via buildPersonaSystemPrompt().
 */
const personaManifest: PluginManifest = {
  id: 'persona',
  /** Progressive unlock: athlete level required (1-5). */
  minLevel: 2,
  name: 'AI Persona & Habits',
  version: '1.0.0',
  description: "Personnalise la personnalité, le nom et le style de ton coach IA. Construis des séries d'habitudes et reçois un soutien motivant sur mesure.",
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
      title: 'Mon coach IA',
      icon: 'person-circle-outline',
      showInTabBar: true,
    },
  ],
};

export default personaManifest;
