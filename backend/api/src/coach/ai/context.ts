// fetchCoachContext — coach-facing analog of backend/api/src/context/user.ts.
// MUST use JWT client — service key bypasses is_coach_of RLS.
import { createUserClient } from '../clients/db.js';
import type { CoachContext } from './types.js';

export async function fetchCoachContext(coachId: string, jwt: string): Promise<CoachContext> {
  // MUST use JWT client — service key bypasses is_coach_of RLS
  const db = createUserClient(jwt);

  const [profileRes, clientsRes] = await Promise.all([
    db
      .from('coach_profiles')
      .select('display_name')
      .eq('user_id', coachId)
      .single(),
    db
      .from('coach_client_links')
      .select('client_id, user_profiles!inner(name)')
      .eq('coach_id', coachId)
      .is('revoked_at', null),
  ]);

  const clients = (clientsRes.data ?? []).map((row: any) => ({
    id: row.client_id as string,
    name: (row.user_profiles?.name ?? 'Client inconnu') as string,
  }));

  return {
    profile: profileRes.data ? { display_name: profileRes.data.display_name } : null,
    clients,
  };
}
