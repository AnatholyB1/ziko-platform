// Retour utilisateur apres `startPlannedSession` (run4 P24). Pur : les ecrans l'appliquent.
// - demarre avec des exercices non resolus -> seance ouverte + toast neutre qui les liste ;
// - AUCUN exercice resolu / pas de seance -> alerte claire avec lien vers l'edition du programme.

export type PlannedStartResult =
  | { ok: true; unresolved?: string[]; replaced?: Array<{ from: string; to: string }> }
  | { ok: false; reason: string; unresolved?: string[] };

export interface PlannedStartFeedback {
  navigate: boolean;
  /** Message bref non bloquant (la seance est ouverte). Compact : un toast natif tronque au-dela de 2 lignes. */
  toast?: string;
  /** Liste complete (tous les remplacements / exercices ignores), quand le toast est un resume : annonce accessible / alerte. */
  toastDetail?: string;
  /** Alerte avec action "Modifier le programme" (rien n'a demarre). */
  alert?: { title: string; message: string; editLabel: string };
}

const MAX_LISTED = 3;

export function plannedStartFeedback(res: PlannedStartResult): PlannedStartFeedback {
  if (res.ok) {
    const un = res.unresolved ?? [];
    const rep = res.replaced ?? [];
    const parts: string[] = [];
    const detailParts: string[] = [];
    if (rep.length > 0) {
      // Resume compact : le premier remplacement + "+N" ; la liste complete reste disponible dans toastDetail.
      const first = `${rep[0].from} par ${rep[0].to}`;
      const more = rep.length > 1 ? ` +${rep.length - 1}` : '';
      parts.push(`${rep.length === 1 ? 'Exercice remplacé' : `${rep.length} exercices remplacés`} : ${first}${more}`);
      detailParts.push(
        `${rep.length === 1 ? 'Exercice remplacé' : 'Exercices remplacés'} : ${rep.map((r) => `${r.from} par ${r.to}`).join(', ')}`,
      );
    }
    if (un.length > 0) {
      const shown = un.slice(0, MAX_LISTED).join(', ');
      const more = un.length > MAX_LISTED ? ` +${un.length - MAX_LISTED}` : '';
      parts.push(`${un.length} exercice${un.length > 1 ? 's' : ''} non reconnu${un.length > 1 ? 's' : ''} ignoré${un.length > 1 ? 's' : ''} : ${shown}${more}`);
    }
    if (parts.length === 0) return { navigate: true };
    const toast = parts.join(' · ');
    // L'inconnu reste identique entre resume et detail.
    if (un.length > 0) detailParts.push(parts[parts.length - 1]);
    const toastDetail = detailParts.join(' · ');
    return toastDetail !== toast ? { navigate: true, toast, toastDetail } : { navigate: true, toast };
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
  toast: (message: string, detail?: string) => void;
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
  if (fb.toast) deps.toast(fb.toast, fb.toastDetail);
}

/**
 * Retour apres `startGeneratedSession` (seance IA simple, UATN-03) : meme regle que la seance planifiee pour les
 * exercices ignores/remplaces ; sans exercice charge, aucune navigation (jamais de "Seance rapide" vide) et un
 * message qui propose de regenerer plutot que d'editer un programme.
 */
export function generatedStartFeedback(res: PlannedStartResult): PlannedStartFeedback {
  if (res.ok) return plannedStartFeedback(res);
  const un = res.unresolved ?? [];
  const detail = un.length > 0 ? ` (${un.slice(0, MAX_LISTED).join(', ')})` : '';
  return {
    navigate: false,
    alert: {
      title: 'Séance indisponible',
      message:
        res.reason === 'no_exercises'
          ? `Aucun exercice de cette séance n'a été trouvé dans le catalogue${detail}. Régénère la séance.`
          : 'Impossible de démarrer la séance. Vérifie ta connexion puis réessaie.',
      editLabel: 'Régénérer',
    },
  };
}
