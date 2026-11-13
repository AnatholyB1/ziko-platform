// Retour utilisateur apres `startPlannedSession` (run4 P24). Pur : les ecrans l'appliquent.
// - demarre avec des exercices non resolus -> seance ouverte + toast neutre qui les liste ;
// - AUCUN exercice resolu / pas de seance -> alerte claire avec lien vers l'edition du programme.

export type PlannedStartResult =
  | { ok: true; unresolved?: string[] }
  | { ok: false; reason: string; unresolved?: string[] };

export interface PlannedStartFeedback {
  navigate: boolean;
  /** Message bref non bloquant (la seance est ouverte). */
  toast?: string;
  /** Alerte avec action "Modifier le programme" (rien n'a demarre). */
  alert?: { title: string; message: string; editLabel: string };
}

const MAX_LISTED = 3;

export function plannedStartFeedback(res: PlannedStartResult): PlannedStartFeedback {
  if (res.ok) {
    const un = res.unresolved ?? [];
    if (un.length === 0) return { navigate: true };
    const shown = un.slice(0, MAX_LISTED).join(', ');
    const more = un.length > MAX_LISTED ? ` +${un.length - MAX_LISTED}` : '';
    return {
      navigate: true,
      toast: `${un.length === 1 ? 'Exercice absent du catalogue, ignoré' : 'Exercices absents du catalogue, ignorés'} : ${shown}${more}`,
    };
  }
  const un = res.unresolved ?? [];
  if (res.reason === 'no_exercises' && un.length > 0) {
    return {
      navigate: false,
      alert: {
        title: 'Séance indisponible',
        message: `Aucun exercice de la séance n'a été trouvé dans le catalogue (${un.slice(0, MAX_LISTED).join(', ')}). Modifie le programme pour choisir des exercices existants.`,
        editLabel: 'Modifier le programme',
      },
    };
  }
  return {
    navigate: false,
    alert: {
      title: 'Séance indisponible',
      message: "Impossible de démarrer la séance prévue. Ouvre ton programme pour la vérifier.",
      editLabel: 'Modifier le programme',
    },
  };
}

export interface FeedbackDeps {
  /** Toast neutre non bloquant (ToastAndroid / showAlert selon la plateforme). */
  toast: (message: string) => void;
  alert: (
    title: string,
    message: string,
    buttons: Array<{ text: string; style?: 'cancel' | 'default' | 'destructive'; onPress?: () => void }>,
  ) => void;
  openEdit: () => void;
  openSession: () => void;
}

/** Applique le retour : ouvre la seance (+ toast) ou affiche l'alerte avec le lien d'edition. */
export function applyPlannedStartFeedback(res: PlannedStartResult, deps: FeedbackDeps): void {
  const fb = plannedStartFeedback(res);
  if (fb.alert) {
    deps.alert(fb.alert.title, fb.alert.message, [
      { text: fb.alert.editLabel, onPress: deps.openEdit },
      { text: 'Fermer', style: 'cancel' },
    ]);
    return;
  }
  if (fb.navigate) deps.openSession();
  if (fb.toast) deps.toast(fb.toast);
}
