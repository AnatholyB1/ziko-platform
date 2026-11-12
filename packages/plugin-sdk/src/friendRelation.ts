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

// ── Libelles du profil / des listes ──────────────────────────

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** `Aujourd'hui` / `Hier` / `Lundi` (moins de 7 jours) / `12 nov.` : date relative d'un entrainement. */
export function relativeDayLabel(input: string | number | Date | null | undefined, now: Date = new Date()): string {
  if (input === null || input === undefined || input === '') return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / DAY_MS);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7) return WEEKDAYS[d.getDay()];
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** `12 jours restants` / `1 jour restant` / `Dernier jour` / `Terminé` pour un defi (date de fin `YYYY-MM-DD`). */
export function daysLeftLabel(endDate: string | null | undefined, now: Date = new Date()): string {
  if (!endDate) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(endDate);
  if (!m) return '';
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const left = Math.round((end - today) / DAY_MS);
  if (left < 0) return 'Terminé';
  if (left === 0) return 'Dernier jour';
  return left === 1 ? '1 jour restant' : `${left} jours restants`;
}

/** `5 jours` / `1 jour` / `aucune série` pour la serie du profil. */
export function streakLabel(days: number): string {
  if (!days || days <= 0) return 'aucune série';
  return days === 1 ? '1 jour' : `${days} jours`;
}
