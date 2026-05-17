import { describe, it } from 'vitest';

// Tests use vi.mock to inject a fake supabase client; full integration is in plan 06.
// These stubs lock the unit contracts for plan 02's db.ts + service.ts.

describe('coach/invitations/db', () => {
  describe('insertInvitation', () => {
    it.todo('inserts row with 6-char [A-Z2-9] code matching DB CHECK');
    it.todo('retries up to 3 times on PG 23505 unique violation');
    it.todo('throws after 3 unique-violation retries with descriptive message');
    it.todo('throws immediately on non-23505 db errors');
    it.todo('respects expires_at = null (no-expiry)');
  });
  describe('listInvitations', () => {
    it.todo('returns rows with computed status (active/used/expired/revoked)');
    it.todo('filter=active returns only rows where revoked_at IS NULL AND not used AND not expired');
    it.todo('filter=all returns every row regardless of status');
    it.todo('orders by created_at DESC');
  });
  describe('revokeInvitation', () => {
    it.todo('sets revoked_at to now() on an active row owned by caller');
    it.todo('is idempotent: second call returns success without re-updating');
    it.todo('does not modify row owned by another coach (RLS)');
  });
});

describe('coach/invitations/service (route handlers)', () => {
  describe('POST /coach/invitations', () => {
    it.todo('returns 201 with new invitation row on valid body');
    it.todo('returns 400 on malformed JSON body');
    it.todo('returns 400 when expires_at is neither ISO string nor null');
    it.todo('returns 401 without auth header (authMiddleware)');
  });
  describe('GET /coach/invitations', () => {
    it.todo('returns 200 with active invitations by default');
    it.todo('respects ?status=all filter');
    it.todo('returns 400 on invalid status filter');
  });
  describe('DELETE /coach/invitations/:id', () => {
    it.todo('returns 200 { ok: true } on successful revoke');
    it.todo('returns 200 { ok: true } when re-revoking already-revoked code (idempotent)');
    it.todo('returns 400 on non-UUID id');
  });
});
