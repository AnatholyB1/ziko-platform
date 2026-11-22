// P25 (MCOA-03) : historique des coachs d'un athlete (liens retires), lecture seule.
// Les lignes ne sont jamais supprimees : le retrait pose `revoked_at` (et `revoked_by` via trigger).
import { createUserClient } from './db.js';

export const HISTORY_LIMIT = 5;

export type LinkHistoryRow = {
  id: string;
  coach_id: string;
  created_at: string;
  revoked_at: string;
  revoked_by: 'client' | 'coach' | null;
};

export type LinkHistoryItem = {
  link_id: string;
  coach_id: string;
  coach_name: string | null;
  linked_at: string;
  revoked_at: string;
  revoked_by: 'client' | 'coach' | null;
};

/** Pur : ne garde que les liens effectivement retires, plus recents d'abord, plafonnes. */
export function mapLinkHistory(
  rows: LinkHistoryRow[],
  names: Record<string, string | null | undefined>,
  limit: number = HISTORY_LIMIT,
): LinkHistoryItem[] {
  return rows
    .filter((r) => !!r.revoked_at)
    .sort((a, b) => Date.parse(b.revoked_at) - Date.parse(a.revoked_at))
    .slice(0, limit)
    .map((r) => {
      const raw = names[r.coach_id]?.trim();
      return {
        link_id: r.id,
        coach_id: r.coach_id,
        coach_name: raw ? raw : null,
        linked_at: r.created_at,
        revoked_at: r.revoked_at,
        revoked_by: r.revoked_by === 'client' || r.revoked_by === 'coach' ? r.revoked_by : null,
      };
    });
}

/**
 * Liens retires de l'athlete `clientId`. Le filtre `client_id` s'ajoute a la RLS (participant-read) :
 * un athlete ne voit jamais les liens d'un autre, un coach n'appelle pas cette route.
 */
export async function getLinkHistory(jwt: string, clientId: string): Promise<LinkHistoryItem[]> {
  const db = createUserClient(jwt);
  const { data: rows, error } = await db
    .from('ziko_coach_client_links')
    .select('id, coach_id, created_at, revoked_at, revoked_by')
    .eq('client_id', clientId)
    .not('revoked_at', 'is', null)
    .order('revoked_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(error.message);
  const list = (rows ?? []) as LinkHistoryRow[];
  if (list.length === 0) return [];

  const coachIds = Array.from(new Set(list.map((r) => r.coach_id)));
  const { data: profiles } = await db
    .from('ziko_coach_profiles')
    .select('user_id, display_name')
    .in('user_id', coachIds);
  const names: Record<string, string | null> = {};
  for (const p of (profiles ?? []) as { user_id: string; display_name: string | null }[]) {
    names[p.user_id] = p.display_name;
  }
  return mapLinkHistory(list, names);
}
