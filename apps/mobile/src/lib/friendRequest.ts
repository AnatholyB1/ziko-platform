// Friend request from global search (v1.20 P2, SESS-04). Pure logic, injectable deps.
// Root cause of the generic "Impossible d'envoyer la demande": see
// .planning/workstreams/uat-mobile/phases/02-session-auth-robustes/02-DIAGNOSTIC-friend-request.md

export type FriendRequestOutcome =
  | { ok: true; alreadySent: boolean }
  | { ok: false; reason: 'session' | 'self' | 'blocked' | 'unknown'; message: string };

interface Deps {
  requireUser: () => Promise<{ id: string }>;
  insert: (row: { requester_id: string; addressee_id: string; status: 'pending' }) => Promise<{ error: any }>;
}

export async function sendFriendRequestFromSearch(addresseeId: string, deps: Deps): Promise<FriendRequestOutcome> {
  let user: { id: string };
  try {
    user = await deps.requireUser();
  } catch {
    return { ok: false, reason: 'session', message: 'Ta session a expiré. Reconnecte-toi pour continuer.' };
  }
  if (user.id === addresseeId) {
    return { ok: false, reason: 'self', message: 'Tu ne peux pas t\'ajouter toi-même.' };
  }
  let error: any;
  try {
    ({ error } = await deps.insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' }));
  } catch (e) {
    error = e;
  }
  if (!error) return { ok: true, alreadySent: false };

  const code = String(error.code ?? '');
  // unique (requester_id, addressee_id): the request already exists -> treat as sent
  if (code === '23505') return { ok: true, alreadySent: true };
  // RLS rejection: JWT no longer maps to requester_id (expired/anon token)
  if (code === '42501' || /row-level security|jwt|permission denied/i.test(String(error.message ?? ''))) {
    return { ok: false, reason: 'session', message: 'Ta session a expiré. Reconnecte-toi pour continuer.' };
  }
  return { ok: false, reason: 'unknown', message: 'Impossible d\'envoyer la demande. Réessaie.' };
}
