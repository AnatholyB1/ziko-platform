// v1.21 Phase 2 (CLAR-02) - ecran de fin d'onboarding (step-7) : n'annoncer que ce qui existe.
// Variante B du contrat (D-06) : "C'est noté." + 3 etapes "La suite". Rien de date, rien de cree.
// Logique pure (aucune dependance React/RN) pour pouvoir tester les chaines interdites.

/** Etapes de la phase de chargement (O01) : uniquement ce qui est reellement enregistre. */
export const ONBOARDING_LOAD_PHASES = [
  'Enregistrement de ton objectif',
  'Réglage de ton niveau et de ton rythme',
  'Choix de ton matériel',
  'Préparation de Ziko',
] as const;

/** Chaines retirees par CLAR-02 : elles promettaient un plan ou une seance qui n'existent pas. */
export const ONBOARDING_FORBIDDEN_TEXT = [
  'Ton plan est prêt',
  'Ton plan\nest prêt',
  'Première séance demain matin',
  'Ton programme',
  'Push / Pull / Legs',
  'Full Body Progressif',
  '8 semaines',
  'Construction de ton programme',
  'Sélection des exercices adaptés',
  'Calcul de tes besoins caloriques',
  'Calibration du coach IA',
  'Analyse de ton profil',
  '→',
] as const;

export const ONBOARDING_READY_COPY = {
  title: 'C’est noté',
  stepsLabel: 'La suite',
  steps: [
    { title: 'Une courte discussion avec Ziko', sub: 'Il règle ta première mission' },
    { title: 'Ta première mission, sur l’accueil', sub: 'Une action simple pour démarrer' },
    { title: 'Ton premier entraînement', sub: 'Manuel, séance IA ou atelier IA, à toi de choisir' },
  ],
  cta: 'Continuer',
  ctaBusy: 'Chargement…',
} as const;

export function goalName(g: string | null): string {
  const map: Record<string, string> = {
    strength: 'force', muscle_gain: 'muscle', fat_loss: 'sèche', endurance: 'cardio', health: 'forme',
  };
  return g ? (map[g] ?? 'champion') : 'champion';
}

export function goalLabel(g: string | null): string {
  const map: Record<string, string> = {
    strength: 'gagner en force',
    muscle_gain: 'prendre du muscle',
    fat_loss: 'perdre du gras',
    endurance: 'l’endurance',
    health: 'la forme générale',
  };
  return g ? (map[g] ?? 'tes objectifs') : 'tes objectifs';
}

/** "Objectif : prendre du muscle, 4 séances par semaine. Voici ce qui vient." (la partie rythme saute si inconnue). */
export function readySubtitle(goal: string | null, frequency: number | null | undefined): string {
  const f = typeof frequency === 'number' && Number.isFinite(frequency) && frequency >= 1 ? Math.round(frequency) : null;
  const rhythm = f == null ? '' : `, ${f} ${f > 1 ? 'séances' : 'séance'} par semaine`;
  return `Objectif : ${goalLabel(goal)}${rhythm}. Voici ce qui vient.`;
}
