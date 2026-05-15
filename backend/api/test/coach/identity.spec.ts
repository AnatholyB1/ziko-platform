// Wave 0 stub — test cases will be filled in by Plan 24-02 after service.ts is implemented.
// Structure mirrors backend/api/test/rls/ pattern (see coach-profiles.spec.ts, setup.ts).
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from '../rls/fixtures';

const admin = getAdminClient();
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

describe('coach identity — COACH-01: role promotion', () => {
  it.todo('PATCH /coach/identity/role sets role to coach for new user');
  it.todo('PATCH /coach/identity/role sets role to both for existing client');
  it.todo('PATCH /coach/identity/role is idempotent on re-call');
});

describe('coach identity — COACH-02: profile CRUD', () => {
  it.todo('POST /coach/identity/profile creates coach_profiles row with all fields');
  it.todo('PATCH /coach/identity/profile updates display_name bio specialties website');
  it.todo('GET /coach/identity/profile returns own coach_profiles row');
});

describe('coach identity — COACH-03: KYC docs', () => {
  it.todo('PATCH /coach/identity/profile with kyc_docs updates JSONB; kyc_status stays pending');
});

describe('coach identity — COACH-04: role=both', () => {
  it.todo('User with role=client gets role=both after PATCH /coach/identity/role');
});
