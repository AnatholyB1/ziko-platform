// Public entry point for coach/imports bounded module.
// CRITICAL: static paths (/status, /parse, /commit suffixes) registered BEFORE /:id
// to prevent Hono matching them as :id param values (Pitfall 4 from RESEARCH.md).
//
// Routes (in registration order):
//   GET    /              — list user's imports
//   POST   /              — create import record + get signed upload URL
//   PUT    /:id/status    — transition pending → uploaded
//   POST   /:id/parse     — trigger async parse (returns 202 immediately)
//   GET    /:id           — poll import status + parsed_data
//   PUT    /:id/commit    — commit parsed program to workout_programs
//
// maxDuration = 60 exported for Vercel parse route timeout (Phase 23 D-15).
// Credit check is INLINE in parse handler, NOT middleware (RESEARCH.md Pattern 1, D-03).
// Admin client used ONLY for Storage download during async parse (never for DB queries).

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../../middleware/auth.js';
import * as db from './db.js';
import * as creditService from '../../services/creditService.js';
import { rasterizePdf, getPdfPageCount } from './parse/pdf.js';
import { parseExcel } from './parse/excel.js';
import { parseWord } from './parse/word.js';
import { parseWithVision, parseWithText, NoObjectGeneratedError } from './parse/claude.js';
import type { CreateImportBody, CommitImportBody } from './types.js';

// Vercel max duration for the parse route (D-15, IMPORT-05)
export const maxDuration = 60;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed MIME types (must match ai_imports CHECK constraint in migration 036)
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

// Max file size: 25 MB (D-21, IMPORT-01)
const MAX_SIZE_BYTES = 26_214_400; // 25 * 1024 * 1024

// Admin client for Storage download during async parse.
// DB queries use JWT-scoped client via db.ts (ARCH-03).
const adminSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const importsRouter = new Hono();
importsRouter.use('*', authMiddleware);

