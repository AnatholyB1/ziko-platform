// P25 (MCOA-02) : decision d'etat de l'ecran Mon coach, pure (aucun import React Native).
// Un lien actif l'emporte TOUJOURS sur un apercu de code (jamais de saisie de code a un athlete lie).

export type CoachScreenState = 'loading' | 'error' | 'code' | 'preview' | 'linked';

export interface CoachStateInput {
  isLoading: boolean;
  isError: boolean;
  /** true quand une reponse (meme ancienne) existe. */
  hasData: boolean;
  hasActiveLink: boolean;
  hasPreview: boolean;
}

export function resolveCoachState(i: CoachStateInput): CoachScreenState {
  if (i.isLoading) return 'loading';
  if (i.isError && !i.hasData) return 'error';
  if (i.hasActiveLink) return 'linked';
  if (i.hasPreview) return 'preview';
  return 'code';
}

// ── Historique des coachs (MCOA-03) ────────────────────────────────────────

export interface HistoryItemRaw {
  link_id: string;
  coach_name?: string | null;
  linked_at: string;
  revoked_at: string;
}

export interface HistoryRow {
  id: string;
  name: string;
  range: string;
}

export const FORMER_COACH_NAME = 'Ancien coach';
export const HISTORY_MAX = 5;

function fr(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Lignes affichables : 5 max, jamais de nom vide, plage "du X au Y" (bornes manquantes omises). */
export function buildHistoryRows(items: HistoryItemRaw[] | null | undefined): HistoryRow[] {
  return (items ?? []).slice(0, HISTORY_MAX).map((it) => {
    const from = fr(it.linked_at);
    const to = fr(it.revoked_at);
    const range = from && to ? `du ${from} au ${to}` : to ? `jusqu'au ${to}` : from ? `depuis le ${from}` : '';
    return { id: it.link_id, name: it.coach_name?.trim() || FORMER_COACH_NAME, range };
  });
}

// ── Retrait (MCOA-03) ──────────────────────────────────────────────────────

export const REVOKE_WORD = 'COACH';

/** Saisie de confirmation : insensible aux espaces autour et a la casse (le champ force deja majuscules). */
export function isRevokeConfirmed(input: string): boolean {
  return input.trim().toUpperCase() === REVOKE_WORD;
}

export function revokeModalBody(coachName: string): string {
  return `Tu ne seras plus lié à ${coachName}. Ton historique, tes programmes et tes données sont conservés. Tu pourras te relier à tout moment avec un nouveau code.`;
}

export function revokeDoneMessage(coachName: string): string {
  return `Tu n'es plus lié à ${coachName}. Ton historique est conservé.`;
}
