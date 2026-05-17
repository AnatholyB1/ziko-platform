// ARCH-03: per-request JWT client — no admin keys.
import { createClient } from '@supabase/supabase-js';
import type {
  RedeemPayload,
  CoachPreviewPayload,
  LinkRow,
  PeekRpcReturn,
  RedeemRpcReturn,
} from './types.js';

const COACH_PHOTO_BUCKET = 'coach-kyc';
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes per RESEARCH.md §Don't Hand-Roll

export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}

async function signCoachPhoto(
  db: ReturnType<typeof createUserClient>,
  bucketPath: string | null,
): Promise<string | null> {
  if (!bucketPath) return null;
  const { data, error } = await db.storage
    .from(COACH_PHOTO_BUCKET)
    .createSignedUrl(bucketPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn('[coach/clients] failed to sign coach photo:', error?.message);
    return null;
  }
  return data.signedUrl;
}

// ----- GET /coach/clients/links/me ----------------------------------------
export async function getActiveLink(
  jwt: string,
  clientId: string,
): Promise<{
  link: (LinkRow & { invitation_id: string | null }) | null;
  preview: CoachPreviewPayload | null;
}> {
  const db = createUserClient(jwt);
  const { data: linkRow, error: linkErr } = await db
    .from('coach_client_links')
    .select(
      'id, coach_id, client_id, invitation_id, created_at, expires_at, revoked_at',
    )
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkErr) throw new Error(linkErr.message);
  if (!linkRow) return { link: null, preview: null };

  // Fetch coach profile via RLS-aware read (coach_profiles publicly readable per Phase 24)
  const { data: cp, error: cpErr } = await db
    .from('coach_profiles')
    .select('display_name, bio, specialties, photo_url, kyc_status')
    .eq('user_id', linkRow.coach_id)
    .maybeSingle();

  if (cpErr) throw new Error(cpErr.message);

  const photoSignedUrl = await signCoachPhoto(db, cp?.photo_url ?? null);

  return {
    link: {
      id: linkRow.id,
      coach_id: linkRow.coach_id,
      client_id: linkRow.client_id,
      invitation_id: linkRow.invitation_id,
      created_at: linkRow.created_at,
    },
    preview: cp
      ? {
          coach_id: linkRow.coach_id,
          display_name: cp.display_name,
          bio: cp.bio,
          specialties: cp.specialties,
          photo_signed_url: photoSignedUrl,
          kyc_status: cp.kyc_status as CoachPreviewPayload['kyc_status'],
        }
      : null,
  };
}

// ----- POST /coach/clients/links/preview ----------------------------------
export async function peekInvitation(
  jwt: string,
  payload: RedeemPayload,
): Promise<
  | { ok: true; error_code: null; preview: CoachPreviewPayload }
  | { ok: false; error_code: 'INVALID_OR_EXPIRED'; preview: null }
> {
  const db = createUserClient(jwt);
  const { data, error } = await db.rpc('peek_invitation', {
    code_input: payload.code,
  });
  if (error) {
    console.warn('[coach/clients] peek_invitation rpc error:', error.message);
    return { ok: false, error_code: 'INVALID_OR_EXPIRED', preview: null };
  }
  const rpc = data as PeekRpcReturn;
  if (!rpc.ok) {
    // Collapse 6 DB error codes to single wire code; log original for ops (INVITE-07, T-25-01)
    console.warn('[coach/clients] peek_invitation collapsed:', rpc.error_code);
    return { ok: false, error_code: 'INVALID_OR_EXPIRED', preview: null };
  }
  const photoSignedUrl = await signCoachPhoto(db, rpc.preview.photo_url);
  return {
    ok: true,
    error_code: null,
    preview: {
      coach_id: rpc.preview.coach_id,
      display_name: rpc.preview.display_name,
      bio: rpc.preview.bio,
      specialties: rpc.preview.specialties,
      photo_signed_url: photoSignedUrl,
      kyc_status: rpc.preview.kyc_status as CoachPreviewPayload['kyc_status'],
    },
  };
}

// ----- POST /coach/clients/links/redeem -----------------------------------
export async function redeemInvitation(
  jwt: string,
  payload: RedeemPayload,
  _clientId: string,
): Promise<
  | { ok: true; error_code: null; link: LinkRow; preview: CoachPreviewPayload }
  | { ok: false; error_code: 'INVALID_OR_EXPIRED'; link: null; preview: null }
> {
  const db = createUserClient(jwt);
  const { data, error } = await db.rpc('redeem_invitation_code', {
    code_input: payload.code,
  });
  if (error) {
    console.warn(
      '[coach/clients] redeem_invitation_code rpc error:',
      error.message,
    );
    return {
      ok: false,
      error_code: 'INVALID_OR_EXPIRED',
      link: null,
      preview: null,
    };
  }
  const rpc = data as RedeemRpcReturn;
  if (!rpc.ok) {
    console.warn(
      '[coach/clients] redeem_invitation_code collapsed:',
      rpc.error_code,
    );
    return {
      ok: false,
      error_code: 'INVALID_OR_EXPIRED',
      link: null,
      preview: null,
    };
  }

  // Fetch the inserted link row + coach preview in one round-trip each.
  const { data: linkRow, error: linkErr } = await db
    .from('coach_client_links')
    .select('id, coach_id, client_id, created_at')
    .eq('id', rpc.link_id)
    .single();
  if (linkErr || !linkRow) {
    console.warn(
      '[coach/clients] redeem post-fetch link error:',
      linkErr?.message,
    );
    return {
      ok: false,
      error_code: 'INVALID_OR_EXPIRED',
      link: null,
      preview: null,
    };
  }

  const { data: cp } = await db
    .from('coach_profiles')
    .select('display_name, bio, specialties, photo_url, kyc_status')
    .eq('user_id', linkRow.coach_id)
    .maybeSingle();

  const photoSignedUrl = cp
    ? await signCoachPhoto(db, cp.photo_url ?? null)
    : null;
  return {
    ok: true,
    error_code: null,
    link: linkRow as LinkRow,
    preview: {
      coach_id: linkRow.coach_id,
      display_name: cp?.display_name ?? '',
      bio: cp?.bio ?? null,
      specialties: cp?.specialties ?? null,
      photo_signed_url: photoSignedUrl,
      kyc_status: (cp?.kyc_status ?? null) as CoachPreviewPayload['kyc_status'],
    },
  };
}

// ----- DELETE /coach/clients/links/:id ------------------------------------
export async function revokeLink(
  jwt: string,
  clientId: string,
  id: string,
): Promise<{ id: string; revoked_at: string | null }> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_client_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', clientId) // belt + suspenders; RLS enforces
    .is('revoked_at', null)
    .select('id, revoked_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { id, revoked_at: null };
}

// Unused-export guard for the helper (it's used internally only).
export { signCoachPhoto as _signCoachPhoto };
