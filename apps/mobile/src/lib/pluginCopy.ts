// Descriptions du store en francais (run5 : "Track your daily goals..." encore en anglais). Le registre
// `ziko_plugins_registry` (seed historique) porte l'ancien texte anglais de 3 modules et on ne reecrit pas
// une migration existante : le client impose le libelle francais pour ces ids, quel que soit le registre.

const FR_DESCRIPTIONS: Record<string, string> = {
  habits:
    "Suis tes objectifs du jour : eau, séances, sommeil, nutrition et habitudes personnalisées. Rappels intelligents, séries à célébrer, relié à ton coach IA, à ton historique d'entraînement et à la nutrition.",
  nutrition:
    "Suis ton alimentation au quotidien : enregistre tes repas, surveille tes macros et reçois des conseils nutritionnels IA adaptés à tes objectifs.",
  persona:
    "Personnalise la personnalité, le nom et le style de ton coach IA. Construis des séries d'habitudes et reçois un soutien motivant sur mesure.",
};

const LATIN_EN_HINT = /\b(the|your|and|track|get|with|to)\b/i;

/** Description a afficher : francais impose pour les modules connus, sinon celle du registre. */
export function storeDescription(pluginId: string, description: string | null | undefined): string {
  const fr = FR_DESCRIPTIONS[pluginId];
  if (fr) return fr;
  return String(description ?? '');
}

/** Garde pour les tests : une description visible en francais ne doit pas ressembler a de l'anglais. */
export function looksEnglish(s: string): boolean {
  return LATIN_EN_HINT.test(s) && !/[àâçéèêëîïôûùüœ]/i.test(s);
}
