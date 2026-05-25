// ARCH-03: per-request JWT client — no admin/service keys (SUPABASE_PUBLISHABLE_KEY only).
// RLS policy "ai_imports_own" (auth.uid() = user_id) enforces owner-only access on all queries.
import { createClient } from '@supabase/supabase-js';
import type {
  ImportRow,
  ImportStatus,
  ImportMode,
  CreateImportBody,
} from './types.js';

// ── JWT-scoped client factory ──────────────────────────────────────────────────
// All db functions instantiate a fresh client per request so RLS sees the correct
// auth.uid() for every Supabase call. No service-role key is used in this module.
function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}

// ── createImport ───────────────────────────────────────────────────────────────
// Inserts a new ai_imports row with status='pending'.
// file_url is intentionally set to '' here; the service layer updates it via
// updateImportFileUrl() once the signed Storage URL is resolved.
// T-28-03-02: mode is stored at create time (owner-only write via RLS); it cannot
// be elevated by the client after creation.
export async function createImport(
  jwt: string,
  userId: string,
  body: CreateImportBody,
): Promise<ImportRow> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('ai_imports')
    .insert({
      user_id: userId,
      file_url: '',
      original_filename: body.filename,
      mime_type: body.mime_type,
      size_bytes: body.size_bytes,
      mode: body.mode,
      status: 'pending' satisfies ImportStatus,
      re_upload_source_id: body.re_upload_source_id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ImportRow;
}

// ── getImport ──────────────────────────────────────────────────────────────────
// Returns the full row for a single import.
// RLS ensures only the owning user can read the row; returns null if not found
// or if the row belongs to a different user (T-28-03-01).
export async function getImport(
  jwt: string,
  _userId: string,
  importId: string,
): Promise<ImportRow | null> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('ai_imports')
    .select('*')
    .eq('id', importId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ImportRow) ?? null;
}

// ── listImports ────────────────────────────────────────────────────────────────
// Returns the user's last 50 imports ordered newest first.
// RLS enforces owner-only visibility (T-28-03-01).
export async function listImports(
  jwt: string,
  _userId: string,
): Promise<ImportRow[]> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('ai_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data as ImportRow[]) ?? [];
}

// ── updateImportStatus ─────────────────────────────────────────────────────────
// Updates the status column and updated_at (via trigger) on the given row.
// Accepts optional extra fields for status transitions that carry additional data:
//   - 'parsing' → no extras needed
//   - 'ready'   → parsed_data, confidence_scores, page_count, parsed_at
//   - 'failed'  → error_message
//   - 'uploaded'→ file upload confirmation (no extras)
// Note: 'committed' status is set exclusively via commitImport().
export async function updateImportStatus(
  jwt: string,
  importId: string,
  status: ImportStatus,
  extra?: Partial<
    Pick<
      ImportRow,
      | 'error_message'
      | 'parsed_data'
      | 'confidence_scores'
      | 'page_count'
      | 'credit_transaction_id'
      | 'parsed_at'
    >
  >,
): Promise<void> {
  const db = createUserClient(jwt);
  const { error } = await db
    .from('ai_imports')
    .update({ status, ...(extra ?? {}) })
    .eq('id', importId);
  if (error) throw new Error(error.message);
}

// ── updateImportFileUrl ────────────────────────────────────────────────────────
// Sets the Storage path on the ai_imports row after the signed URL upload is confirmed.
// Called by the service layer immediately after the signed URL is resolved, before
// the client begins its upload.
export async function updateImportFileUrl(
  jwt: string,
  importId: string,
  fileUrl: string,
): Promise<void> {
  const db = createUserClient(jwt);
  const { error } = await db
    .from('ai_imports')
    .update({ file_url: fileUrl })
    .eq('id', importId);
  if (error) throw new Error(error.message);
}

// ── commitImport ───────────────────────────────────────────────────────────────
// Commits a parsed import by:
//   1. Inserting a new workout_programs row.
//   2. Updating the ai_imports row: committed_program_id, status='committed', committed_at.
//
// T-28-03-02: is_template is ALWAYS computed server-side from the mode field stored at
// create time. The client cannot override this.
// T-28-03-03: created_by_coach_id is set ONLY for coach_template mode. Athlete commits
// always produce null, preventing cross-user ownership issues.
//
// Supabase JS does not support multi-statement transactions; the two operations are
// executed as a logical sequence. If the workout_programs insert succeeds but the
// ai_imports update fails, the orphaned program row is acceptable (parse remains
// re-commitable). Idempotency is enforced by the route layer (check status ≠ 'committed'
// before calling this function).
export async function commitImport(
  jwt: string,
  userId: string,
  importId: string,
  parsedData: Record<string, unknown>,
  programName: string | undefined,
  mode: ImportMode,
): Promise<{ program_id: string }> {
  const db = createUserClient(jwt);
  const isTemplate = mode === 'coach_template';
  const weeksArray = Array.isArray((parsedData as any).weeks)
    ? (parsedData as any).weeks
    : [];
  const derivedName =
    programName ??
    (typeof (parsedData as any).name === 'string'
      ? (parsedData as any).name
      : 'Imported Program');

  // Step 1 — Insert workout_programs row
  const { data: programData, error: programError } = await db
    .from('workout_programs')
    .insert({
      user_id: userId,
      name: derivedName,
      weeks_data: parsedData,
      weeks_count: weeksArray.length > 0 ? weeksArray.length : 1,
      is_template: isTemplate,
      // T-28-03-03: only coach_template imports set created_by_coach_id
      created_by_coach_id: isTemplate ? userId : null,
      assigned_to_user_id: null,
    })
    .select('id')
    .single();
  if (programError) throw new Error(programError.message);
  const programId: string = (programData as any).id;

  // Step 2 — Mark the import as committed
  const { error: importError } = await db
    .from('ai_imports')
    .update({
      committed_program_id: programId,
      status: 'committed' satisfies ImportStatus,
      committed_at: new Date().toISOString(),
    })
    .eq('id', importId);
  if (importError) throw new Error(importError.message);

  return { program_id: programId };
}
