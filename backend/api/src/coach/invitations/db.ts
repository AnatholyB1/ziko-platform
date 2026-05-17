// ARCH-03: per-request JWT client — no admin keys (SUPABASE_PUBLISHABLE_KEY only).
// Clones the pattern from backend/api/src/coach/identity/db.ts.
//
// NOTE: `computeInvitationStatus` is inlined here (instead of imported from
// `@ziko/coach-sdk`) to preserve the deliberate backend convention of avoiding
// `@ziko/*` workspace deps on the Vercel build (see comment in
// `backend/api/src/tools/registry.ts`). The function body is byte-equivalent to
// the canonical source in `packages/coach-sdk/src/schemas/coach-invitation.ts`.
import { createClient } from '@supabase/supabase-js';
import { customAlphabet } from 'nanoid';
import type {
  GenerateCodePayload,
  ListStatusFilter,
  CoachInvitationRow,
  ComputedInvitationStatus,
} from './types.js';

// Matches DB CHECK '^[A-Z2-9]{6}$' exactly (Phase 22 D-06)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
const generateCode = customAlphabet(ALPHABET, 6);

const MAX_GENERATE_RETRIES = 3;
const PG_UNIQUE_VIOLATION = '23505';

export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}

// Pure function — single source of truth for status derivation. Mirrors
// `computeInvitationStatus` in `@ziko/coach-sdk`. Keep these two in lockstep.
function computeInvitationStatus(
  row: Pick<CoachInvitationRow, 'expires_at' | 'revoked_at' | 'use_count' | 'max_uses'>,
  now: Date = new Date(),
): ComputedInvitationStatus {
  if (row.revoked_at !== null) return 'revoked';
  if (row.use_count >= row.max_uses) return 'used';
  if (row.expires_at !== null && new Date(row.expires_at) <= now) return 'expired';
  return 'active';
}

export async function insertInvitation(
  jwt: string,
  coachId: string,
  payload: GenerateCodePayload,
): Promise<CoachInvitationRow> {
  const db = createUserClient(jwt);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_GENERATE_RETRIES; attempt++) {
    const code = generateCode();
    const { data, error } = await db
      .from('coach_invitations')
      .insert({
        coach_id: coachId,
        code,
        expires_at: payload.expires_at,
        // use_count, max_uses, created_at use DB defaults
      })
      .select('id, coach_id, code, expires_at, revoked_at, use_count, max_uses, created_at')
      .single();

    if (!error && data) return data as CoachInvitationRow;
    if (error && (error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      lastError = error;
      continue;
    }
    throw new Error(error?.message ?? 'Unknown error inserting invitation');
  }
  throw new Error(
    `Failed to generate unique invitation code after ${MAX_GENERATE_RETRIES} attempts: ${String(lastError)}`,
  );
}

export async function listInvitations(
  jwt: string,
  coachId: string,
  filter: ListStatusFilter,
): Promise<Array<CoachInvitationRow & { status: ComputedInvitationStatus }>> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_invitations')
    .select('id, coach_id, code, expires_at, revoked_at, use_count, max_uses, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CoachInvitationRow[];

  const withStatus = rows.map((r) => ({
    ...r,
    status: computeInvitationStatus({
      expires_at: r.expires_at,
      revoked_at: r.revoked_at,
      use_count: r.use_count,
      max_uses: r.max_uses,
    }),
  }));

  if (filter === 'all') return withStatus;
  return withStatus.filter((r) => r.status === filter);
}

export async function revokeInvitation(
  jwt: string,
  coachId: string,
  id: string,
): Promise<{ id: string; revoked_at: string | null }> {
  const db = createUserClient(jwt);
  // Idempotent: only update rows not yet revoked. Re-revoking returns 0 rows
  // affected — we treat that as success (still revoked).
  const { data, error } = await db
    .from('coach_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', coachId) // belt + suspenders (RLS already enforces)
    .is('revoked_at', null)
    .select('id, revoked_at')
    .maybeSingle();

  if (error) throw new Error(error.message);
  // data === null means: row already revoked OR not owned by caller.
  // RLS will surface ownership issues as zero rows in either case — that's fine for idempotency.
  return data ?? { id, revoked_at: null };
}
