'use server';
import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function getBearer(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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
  const jwt = await getBearer();
  if (!jwt) return [];
  const res = await fetch(`${API_URL}/coach/invitations?status=${status}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}
