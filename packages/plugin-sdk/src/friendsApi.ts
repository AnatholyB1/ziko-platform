// ============================================================
// friendsApi (v1.20 P21) : acces donnees Amis / profil public via les RPC de la migration
// 202612012102 / 202612012103. Client supabase injecte (any) : testable sans reseau.
// L'identite de l'appelant est TOUJOURS auth.uid() cote serveur (aucun id appelant en parametre).
// ============================================================

import { deriveRelation, normalizeRelation, type FriendRelation, type ServerRelation } from './friendRelation';
import { goalLabel } from './displayLabels';

// ── Types ────────────────────────────────────────────────────

export interface FriendSearchResult {
  id: string;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  goal: string | null;
  relation: FriendRelation;
  friendship_id: string | null;
}

export interface FriendshipEntry {
  friendship_id: string;
  other_id: string;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  goal: string | null;
  level: number | null;
  status: 'pending' | 'accepted';
  direction: 'sent' | 'received';
  created_at: string;
}

export interface PublicProfileBadge { slug: string; name: string; icon: string; tier: number | null; earned_at: string | null }
export interface PublicProfileWorkout { id: string; name: string | null; started_at: string; duration_min: number | null; total_exercises: number | null; total_sets: number | null }
export interface PublicProfileRecord { exercise_id: string; exercise_name: string | null; weight_kg: number; achieved_at: string | null }
export interface PublicProfileChallenge { id: string; title: string; status: string; end_date: string | null }

/** Champs strictement bornes au contrat (jamais de donnee de sante / poids). */
export interface PublicProfile {
  id: string;
  name: string;
  handle: string | null;
  goal: string | null;
  relation: ServerRelation;
  friendship_id: string | null;
  friends_count: number;
  followers_count: number;
  level: number | null;
  xp: number | null;
  next_level: number | null;
  xp_to_next: number | null;
  streak: number;
  badges: PublicProfileBadge[];
  badges_total: number;
  recent_workouts: PublicProfileWorkout[];
  records: PublicProfileRecord[];
  common_challenges: PublicProfileChallenge[];
}

export type SendOutcome =
  | { ok: true; relation: FriendRelation; friendshipId: string | null; created: boolean; autoAccepted: boolean }
  | { ok: false; reason: 'session' | 'self' | 'not_found' | 'network' | 'unknown'; message: string };

// ── Erreurs ──────────────────────────────────────────────────

const SESSION_MSG = 'Ta session a expiré. Reconnecte-toi pour continuer.';

function isMissingFunction(error: any): boolean {
  const code = String(error?.code ?? '');
  return code === '42883' || code === 'PGRST202' || /could not find the function|does not exist/i.test(String(error?.message ?? ''));
}

function isNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message ?? error);
  return !error.code && /network|fetch|timed? ?out|offline|failed to/i.test(msg);
}

/** Convertit une erreur Postgres/PostgREST en issue d'envoi lisible (jamais un faux succes). */
export function mapSendError(error: any): Extract<SendOutcome, { ok: false }> {
  const code = String(error?.code ?? '');
  const msg = String(error?.message ?? '');
  if (code === '28000' || /jwt|not_authenticated/i.test(msg)) {
    return { ok: false, reason: 'session', message: SESSION_MSG };
  }
  if (code === '22023' || /cannot_befriend_self/.test(msg)) {
    return { ok: false, reason: 'self', message: "Tu ne peux pas t'ajouter toi-même." };
  }
  if (code === 'P0002' || /user_not_found/.test(msg)) {
    return { ok: false, reason: 'not_found', message: "Cet utilisateur n'existe plus." };
  }
  if (code === '42501' || /row-level security|permission denied|not_allowed/i.test(msg)) {
    return { ok: false, reason: 'session', message: SESSION_MSG };
  }
  if (isNetworkError(error)) {
    return { ok: false, reason: 'network', message: "Vérifie ta connexion puis réessaie." };
  }
  return { ok: false, reason: 'unknown', message: "Impossible d'envoyer la demande. Réessaie." };
}

// ── Envoi d'une demande (RPC atomique) ───────────────────────

