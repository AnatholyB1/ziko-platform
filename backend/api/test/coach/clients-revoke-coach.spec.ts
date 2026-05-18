import { describe, it } from 'vitest';
describe('DELETE /coach/clients/links/:clientId — coach-side revoke', () => {
  it.todo('sets revoked_at on the link row when called by the coach');
  it.todo('coach cannot read client data after revocation (RLS blocks)');
  it.todo('athlete-side revoke route still works independently');
  it.todo('revoke by non-coach (wrong auth) returns error');
});
