// Integration tests for coach/identity bounded module (COACH-01 through COACH-05)
// Structure mirrors backend/api/test/rls/ pattern (see coach-profiles.spec.ts, setup.ts).
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupTestUsers, createTestUser, getAdminClient } from '../rls/fixtures';
import app from '../../src/app';

const admin = getAdminClient();
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await cleanupTestUsers(createdIds);
});

async function getJwt(user: Awaited<ReturnType<typeof createTestUser>>): Promise<string> {
  const { data } = await user.client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No access token for test user');
  return token;
}

describe('coach identity — COACH-01: role promotion', () => {
  it('PATCH /coach/identity/role sets role to both for a new user (role=client)', async () => {
    const user = await createTestUser('role-new');
    createdIds.push(user.id);
    const jwt = await getJwt(user);

    const res = await app.request('/coach/identity/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('both');

    // Verify in DB via admin
    const { data } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    expect(data?.role).toBe('both');
  });

  it('PATCH /coach/identity/role sets role to coach for user already promoted to both', async () => {
    const user = await createTestUser('role-both');
    createdIds.push(user.id);

    // Set role to 'both' via admin
    await admin.from('user_profiles').update({ role: 'both' }).eq('id', user.id);

    const jwt = await getJwt(user);
    const res = await app.request('/coach/identity/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // non-'client' role → becomes 'coach'
    expect(body.role).toBe('coach');
  });

  it('PATCH /coach/identity/role is idempotent on re-call', async () => {
    const user = await createTestUser('role-idem');
    createdIds.push(user.id);
    const jwt = await getJwt(user);

    // First call
    await app.request('/coach/identity/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    // Second call — should succeed with no error
    const res = await app.request('/coach/identity/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(['coach', 'both']).toContain(body.role);
  });
});

describe('coach identity — COACH-02: profile CRUD', () => {
  it('POST /coach/identity/profile creates coach_profiles row with all fields', async () => {
    const user = await createTestUser('prof-create');
    createdIds.push(user.id);
    const jwt = await getJwt(user);

    const payload = {
      display_name: 'Coach Test',
      bio: 'Expert en fitness',
      specialties: ['yoga', 'musculation'],
      website: 'https://coach.example.com',
    };

    const res = await app.request('/coach/identity/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.display_name).toBe('Coach Test');
    expect(body.bio).toBe('Expert en fitness');
    expect(body.specialties).toEqual(['yoga', 'musculation']);
    expect(body.website).toBe('https://coach.example.com');
    expect(body.user_id).toBe(user.id);
  });

  it('PATCH /coach/identity/profile updates display_name; GET returns updated value', async () => {
    const user = await createTestUser('prof-update');
    createdIds.push(user.id);
    const jwt = await getJwt(user);

    // Create first
    await app.request('/coach/identity/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ display_name: 'Original Name' }),
    });

    // Update
    const patchRes = await app.request('/coach/identity/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ display_name: 'Updated Name' }),
    });
    expect(patchRes.status).toBe(200);

    // GET to verify
    const getRes = await app.request('/coach/identity/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.display_name).toBe('Updated Name');
  });

  it('GET /coach/identity/profile returns 404 when no profile exists', async () => {
    const user = await createTestUser('prof-404');
    createdIds.push(user.id);
    const jwt = await getJwt(user);

    const res = await app.request('/coach/identity/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(404);
  });
});

describe('coach identity — COACH-03: KYC docs', () => {
  it('PATCH /coach/identity/profile with kyc_docs updates JSONB; kyc_status becomes submitted', async () => {
    const user = await createTestUser('kyc-docs');
    createdIds.push(user.id);
    const jwt = await getJwt(user);

    // Create profile first
    await app.request('/coach/identity/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ display_name: 'KYC Coach' }),
    });

    // Patch with kyc_docs
    const kycDoc = {
      type: 'certification',
      url: 'https://example.com/doc.pdf',
      uploaded_at: new Date().toISOString(),
      filename: 'cert.pdf',
    };

    const res = await app.request('/coach/identity/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kyc_docs: [kycDoc] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kyc_status).toBe('submitted');
    expect(Array.isArray(body.kyc_docs)).toBe(true);
    expect(body.kyc_docs).toHaveLength(1);
    expect(body.kyc_docs[0].type).toBe('certification');
  });
});

describe('coach identity — COACH-04: role=both', () => {
  it('User with role=client gets role=both after PATCH /coach/identity/role', async () => {
    const user = await createTestUser('role-client');
    createdIds.push(user.id);

    // Verify initial role is 'client'
    const { data: before } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    expect(before?.role).toBe('client');

    const jwt = await getJwt(user);
    const res = await app.request('/coach/identity/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('both');

    // Verify DB
    const { data: after } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    expect(after?.role).toBe('both');
  });
});
