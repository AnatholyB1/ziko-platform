// Mon coach, etat C (lie) : logique pure de presentation (COACH-01). Aucun import React Native.

export interface LinkedPreview {
  display_name?: string | null;
  specialties?: string[] | null;
  photo_signed_url?: string | null;
  kyc_status?: 'pending' | 'submitted' | 'verified' | 'rejected' | null;
}

export interface LinkedData {
  link: { id: string; created_at: string } | null;
  preview?: LinkedPreview | null;
  branding?: { logo_url?: string | null } | null;
}

export const GENERIC_COACH_NAME = 'Ton coach';

export interface LinkedView {
  name: string;
  /** true quand le profil du coach est indisponible (lien actif sans `preview`). */
  degraded: boolean;
  kycVerified: boolean;
  specialties: string[];
  photoUrl: string | null;
  logoPath: string | null;
  since: string | null;
}

/** "3 oct. 2026" */
export function formatSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * Jamais d'ecran vide : avec un lien actif, on affiche toujours une carte. Le nom vient du
 * profil, sinon libelle generique ; le badge KYC seulement si le statut est « verified ».
 */
export function resolveLinkedView(data: LinkedData | null | undefined): LinkedView | null {
  if (!data?.link) return null;
  const preview = data.preview ?? null;
  const rawName = preview?.display_name?.trim();
  return {
    name: rawName ? rawName : GENERIC_COACH_NAME,
    degraded: !preview,
    kycVerified: preview?.kyc_status === 'verified',
    specialties: Array.isArray(preview?.specialties) ? (preview!.specialties as string[]).filter(Boolean) : [],
    photoUrl: preview?.photo_signed_url ?? null,
    logoPath: data.branding?.logo_url ?? null,
    since: formatSince(data.link.created_at),
  };
}