export interface SendOptions {
  /** Ex. sessionManager.requireUser() : session rafraichie avant l'appel (cause SESS-04). */
  requireUser?: () => Promise<{ id: string }>;
}

/**
 * Envoie une demande d'ami via `ziko_send_friend_request` : no-op si deja envoyee, accepte si
 * la demande inverse existe, refuse soi-meme. Si le RPC n'est pas encore deploye, retombe sur
 * l'INSERT direct (status 'pending'). Ne renvoie jamais `ok: true` sur une erreur.
 */
export async function sendFriendRequestRpc(supabase: any, addresseeId: string, opts: SendOptions = {}): Promise<SendOutcome> {
  let me: { id: string } | null = null;
  if (opts.requireUser) {
    try {
      me = await opts.requireUser();
    } catch {
      return { ok: false, reason: 'session', message: SESSION_MSG };
    }
    if (me.id === addresseeId) return { ok: false, reason: 'self', message: "Tu ne peux pas t'ajouter toi-même." };
  }

  let rpc: { data: any; error: any };
  try {
    rpc = await supabase.rpc('ziko_send_friend_request', { p_addressee: addresseeId });
  } catch (e) {
    return mapSendError(e);
  }
  if (!rpc.error) {
    const d = rpc.data ?? {};
    return {
      ok: true,
      relation: normalizeRelation(d.relation ?? 'sent'),
      friendshipId: d.friendship_id ?? null,
      created: d.created === true,
      autoAccepted: d.auto_accepted === true,
    };
  }
  if (!isMissingFunction(rpc.error)) return mapSendError(rpc.error);

  // Repli : RPC absent (migration non appliquee). Insert direct, erreur jamais avalee.
  if (!me) {
    try {
      const { data } = await supabase.auth.getUser();
      me = data?.user ? { id: data.user.id } : null;
    } catch {
      me = null;
    }
  }
  if (!me) return { ok: false, reason: 'session', message: SESSION_MSG };
  let ins: { error: any };
  try {
    ins = await supabase.from('ziko_friendships').insert({ requester_id: me.id, addressee_id: addresseeId, status: 'pending' });
  } catch (e) {
    return mapSendError(e);
  }
  if (!ins.error) return { ok: true, relation: 'sent', friendshipId: null, created: true, autoAccepted: false };
  if (String(ins.error.code ?? '') === '23505') return { ok: true, relation: 'sent', friendshipId: null, created: false, autoAccepted: false };
  return mapSendError(ins.error);
}

// ── Recherche ────────────────────────────────────────────────

function asResult(r: any): FriendSearchResult {
  return {
    id: String(r.id),
    name: r.name ?? null,
    handle: r.handle ?? null,
    avatar_url: r.avatar_url ?? null,
    goal: r.goal ?? null,
    relation: normalizeRelation(r.relation),
    friendship_id: r.friendship_id ?? null,
  };
}

/** Recherche avec etat de relation calcule cote serveur. Lance en cas d'erreur (pas de liste vide trompeuse). */
export async function searchUsersWithStatus(supabase: any, query: string, limit = 20): Promise<FriendSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('ziko_search_users_with_status', { p_query: q, p_limit: limit });
  if (!error) return ((data ?? []) as any[]).map(asResult);
  if (!isMissingFunction(error)) throw error;
  return legacySearch(supabase, q, limit);
}

/** Repli (RPC non deploye) : ancienne recherche + relation derivee des amities de l'appelant. */
async function legacySearch(supabase: any, q: string, limit: number): Promise<FriendSearchResult[]> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return [];
  const { data, error } = await supabase.rpc('ziko_search_users_fuzzy', { search_query: q, calling_user_id: me, result_limit: limit });
  if (error) throw error;
  const { data: rows } = await supabase
    .from('ziko_friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  return ((data ?? []) as any[]).map((r) => ({
    ...asResult(r),
    relation: deriveRelation(me, String(r.id), (rows ?? []) as any[]),
  }));
}

// ── Liste des amities ────────────────────────────────────────

