import { describe, it } from 'vitest';
describe('GET/POST/DELETE /coach/clients/:id/tags — tag CRUD', () => {
  it.todo('POST creates a tag row with coach_id = auth.uid()');
  it.todo('GET lists only the calling coach\'s tags for this client');
  it.todo('DELETE removes tag by id when coach_id matches');
  it.todo('Coach B cannot read Coach A\'s tags (RLS isolation)');
  it.todo('tag > 50 chars is rejected (DB CHECK constraint)');
  it.todo('duplicate tag (same coach+client+tag) is rejected (UNIQUE)');
});
