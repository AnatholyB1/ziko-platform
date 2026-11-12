// ============================================================
// friendRelation (v1.20 P21, SOC-04/05) : source unique de l'etat d'amitie cote client.
// Fonctions pures, sans dependance native, testables sous vitest.
// Contrat de design lot D : un seul bouton d'etat, 4 etats (D-02) :
//   none (Ajouter) / sent (Envoyee | Demande envoyee) / received (Accepter + Refuser) / friend (Ami).
// ============================================================

export type FriendRelation = 'none' | 'sent' | 'received' | 'friend';

/** Relation renvoyee par le serveur (`self` = son propre profil). */
export type ServerRelation = FriendRelation | 'self';

export interface FriendshipLike {
  id?: string;
  requester_id: string;
  addressee_id: string;
  status: string;
}

const PRECEDENCE: Record<FriendRelation, number> = { friend: 3, received: 2, sent: 1, none: 0 };

/**
 * Relation de `me` envers `other` a partir des lignes d'amitie connues.
 * Tolere les doublons croises herites (A->B et B->A) : friend > received > sent > none, de sorte
 * que l'utilisateur voie `Accepter` plutot que `Envoyee` quand l'autre a deja demande.
 */
export function deriveRelation(me: string, other: string, rows: readonly FriendshipLike[]): FriendRelation {
  let best: FriendRelation = 'none';
  for (const r of rows) {
    const involvesPair =
      (r.requester_id === me && r.addressee_id === other) || (r.requester_id === other && r.addressee_id === me);
    if (!involvesPair) continue;
    let rel: FriendRelation = 'none';
    if (r.status === 'accepted') rel = 'friend';
    else if (r.status === 'pending') rel = r.requester_id === me ? 'sent' : 'received';
    if (PRECEDENCE[rel] > PRECEDENCE[best]) best = rel;
  }
  return best;
}

/** Normalise une relation serveur (jamais d'etat inconnu : retombe sur `none`). */
export function normalizeRelation(value: unknown): FriendRelation {
  return value === 'friend' || value === 'sent' || value === 'received' ? value : 'none';
}

export type RelationContext = 'list' | 'profile';

export interface RelationView {
  /** Libelle du bouton principal (mot + icone portent l'etat, pas la couleur seule). */
  label: string;
  icon: string; // nom Ionicons
  kind: 'primary' | 'neutral' | 'success';
  /** `Refuser` affiche a cote d'`Accepter` (etat received) */
  showDecline: boolean;
  /** Libelle d'accessibilite complet (etats abreges). */
  a11yLabel: string;
}

/** Presentation d'un etat : identique sur la ligne de resultat, la recherche globale et le profil. */
export function relationView(relation: FriendRelation, name: string, context: RelationContext = 'list'): RelationView {
  const who = name && name.trim() ? name.trim() : 'cet utilisateur';
  switch (relation) {
    case 'sent':
      return {
        label: context === 'profile' ? 'Demande envoyée' : 'Envoyée',
        icon: 'time-outline',
        kind: 'neutral',
        showDecline: false,
        a11yLabel: `Demande envoyée à ${who}, appuyer pour annuler`,
      };
    case 'received':
      return { label: 'Accepter', icon: 'checkmark', kind: 'primary', showDecline: true, a11yLabel: `Accepter la demande de ${who}` };
    case 'friend':
      return { label: 'Ami', icon: 'checkmark-circle', kind: 'success', showDecline: false, a11yLabel: `${who} fait partie de tes amis` };
    default:
      return { label: 'Ajouter', icon: 'person-add', kind: 'primary', showDecline: false, a11yLabel: `Ajouter ${who} en ami` };
  }
}

// ── Recherche en direct (D-01) ───────────────────────────────

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 250;

/** La recherche ne part qu'a partir de 2 caracteres (hors espaces de bord). */
export function shouldSearch(query: string | null | undefined): boolean {
  return (query ?? '').trim().length >= SEARCH_MIN_CHARS;
}

/** `1 résultat` / `4 résultats` (compteur sous le champ). */
export function resultCountLabel(n: number): string {
  return n === 1 ? '1 résultat' : `${n} résultats`;
}

// ── Textes ───────────────────────────────────────────────────

/** Toast apres envoi : `Demande envoyée à Marco Delmas` (texte propre, SOC-08). */
export function requestSentToast(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  return n ? `Demande envoyée à ${n}` : 'Demande envoyée';
}

/** Bandeau d'echec (D04) : aucun etat faux, rien n'a ete envoye. */
export function requestFailedBanner(name: string | null | undefined): { title: string; message: string } {
  const n = (name ?? '').trim();
  return {
    title: 'Demande non envoyée',
    message: `Vérifie ta connexion puis réessaie. Rien n'a été envoyé${n ? ` à ${n}` : ''}.`,
  };
}

/** Initiales d'avatar (jamais de photo) : `Marco Delmas` -> `MD`. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
}
