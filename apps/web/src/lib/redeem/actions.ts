'use server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { CoachPreviewPayload } from '@ziko/coach-sdk';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type PreviewResult =
  | { ok: true; preview: CoachPreviewPayload }
  | { ok: false; error_code: 'INVALID_OR_EXPIRED' | 'RATE_LIMITED' | 'NETWORK' };

type RedeemResult =
  | { ok: true; link: { id: string; coach_id: string; created_at: string }; preview: CoachPreviewPayload }
  | { ok: false; error_code: 'INVALID_OR_EXPIRED' | 'RATE_LIMITED' | 'NETWORK' };

async function getBearer(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // getSession() after getUser() succeeds is safe — session is now refreshed in memory
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function previewCodeAction(code: string): Promise<PreviewResult> {
  const jwt = await getBearer();
  if (!jwt) return { ok: false, error_code: 'NETWORK' };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/coach/clients/links/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ code }),
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[redeem/actions] previewCodeAction fetch failed:', e);
    return { ok: false, error_code: 'NETWORK' };
  }
  if (res.status === 429) return { ok: false, error_code: 'RATE_LIMITED' };
  const body = await res.json().catch(() => null);
  if (body?.ok === true && body.preview) return { ok: true, preview: body.preview };
  return { ok: false, error_code: 'INVALID_OR_EXPIRED' };
}

export async function redeemCodeAction(code: string): Promise<RedeemResult> {
  const jwt = await getBearer();
  if (!jwt) return { ok: false, error_code: 'NETWORK' };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/coach/clients/links/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ code }),
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[redeem/actions] redeemCodeAction fetch failed:', e);
    return { ok: false, error_code: 'NETWORK' };
  }
  if (res.status === 429) return { ok: false, error_code: 'RATE_LIMITED' };
  const body = await res.json().catch(() => null);
  if (body?.ok === true && body.link && body.preview) {
    return { ok: true, link: body.link, preview: body.preview };
  }
  return { ok: false, error_code: 'INVALID_OR_EXPIRED' };
}

export async function revokeLinkAction(id: string): Promise<{ ok: boolean }> {
  const jwt = await getBearer();
  if (!jwt) return { ok: false };
  try {
    const res = await fetch(`${API_URL}/coach/clients/links/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
      cache: 'no-store',
    });
    return { ok: res.ok };
  } catch (e) {
    console.error('[redeem/actions] revokeLinkAction fetch failed:', e);
    return { ok: false };
  }
}

export async function fetchActiveLinkAction(): Promise<{
  link: { id: string; coach_id: string; created_at: string } | null;
  preview: CoachPreviewPayload | null;
}> {
  const jwt = await getBearer();
  if (!jwt) return { link: null, preview: null };
  try {
    const res = await fetch(`${API_URL}/coach/clients/links/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: 'no-store',
    });
    if (!res.ok) return { link: null, preview: null };
    const body = await res.json().catch(() => null);
    if (!body) return { link: null, preview: null };
    return { link: body.link ?? null, preview: body.preview ?? null };
  } catch (e) {
    console.error('[redeem/actions] fetchActiveLinkAction fetch failed:', e);
    return { link: null, preview: null };
  }
}
