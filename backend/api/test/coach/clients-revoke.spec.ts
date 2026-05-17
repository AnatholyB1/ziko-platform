import { describe, it } from 'vitest';

describe('coach/clients/db.revokeLink', () => {
  it.todo('sets revoked_at on link owned by client');
  it.todo('is idempotent — second call returns success');
  it.todo('after revoke, is_coach_of(coach_id, client_id) returns FALSE on next RLS read');
});
