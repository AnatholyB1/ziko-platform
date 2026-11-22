// Phase 24 (v1.20) - G-2 : plafonds de la relance automatique (valeurs de depart, modifiables ici).
/** Appels IA automatiques (propositions de programme suivant) par utilisateur et par jour UTC (D-08). */
export const PROGRAM_RELAUNCH_DAILY_CAP = 1;
/** Un `proposing` plus vieux que cela est repris (le worker precedent a ete coupe). */
export const PROGRAM_RELAUNCH_STALE_MS = 3 * 60 * 1000;
/** Valeur de `ziko_ai_cost_log.source` des appels automatiques de relance. */
export const PROGRAM_RELAUNCH_COST_SOURCE = 'program_relaunch';
