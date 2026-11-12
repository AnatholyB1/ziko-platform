// Phase 23 (v1.20) - G-2 : plafonds de l'atelier (valeurs de depart, modifiables ici).
export const WORKSHOP_MAX_STEPS = 8;
/** Recherches web max par message utilisateur (appels absorbes, D-05). */
export const WORKSHOP_WEB_SEARCH_PER_MESSAGE = 2;
/** Recherches web max par utilisateur et par jour UTC (comptees dans ziko_ai_cost_log). */
export const WORKSHOP_WEB_SEARCH_DAILY_CAP = 20;
/** Brouillons actifs max par utilisateur (G-3). */
export const WORKSHOP_MAX_DRAFTS = 5;
/** Taille max d'un message utilisateur. */
export const WORKSHOP_MAX_MESSAGE_CHARS = 4000;
/** Taille max du contexte athlete injecte dans le prompt. */
export const WORKSHOP_CONTEXT_MAX_CHARS = 3500;
export const WORKSHOP_WEB_SEARCH_SOURCE = 'workshop_web_search';
