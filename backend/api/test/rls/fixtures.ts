// SERVICE-ROLE ONLY IN TESTS — this file MUST NOT be imported from backend/api/src/**
// ARCH-03 (Phase 24+) bans service-role under coach/; Phase 22 observes spatially.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getAuthedClient(email: string, password: string): Promise<SupabaseClient> {
  const client = getAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`getAuthedClient: ${error.message}`);
  return client;
}

export async function createTestUser(prefix: string): Promise<TestUser> {
  const admin = getAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const email = `${prefix}-${suffix}@ziko.test`;
  const password = `Test_${randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createTestUser(${prefix}): ${error?.message ?? 'no user returned'}`);
  }

  const client = await getAuthedClient(email, password);
  return { id: data.user.id, email, password, client };
}

export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  const admin = getAdminClient();
  for (const id of userIds) {
    // FK CASCADE on auth.users wipes user_profiles, coach_profiles,
    // coach_invitations, coach_client_links, ai_imports, etc.
    await admin.auth.admin.deleteUser(id);
  }
}
