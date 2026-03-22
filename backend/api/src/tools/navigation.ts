// ── Tool: app_navigate ──────────────────────────────────────
// This tool allows the AI agent to navigate the user to any screen
// in the mobile app. The actual navigation happens client-side;
// the backend just validates and returns the action payload.

/** All navigable screens with their accepted params */
export const NAVIGABLE_SCREENS: Record<string, { label: string; params?: string[] }> = {
  // Timer
  timer_dashboard: { label: 'Timer', params: ['autoStartPresetId'] },
  timer_editor: { label: 'Éditeur chrono', params: ['presetId'] },
  timer_manager: { label: 'Gérer les chronos' },
  // Cardio
  cardio_dashboard: { label: 'Cardio' },
  cardio_log: { label: 'Log cardio', params: ['prefill_activity', 'prefill_duration', 'prefill_calories', 'prefill_notes'] },
  // Habits
  habits_dashboard: { label: 'Habitudes' },
  habits_log: { label: 'Log habitude' },
  // Nutrition
  nutrition_dashboard: { label: 'Nutrition' },
  nutrition_log: { label: 'Log repas' },
  // Sleep
  sleep_dashboard: { label: 'Sommeil' },
  sleep_log: { label: 'Log sommeil' },
  // Stretching
  stretching_dashboard: { label: 'Stretching' },
  // Measurements
  measurements_dashboard: { label: 'Mesures corporelles' },
  measurements_log: { label: 'Log mesures' },
  // Journal
  journal_dashboard: { label: 'Journal' },
  journal_entry: { label: 'Nouvelle entrée journal' },
  // Hydration
  hydration_dashboard: { label: 'Hydratation' },
  // AI Programs
  ai_programs_dashboard: { label: 'Programmes IA' },
  ai_programs_generate: { label: 'Générer programme' },
  // Stats
  stats_dashboard: { label: 'Statistiques' },
  // Gamification
  gamification_dashboard: { label: 'Récompenses' },
  gamification_shop: { label: 'Boutique' },
  // Community
  community_dashboard: { label: 'Communauté' },
  community_friends: { label: 'Amis' },
  community_challenges: { label: 'Défis' },
  // Core
  workout_home: { label: 'Entraînement' },
  profile: { label: 'Profil' },
};

export async function app_navigate(
  params: Record<string, unknown>,
  _userId: string,
): Promise<unknown> {
  const screen = params.screen as string;
  let navParams: Record<string, string> = {};

  if (!screen) throw new Error('screen is required');
  if (!NAVIGABLE_SCREENS[screen]) {
    throw new Error(`Unknown screen: ${screen}. Valid screens: ${Object.keys(NAVIGABLE_SCREENS).join(', ')}`);
  }

  // Parse params — can be a JSON string or an object
  if (params.params) {
    if (typeof params.params === 'string') {
      try { navParams = JSON.parse(params.params); } catch { /* ignore */ }
    } else if (typeof params.params === 'object') {
      navParams = params.params as Record<string, string>;
    }
  }

  return {
    success: true,
    message: `Navigating user to ${NAVIGABLE_SCREENS[screen].label}`,
    _action: {
      type: 'navigate',
      screen,
      params: navParams,
    },
  };
}
