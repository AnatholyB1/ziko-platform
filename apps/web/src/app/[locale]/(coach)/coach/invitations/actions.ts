'use server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function getBearer(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type ComputedInvitationStatus = 'active' | 'used' | 'expired' | 'revoked';

function computeInvitationStatus(
  row: { expires_at: string | null; revoked_at: string | null; use_count: number; max_uses: number },
  now = new Date(),
): ComputedInvitationStatus {
  if (row.revoked_at !== null) return 'revoked';
  if (row.use_count >= row.max_uses) return 'used';
  if (row.expires_at !== null && new Date(row.expires_at) <= now) return 'expired';
  return 'active';
}

export async function generateInvitationAction(
  expiresAt: string | null,
): Promise<
  Result<{
    id: string;
    code: string;
    expires_at: string | null;
    created_at: string;
  }>
> {
  const jwt = await getBearer();
  if (!jwt) return { ok: false, error: 'Non authentifié' };

  const res = await fetch(`${API_URL}/coach/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ expires_at: expiresAt }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, error: `Erreur API ${res.status}` };
  }
  const row = await res.json();
  revalidatePath('/coach/invitations');
  return { ok: true, data: row };
}

export async function revokeInvitationAction(id: string): Promise<Result<{ ok: true }>> {
  const jwt = await getBearer();
  if (!jwt) return { ok: false, error: 'Non authentifié' };

  const res = await fetch(`${API_URL}/coach/invitations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` },
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, error: `Erreur API ${res.status}` };
  revalidatePath('/coach/invitations');
  return { ok: true, data: { ok: true } };
}

export async function fetchInvitationsAction(status: 'active' | 'all' = 'all') {
  try {
    const [supabase, { user }] = await Promise.all([createServerSupabase(), getCachedCoachUser()]);
    const { data, error } = await supabase
      .from('coach_invitations')
      .select('id, coach_id, code, expires_at, revoked_at, use_count, max_uses, created_at')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return [];
    const rows = data ?? [];
    const withStatus = rows.map((r) => ({ ...r, status: computeInvitationStatus(r) }));
    return status === 'all' ? withStatus : withStatus.filter((r) => r.status === status);
  } catch {
    return [];
  }
}