export async function listFriendships(supabase: any): Promise<FriendshipEntry[]> {
  const { data, error } = await supabase.rpc('ziko_list_friendships');
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    friendship_id: String(r.friendship_id),
    other_id: String(r.other_id),
    name: r.name ?? null,
    handle: r.handle ?? null,
    avatar_url: r.avatar_url ?? null,
    goal: r.goal ?? null,
    level: typeof r.level === 'number' ? r.level : null,
    status: r.status === 'accepted' ? 'accepted' : 'pending',
    direction: r.direction === 'sent' ? 'sent' : 'received',
    created_at: String(r.created_at ?? ''),
  }));
}

// ── Profil public ────────────────────────────────────────────

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Valide la reponse du RPC. Renvoie null si la forme est inexploitable : l'ecran affiche alors la carte
 * D14 plutot qu'un contenu partiel faux.
 */
export function normalizePublicProfile(raw: any): PublicProfile | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  const rel = raw.relation === 'self' ? 'self' : normalizeRelation(raw.relation);
  return {
    id: raw.id,
    name: raw.name,
    handle: typeof raw.handle === 'string' ? raw.handle : null,
    goal: typeof raw.goal === 'string' ? raw.goal : null,
    relation: rel,
    friendship_id: typeof raw.friendship_id === 'string' ? raw.friendship_id : null,
    friends_count: num(raw.friends_count),
    followers_count: num(raw.followers_count),
    level: numOrNull(raw.level),
    xp: numOrNull(raw.xp),
    next_level: numOrNull(raw.next_level),
    xp_to_next: numOrNull(raw.xp_to_next),
    streak: num(raw.streak),
    badges: arr<PublicProfileBadge>(raw.badges),
    badges_total: num(raw.badges_total, arr(raw.badges).length),
    recent_workouts: arr<PublicProfileWorkout>(raw.recent_workouts),
    records: arr<PublicProfileRecord>(raw.records),
    common_challenges: arr<PublicProfileChallenge>(raw.common_challenges),
  };
}

/** Lance en cas d'erreur reseau/serveur ; renvoie null si le profil n'existe pas ou est invalide. */
export async function fetchPublicProfile(supabase: any, userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('ziko_get_public_profile', { p_user: userId });
  if (error) throw error;
  return normalizePublicProfile(data);
}

/** `580 XP avant le niveau 15` (null si pas de palier suivant ou pas de donnees). */
export function xpToNextLabel(p: Pick<PublicProfile, 'xp_to_next' | 'next_level'>): string | null {
  if (p.xp_to_next == null || p.next_level == null) return null;
  return `${Math.max(0, Math.round(p.xp_to_next))} XP avant le niveau ${p.next_level}`;
}

/** Progression 0..1 vers le prochain niveau a partir de xp / xp_to_next (barre de niveau). */
export function levelProgress(p: Pick<PublicProfile, 'xp' | 'xp_to_next'>): number {
  if (p.xp == null || p.xp_to_next == null) return 0;
  const total = p.xp + p.xp_to_next;
  return total > 0 ? Math.min(1, Math.max(0, p.xp / total)) : 0;
}

/** Objectif en francais en minuscules (`prise de muscle`), jamais de slug : reutilise goalLabel (XCUT-01). */
export function profileGoalText(goal: string | null | undefined): string {
  return goalLabel(goal, '').toLocaleLowerCase('fr-FR');
}

// ── Ecritures sur ziko_friendships (accepter / refuser / annuler / retirer) ──

export interface FriendActionResult { ok: boolean; message?: string }

/**
 * Execute une ecriture et ne renvoie ok que si elle a reellement abouti. Avec `requireRow`, une reponse
 * sans ligne touchee (cas ou la RLS filtre silencieusement, ex. un non-destinataire qui tente d'accepter)
 * est un echec : plus d'erreur avalee (store.ts historique).
 */
export async function runFriendWrite(op: PromiseLike<{ error: any; data?: any }>, requireRow: boolean): Promise<FriendActionResult> {
  const fail: FriendActionResult = { ok: false, message: 'Action impossible. Vérifie ta connexion puis réessaie.' };
  try {
    const { error, data } = await op;
    if (error) return fail;
    if (requireRow && Array.isArray(data) && data.length === 0) return { ok: false, message: 'Action impossible.' };
    return { ok: true };
  } catch {
    return fail;
  }
}
