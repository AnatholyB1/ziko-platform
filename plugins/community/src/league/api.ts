// v1.20 Phase 26 - client RPC de la Ligue. Toute ecriture passe par une RPC SECURITY DEFINER (la base decide ;
// le client n'envoie jamais un score, un palier ou une piste). Les erreurs ne sont jamais avalees : chaque fonction
// d'ecriture renvoie { ok: false, code } que l'ecran affiche (bandeau "Action non enregistree" + Reessayer).
import {
  parseCollective,
  parseLeagueState,
  type CollectiveProgress,
  type FactionKey,
  type LeagueState,
} from './rules';

export type Result<T> = ({ ok: true } & T) | { ok: false; code: string; detail?: string };

function codeOf(error: { message?: string; details?: string } | null | undefined): { code: string; detail?: string } {
  const msg = String(error?.message ?? '');
  for (const k of ['faction_cooldown', 'unknown_faction', 'not_authenticated', 'challenge_not_found', 'forbidden']) {
    if (msg.includes(k)) return { code: k, detail: error?.details };
  }
  return { code: 'network' };
}

/** Cloture des semaines echues (idempotent, en base) et lecture de l'etat. */
export async function fetchLeagueState(supabase: any, userId: string): Promise<Result<{ state: LeagueState }>> {
  try {
    const { data, error } = await supabase.rpc('ziko_league_sync', { p_user: userId });
    if (error) return { ok: false, ...codeOf(error) };
    const state = parseLeagueState(data);
    return state ? { ok: true, state } : { ok: false, code: 'bad_response' };
  } catch {
    return { ok: false, code: 'network' };
  }
}

/**
 * Porte IA (transition Habitudes -> Performance). Declenchee a l'ouverture de l'ecran : la decision (et le plafond de
 * 1 appel par jour) sont cote serveur ; sans raison d'appeler le modele, la reponse est `skipped`. Ne leve jamais.
 * Renvoie l'etat frais quand une transition vient d'etre appliquee, sinon null.
 */
export async function requestLeagueRefresh(supabase: any): Promise<LeagueState | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/league/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: '{}',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.ai === 'applied' ? parseLeagueState(body.league) : null;
  } catch {
    return null;
  }
}

export async function ackTransition(supabase: any, id: string): Promise<Result<{}>> {
  try {
    const { error } = await supabase.rpc('ziko_league_ack_transition', { p_id: id });
    return error ? { ok: false, ...codeOf(error) } : { ok: true };
  } catch {
    return { ok: false, code: 'network' };
  }
}

export interface FactionOverview {
  mine: { faction: FactionKey; joined_at: string; can_change_at: string } | null;
  counts: Record<string, number | null>;
}

export async function fetchFactionOverview(supabase: any): Promise<Result<{ overview: FactionOverview }>> {
  try {
    const { data, error } = await supabase.rpc('ziko_get_faction_overview');
    if (error) return { ok: false, ...codeOf(error) };
    const counts: Record<string, number | null> = {};
    for (const f of (data?.factions ?? []) as Array<{ key: string; member_count: unknown }>) {
      counts[f.key] = typeof f.member_count === 'number' ? f.member_count : null;
    }
    return { ok: true, overview: { mine: data?.mine ?? null, counts } };
  } catch {
    return { ok: false, code: 'network' };
  }
}

export async function joinFaction(supabase: any, faction: FactionKey): Promise<Result<{ canChangeAt: string | null }>> {
  try {
    const { data, error } = await supabase.rpc('ziko_join_faction', { p_faction: faction });
    if (error) return { ok: false, ...codeOf(error) };
    return { ok: true, canChangeAt: data?.can_change_at ?? null };
  } catch {
    return { ok: false, code: 'network' };
  }
}

export async function listCollective(supabase: any): Promise<Result<{ items: CollectiveProgress[] }>> {
  try {
    const { data: list, error } = await supabase.rpc('ziko_list_collective_challenges');
    if (error) return { ok: false, ...codeOf(error) };
    const items: CollectiveProgress[] = [];
    for (const row of (Array.isArray(list) ? list : []) as Array<{ id: string; my_status: string | null }>) {
      // Progression du groupe (total + MA contribution uniquement : la base ne renvoie jamais celle d'un autre).
      const { data: prog } = await supabase.rpc('ziko_collective_progress', { p_id: row.id });
      const parsed = parseCollective({ ...(prog ?? {}), my_status: (prog ?? {}).my_status ?? row.my_status });
      if (parsed) items.push(parsed);
    }
    return { ok: true, items };
  } catch {
    return { ok: false, code: 'network' };
  }
}

export async function respondCollective(supabase: any, id: string, accept: boolean): Promise<Result<{ status: string }>> {
  try {
    const { data, error } = await supabase.rpc('ziko_respond_collective_challenge', { p_id: id, p_accept: accept });
    return error ? { ok: false, ...codeOf(error) } : { ok: true, status: String(data) };
  } catch {
    return { ok: false, code: 'network' };
  }
}
