import { getActiveLink, revokeLink } from '../coach/clients/db.js';

// ── Tool: coach_get_link ───────────────────────────────────
export async function coach_get_link(
  _params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  if (!userToken) {
    return { linked: false, message: 'Authentication required.' };
  }

  const { link, preview } = await getActiveLink(userToken, userId);

  if (!link) {
    return {
      linked: false,
      message:
        'No coach is currently linked. Enter a 6-character invitation code in the Mon coach plugin to connect.',
    };
  }

  return {
    linked: true,
    link_id: link.id,
    coach_name: preview?.display_name ?? null,
    linked_at: link.created_at,
    kyc_verified: preview?.kyc_status === 'verified',
    bio: preview?.bio ?? null,
    specialties: preview?.specialties ?? [],
  };
}

// ── Tool: coach_revoke_link ────────────────────────────────
export async function coach_revoke_link(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  if (!userToken) {
    return {
      ok: false,
      error: 'confirmation_required',
      message: 'Authentication required.',
    };
  }

  const { confirmed } = params as { confirmed?: boolean };

  if (confirmed !== true) {
    return {
      ok: false,
      error: 'confirmation_required',
      message:
        'Call again with confirmed: true after the user explicitly agrees to unlink their coach.',
    };
  }

  const { link } = await getActiveLink(userToken, userId);

  if (!link) {
    return {
      ok: false,
      error: 'no_active_link',
      message: 'No coach is currently linked.',
    };
  }

  const result = await revokeLink(userToken, userId, link.id);

  return {
    ok: true,
    link_id: link.id,
    revoked_at: result.revoked_at,
  };
}