// ── 1. GET / — list user's imports (last 50, newest first) ────────────────────
importsRouter.get('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  try {
    const imports = await db.listImports(jwt, userId);
    return c.json({ imports });
  } catch (err: any) {
    console.error('[coach/imports] GET / error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 2. POST / — create import record + signed upload URL ──────────────────────
// Returns { import_id, signed_upload_url, path }
// T-28-04-01: mime_type validated server-side before DB insert
// T-28-04-02: size_bytes validated server-side before DB insert
// T-28-04-03: storage path uses userId prefix — user cannot upload to another user's path
importsRouter.post('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);

  let body: Partial<CreateImportBody>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  // Validate filename
  if (!body.filename || typeof body.filename !== 'string' || !body.filename.trim()) {
    return c.json({ error: 'filename is required' }, 400);
  }
  const filename = body.filename.trim();

  // T-28-04-01: validate mime_type against allowlist
  if (!body.mime_type || !ALLOWED_MIME_TYPES.includes(body.mime_type as AllowedMimeType)) {
    return c.json({
      error: `Invalid mime_type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    }, 400);
  }

  // T-28-04-02: validate size_bytes
  if (
    typeof body.size_bytes !== 'number' ||
    body.size_bytes <= 0 ||
    body.size_bytes > MAX_SIZE_BYTES
  ) {
    return c.json({ error: `size_bytes must be between 1 and ${MAX_SIZE_BYTES}` }, 400);
  }

  // Validate mode
  if (body.mode !== 'athlete' && body.mode !== 'coach_template') {
    return c.json({ error: "mode must be 'athlete' or 'coach_template'" }, 400);
  }

  try {
    // Insert ai_imports row with status='pending'
    const importRow = await db.createImport(jwt, userId, {
      filename,
      mime_type: body.mime_type,
      size_bytes: body.size_bytes,
      mode: body.mode,
      re_upload_source_id: body.re_upload_source_id ?? null,
    });

    // T-28-04-03: path prefixed with userId — prevents cross-user uploads
    const storagePath = `${userId}/${importRow.id}/${filename}`;

    // Generate signed upload URL (private bucket, D-21)
    const { data, error: storageError } = await adminSupabase.storage
      .from('ai-imports')
      .createSignedUploadUrl(storagePath);

    if (storageError || !data) {
      console.error('[coach/imports] createSignedUploadUrl error:', storageError);
      return c.json({ error: 'Failed to generate upload URL' }, 500);
    }

    // Store storage path on the row for later download during parse
    await db.updateImportFileUrl(jwt, importRow.id, storagePath);

    return c.json({
      import_id: importRow.id,
      signed_upload_url: data.signedUrl,
      path: data.path,
    }, 201);
  } catch (err: any) {
    console.error('[coach/imports] POST / error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 3. PUT /:id/status — confirm upload complete (pending → uploaded) ──────────
// CRITICAL: registered BEFORE /:id to avoid Hono matching 'status' as :id
importsRouter.put('/:id/status', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid import id' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  // Only 'uploaded' is accepted (UpdateStatusBody)
  if (body.status !== 'uploaded') {
    return c.json({ error: "status must be 'uploaded'" }, 400);
  }

  try {
    const importRow = await db.getImport(jwt, userId, id);
    // T-28-04-06: returns null for non-owned imports (RLS ai_imports_own)
    if (!importRow) return c.json({ error: 'Not found' }, 404);

    // Validate current status is 'pending' before transitioning
    if (importRow.status !== 'pending') {
      return c.json({ error: `Cannot transition from '${importRow.status}' to 'uploaded'` }, 409);
    }

    await db.updateImportStatus(jwt, id, 'uploaded');
    return c.json({ ok: true });
  } catch (err: any) {
    console.error('[coach/imports] PUT /:id/status error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 4. POST /:id/parse — trigger async parse (returns 202 immediately) ─────────
// CRITICAL: registered BEFORE /:id to avoid Hono matching 'parse' as :id
//
// Credit logic (D-01/D-02/D-03):
//   creditCost = mime_type === 'application/pdf' ? Math.min(page_count ?? 1, 10) : 1
//   Check happens INLINE (not middleware) with getQuotaStatus + balance check (Pattern 1)
//   Credits deducted ONLY on parse success (D-03)
//   T-28-04-04: creditCost computed from server-stored page_count — not from client input
//
// Async parse runs in background; 55s guard timeout registered before the chain.
importsRouter.post('/:id/parse', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid import id' }, 400);

  try {
    const importRow = await db.getImport(jwt, userId, id);
    // T-28-04-06: 404 for non-owned imports
    if (!importRow) return c.json({ error: 'Not found' }, 404);

    // Must be 'uploaded' to trigger parse
    if (importRow.status !== 'uploaded') {
      return c.json({ error: `Cannot parse import with status '${importRow.status}'` }, 409);
    }

    // ── Inline credit check (Pattern 1: variable cost, D-01/D-02) ──────────
    // T-28-04-04: creditCost derived from server-side page_count, never from client
    const creditCost =
      importRow.mime_type === 'application/pdf'
        ? Math.min(importRow.page_count ?? 1, 10)
        : 1;

    const quotaStatus = await creditService.getQuotaStatus(userId, 'import');
    const hasEnoughBalance = quotaStatus.withinFreeQuota || quotaStatus.balance >= creditCost;

    if (!hasEnoughBalance) {
      // Insufficient credits — mark as failed, return 402
      await db.updateImportStatus(jwt, id, 'failed', {
        error_message: 'insufficient_credits',
      });
      return c.json({
        error: 'Insufficient credits',
        required: creditCost,
        balance: quotaStatus.balance,
      }, 402);
    }

    // Mark as parsing before returning 202
    await db.updateImportStatus(jwt, id, 'parsing');

    // ── Return 202 immediately ─────────────────────────────────────────────
    // Async parse chain starts below; response is already sent.
    c.res = c.newResponse(
      JSON.stringify({ ok: true, status: 'parsing' }),
      202,
      { 'Content-Type': 'application/json' },
    );

    // ── 55-second guard (Pitfall 3 from RESEARCH.md) ───────────────────────
    let parseResolved = false;
    const timeoutHandle = setTimeout(async () => {
      if (!parseResolved) {
        console.error('[coach/imports] parse timeout for import:', id);
        try {
          await db.updateImportStatus(jwt, id, 'failed', {
            error_message:
              "Délai d'attente dépassé — le document était trop volumineux. Essayez avec un fichier plus court.",
          });
        } catch (e) {
          console.error('[coach/imports] timeout cleanup error:', e);
        }
      }
    }, 55_000);

    // ── Async parse background chain ───────────────────────────────────────
    // Runs after 202 is returned to client (non-blocking Promise chain).
    (async () => {
      try {
        // Step 1: Download file from Supabase Storage
        const storagePath = importRow.file_url; // set by POST / handler
        const { data: blobData, error: downloadError } = await adminSupabase.storage
          .from('ai-imports')
          .download(storagePath);

        if (downloadError || !blobData) {
          throw new Error(`Storage download failed: ${downloadError?.message ?? 'no data'}`);
        }

        const buffer = Buffer.from(await blobData.arrayBuffer());

        // Step 2: Dispatch to format-specific parser
        let parsedResult: Awaited<ReturnType<typeof parseWithVision>>;
        let finalPageCount: number | null = importRow.page_count;

        const mimeType = importRow.mime_type;

        if (mimeType === 'application/pdf') {
          // D-09: rasterize pages → batch Claude haiku vision
          const pageCount = await getPdfPageCount(buffer);
          finalPageCount = pageCount;
          const base64Pages = await rasterizePdf(buffer, 30); // max 30 pages (ROADMAP SC3)
          parsedResult = await parseWithVision(base64Pages);
        } else if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
          // D-12: single image → Claude haiku vision
          const base64Image = buffer.toString('base64');
          parsedResult = await parseWithVision([base64Image]);
        } else if (
          mimeType === 'application/vnd.ms-excel' ||
          mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
          // D-10: xlsx → CSV string → Claude haiku text
          const csvString = parseExcel(buffer);
          parsedResult = await parseWithText(csvString);
        } else if (
          mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          // D-11: mammoth → markdown → Claude haiku text
          const markdownString = await parseWord(buffer);
          parsedResult = await parseWithText(markdownString);
        } else {
          throw new Error(`Unsupported MIME type: ${mimeType}`);
        }

        // Step 3: Deduct credits on parse success (D-03 — never on failure)
        const idempotencyKey = `import:${id}`;
        const deductResult = await creditService.deductCredits(
          userId,
          'import',
          idempotencyKey,
          creditCost, // costOverride (Phase 28 D-01/D-02)
        );

        // Step 4: Update import row with parsed data + status='ready'
        await db.updateImportStatus(jwt, id, 'ready', {
          parsed_data: parsedResult as unknown as Record<string, unknown>,
          confidence_scores: {
            overall_confidence: (parsedResult as any).overall_confidence ?? null,
          },
          page_count: finalPageCount,
          parsed_at: new Date().toISOString(),
          credit_transaction_id: deductResult.success ? idempotencyKey : null,
        });

        parseResolved = true;
        clearTimeout(timeoutHandle);
      } catch (err: any) {
        parseResolved = true;
        clearTimeout(timeoutHandle);

        let errorMessage: string;
        if (err instanceof NoObjectGeneratedError) {
          errorMessage =
            "L'analyse a produit des données incomplètes. Réessayez ou importez un fichier différent.";
        } else {
          errorMessage = String(err.message ?? err).slice(0, 500);
        }

        console.error('[coach/imports] async parse error for import:', id, errorMessage);
        try {
          await db.updateImportStatus(jwt, id, 'failed', { error_message: errorMessage });
        } catch (updateErr) {
          console.error('[coach/imports] failed to update status to failed:', updateErr);
        }
      }
    })();

    return c.res;
  } catch (err: any) {
    console.error('[coach/imports] POST /:id/parse error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 5. GET /:id — poll import status + parsed_data ────────────────────────────
// T-28-04-06: RLS ai_imports_own ensures owner-only access; 404 for non-owned rows
importsRouter.get('/:id', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid import id' }, 400);
  try {
    const importRow = await db.getImport(jwt, userId, id);
    if (!importRow) return c.json({ error: 'Not found' }, 404);
    return c.json({ import: importRow });
  } catch (err: any) {
    console.error('[coach/imports] GET /:id error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── 6. PUT /:id/commit — commit parsed program to workout_programs ─────────────
// CRITICAL: registered AFTER GET /:id but with static suffix '/commit'
// Hono matches PUT /:id/commit before PUT /:id because the suffix is more specific.
// T-28-04-05: parsed_data is JSONB; downstream commitImport validates shape
importsRouter.put('/:id/commit', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  if (!UUID_REGEX.test(id)) return c.json({ error: 'Invalid import id' }, 400);

  let body: Partial<CommitImportBody>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  if (!body.parsed_data || typeof body.parsed_data !== 'object' || Array.isArray(body.parsed_data)) {
    return c.json({ error: 'parsed_data is required and must be an object' }, 400);
  }

  try {
    const importRow = await db.getImport(jwt, userId, id);
    if (!importRow) return c.json({ error: 'Not found' }, 404);

    // Must be 'ready' to commit (idempotency: already committed returns 409)
    if (importRow.status === 'committed') {
      return c.json({ error: 'Import already committed', program_id: importRow.committed_program_id }, 409);
    }
    if (importRow.status !== 'ready') {
      return c.json({ error: `Cannot commit import with status '${importRow.status}'` }, 409);
    }

    const result = await db.commitImport(
      jwt,
      userId,
      id,
      body.parsed_data,
      body.program_name,
      importRow.mode,
    );

    return c.json({ program_id: result.program_id });
  } catch (err: any) {
    console.error('[coach/imports] PUT /:id/commit error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});
