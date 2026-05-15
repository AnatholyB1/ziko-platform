// ARCH-03: per-request JWT client — no admin keys (SUPABASE_PUBLISHABLE_KEY only)
import { createClient } from '@supabase/supabase-js';
import type { ProfileUpsertPayload } from './types.js';

export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  );
}

export async function updateRole(jwt: string, userId: string) {
  const db = createUserClient(jwt);
  // Read current role to determine target
  const { data: profile } = await db
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const currentRole = profile?.role ?? 'client';
  const newRole = currentRole === 'client' ? 'both' : 'coach';

  const { error } = await db
    .from('user_profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  return { role: newRole };
}

export async function upsertProfile(
  jwt: string,
  userId: string,
  fields: ProfileUpsertPayload,
) {
  const db = createUserClient(jwt);
  // Determine kyc_status: if kyc_docs provided and non-empty, set 'submitted'
  const kycStatus = fields.kyc_docs && fields.kyc_docs.length > 0
    ? 'submitted'
    : undefined;

  const payload: Record<string, unknown> = {
    user_id: userId,
    ...fields,
    ...(kycStatus ? { kyc_status: kycStatus } : {}),
  };

  const { data, error } = await db
    .from('coach_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProfile(jwt: string, userId: string) {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data ?? null;
}
