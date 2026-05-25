// fetchCoachContext — coach-facing analog of backend/api/src/context/user.ts.
// Two-query pattern:
//   1. JWT client → coach_client_links (RLS ensures only truly linked clients are returned)
//   2. Service client → user_profiles names (public info; JWT RLS blocks cross-user reads)
import { createClient } from '@supabase/supabase-js';
import { createUserClient } from '../clients/db.js';
import type { CoachContext } from './types.js';

function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function fetchCoachContext(coachId: string, jwt: string): Promise<CoachContext> {
  const db = createUserClient(jwt);

  // Step 1: get linked client IDs via JWT — RLS guarantees coach_id match
  const [profileRes, linksRes] = await Promise.all([
    db
      .from('coach_profiles')
      .select('display_name')
      .eq('user_id', coachId)
      .single(),
    db
      .from('coach_client_links')
      .select('client_id')
      .eq('coach_id', coachId)
      .is('revoked_at', null),
  ]);

  const clientIds = (linksRes.data ?? []).map((r: any) => r.client_id as string);

  let clients: Array<{ id: string; name: string }> = [];

  if (clientIds.length > 0) {
    // Step 2: fetch names via service client — JWT RLS blocks cross-user profile reads
    const svc = createServiceClient();
    const { data: profiles } = await svc
      .from('user_profiles')
      .select('id, name')
      .in('id', clientIds);

    const nameMap = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id as string, (p.name ?? 'Client inconnu') as string]),
    );

    clients = clientIds.map((id) => ({ id, name: nameMap[id] ?? 'Client inconnu' }));
  }

  return {
    profile: profileRes.data ? { display_name: profileRes.data.display_name } : null,
    clients,
  };
}
