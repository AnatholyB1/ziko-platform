import { describe, it } from 'vitest';

// Behavior locked by plan 03 db.ts contract. Real implementations in plan 06.

describe('coach/clients/db.peekInvitation', () => {
  describe('happy path', () => {
    it.todo('returns ok=true + preview { coach_id, display_name, bio, specialties, photo_signed_url, kyc_status } on valid code');
    it.todo('photo_signed_url is a string starting with https:// (or null if photo_url is null)');
  });
  describe('error collapsing (INVITE-07 + T-25-01)', () => {
    it.todo('returns { ok:false, error_code: INVALID_OR_EXPIRED, preview: null } when peek RPC returns INVALID_CODE');
    it.todo('returns INVALID_OR_EXPIRED for SELF_INVITATION');
    it.todo('returns INVALID_OR_EXPIRED for REVOKED');
    it.todo('returns INVALID_OR_EXPIRED for EXPIRED');
    it.todo('returns INVALID_OR_EXPIRED for ALREADY_USED');
    it.todo('returns INVALID_OR_EXPIRED for LINK_EXISTS');
    it.todo('all 6 paths produce byte-identical response bodies (deep equal)');
    it.todo('console.warn is called with the original error_code (operational logging)');
  });
});
