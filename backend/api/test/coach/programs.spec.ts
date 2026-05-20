// Phase 27 plan 00 — programs route smoke tests (stubs; implement bodies in Wave 2 after 27-04 routes exist)
import { describe, it } from 'vitest';

describe('coaching programs API', () => {
  it.todo('PROG-01: POST /coach/programs creates a program template with is_template=TRUE and returns 201 with the new program row');
  it.todo('PROG-06: POST /coach/programs/:id/assign forks the template per client_id with is_template=FALSE, assigned_to_user_id set, and start_date=CURRENT_DATE');
  it.todo('PROG-08: GET /coach/programs returns at least one seed template (created_by_coach_id=NULL, is_template=TRUE) visible to an authenticated coach');
});
