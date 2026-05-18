import { describe, it } from 'vitest';
describe('GET/PUT /coach/clients/:id/notes — note CRUD', () => {
  it.todo('PUT upserts note row with coach_id = auth.uid()');
  it.todo('GET returns the note for this coach+client pair');
  it.todo('PUT updates content and updated_at on second write');
  it.todo('Coach B cannot read Coach A\'s notes (RLS isolation)');
  it.todo('athlete cannot read coach notes (no athlete-read policy)');
});
