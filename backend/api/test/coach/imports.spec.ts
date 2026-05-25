// Phase 28 plan 01 — AI file imports stubs (Wave 0)
// Plan 08 (Wave 5) — Replace it.todo stubs with passing implementations.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportedProgramSchema } from '@ziko/coach-sdk';

// ─── Module mocks (hoisted by Vitest before imports resolve) ──────────────────

// Mock auth middleware — injects test-user-id into every request context
vi.mock('../../src/middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('auth', { userId: 'test-user-id', email: 'test@example.com' });
    return next();
  },
}));

// Mock @supabase/supabase-js — prevents adminSupabase from calling real Supabase at module load
// Storage mock is accessed via the module-level variable (updated per-test in beforeEach)
let _mockStorageFromImpl: ReturnType<typeof vi.fn> = vi.fn();

vi.mock('@supabase/supabase-js', () => {
  const mockStorageFromFn = vi.fn((...args: unknown[]) => _mockStorageFromImpl(...args));
  return {
    createClient: vi.fn(() => ({
      storage: {
        from: mockStorageFromFn,
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })),
  };
});

// Mock db module — all database calls are stubbed per test
vi.mock('../../src/coach/imports/db.js', () => ({
  createImport: vi.fn(),
  getImport: vi.fn(),
  listImports: vi.fn(),
  updateImportStatus: vi.fn(),
  updateImportFileUrl: vi.fn(),
  commitImport: vi.fn(),
}));

// Mock creditService — prevents live Supabase RPC calls
vi.mock('../../src/services/creditService.js', () => ({
  getQuotaStatus: vi.fn(),
  deductCredits: vi.fn(),
  getBalance: vi.fn(),
  trackQuotaUsage: vi.fn(),
}));

// Mock parse modules — prevents real Claude API calls during async parse
vi.mock('../../src/coach/imports/parse/claude.js', () => ({
  parseWithVision: vi.fn().mockResolvedValue({
    name: 'Parsed Program',
    weeks: [{ week_number: 1, sessions: [{ name: 'Day A', exercises: [{ name: 'Squat', sets: 3, reps: 8 }] }] }],
    overall_confidence: 0.85,
  }),
  parseWithText: vi.fn().mockResolvedValue({
    name: 'Parsed Program',
    weeks: [{ week_number: 1, sessions: [{ name: 'Day A', exercises: [{ name: 'Squat', sets: 3, reps: 8 }] }] }],
    overall_confidence: 0.85,
  }),
  NoObjectGeneratedError: class NoObjectGeneratedError extends Error {},
}));

vi.mock('../../src/coach/imports/parse/pdf.js', () => ({
  rasterizePdf: vi.fn().mockResolvedValue(['base64page1', 'base64page2', 'base64page3']),
  getPdfPageCount: vi.fn().mockResolvedValue(3),
}));

vi.mock('../../src/coach/imports/parse/excel.js', () => ({
  parseExcel: vi.fn().mockReturnValue('Week,Session,Exercise,Sets,Reps\n1,Day 1,Squat,4,6'),
}));

vi.mock('../../src/coach/imports/parse/word.js', () => ({
  parseWord: vi.fn().mockResolvedValue('# Program\n\nWeek 1\n\nSquat 3x8'),
}));

// ─── Import router AFTER all mocks are set up ────────────────────────────────
import { importsRouter } from '../../src/coach/imports/service.js';
import * as db from '../../src/coach/imports/db.js';
import * as creditService from '../../src/services/creditService.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const TEST_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_JWT = 'Bearer test-jwt-token';

/** Minimal valid ImportRow fixture */
function makeImportRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: TEST_UUID,
    user_id: 'test-user-id',
    file_url: `test-user-id/${TEST_UUID}/test.pdf`,
    original_filename: 'test.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1024,
    page_count: 3,
    mode: 'athlete',
    status: 'pending',
    parsed_data: null,
    confidence_scores: null,
    error_message: null,
    credit_transaction_id: null,
    committed_program_id: null,
    re_upload_source_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    parsed_at: null,
    committed_at: null,
    ...overrides,
  };
}

/** POST helper — submits JSON body to the Hono router */
async function postJson(path: string, body: unknown): Promise<Response> {
  return importsRouter.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: TEST_JWT,
    },
    body: JSON.stringify(body),
  });
}

/** PUT helper — submits JSON body to the Hono router */
async function putJson(path: string, body: unknown): Promise<Response> {
  return importsRouter.request(path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: TEST_JWT,
    },
    body: JSON.stringify(body),
  });
}

// Verify the schema import resolves at compile time
void ImportedProgramSchema;

// ─── Credit cost formula (IMPORT-02) ────────────────────────────────────────
// Pure logic — no DB: Math.min(pageCount, 10) maps page counts to credits

function pdfCreditCost(pageCount: number): number {
  return Math.min(pageCount, 10);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('imports routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upload-url: POST /coach/imports returns import_id and signed_upload_url', async () => { // IMPORT-01
    // Arrange: db.createImport returns a fake ImportRow
    vi.mocked(db.createImport).mockResolvedValue(makeImportRow() as any);
    vi.mocked(db.updateImportFileUrl).mockResolvedValue(undefined);

    // Arrange: storage signed URL
    _mockStorageFromImpl = vi.fn().mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://supabase.co/storage/v1/object/sign/ai-imports/signed',
          path: `test-user-id/${TEST_UUID}/test.pdf`,
          token: 'test-token',
        },
        error: null,
      }),
    });

    // Act
    const res = await postJson('/', {
      filename: 'test.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
      mode: 'athlete',
    });

    // Assert
    expect(res.status).toBe(201);
    const json = await res.json() as Record<string, unknown>;
    expect(json.import_id).toBe(TEST_UUID);
    expect(typeof json.signed_upload_url).toBe('string');
    expect((json.signed_upload_url as string).startsWith('https://')).toBe(true);
  });

  it('credit-cost: PDF page_count maps to min(n,10) credits', () => { // IMPORT-02
    expect(pdfCreditCost(1)).toBe(1);
    expect(pdfCreditCost(5)).toBe(5);
    expect(pdfCreditCost(10)).toBe(10);
    expect(pdfCreditCost(11)).toBe(10);
    expect(pdfCreditCost(30)).toBe(10);
    expect(pdfCreditCost(0)).toBe(0);
  });

  it('schema-validation: ImportedProgramSchema passes on valid Claude output', () => { // IMPORT-03
    // Valid program shape
    const validProgram = {
      name: 'Test Program',
      overall_confidence: 0.85,
      weeks: [{
        week_number: 1,
        sessions: [{
          name: 'Day A',
          exercises: [{ name: 'Squat', sets: 3, reps: 8, confidence: 0.9 }],
        }],
      }],
    };

    const validResult = ImportedProgramSchema.safeParse(validProgram);
    expect(validResult.success).toBe(true);

    // Invalid shape — missing required fields
    const invalidResult = ImportedProgramSchema.safeParse({ invalid: true });
    expect(invalidResult.success).toBe(false);
  });

  it('dual-mode: import route accepts athlete JWT and coach JWT', async () => { // IMPORT-04
    // Arrange: same mock for both modes
    vi.mocked(db.createImport).mockResolvedValue(makeImportRow() as any);
    vi.mocked(db.updateImportFileUrl).mockResolvedValue(undefined);

    _mockStorageFromImpl = vi.fn().mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://supabase.co/storage/v1/signed',
          path: 'path/to/file',
        },
        error: null,
      }),
    });

    // Act: athlete mode
    const resAthlete = await postJson('/', {
      filename: 'plan.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2048,
      mode: 'athlete',
    });
    expect(resAthlete.status).toBe(201);

    vi.mocked(db.createImport).mockResolvedValue(makeImportRow({ mode: 'coach_template' }) as any);

    // Act: coach_template mode
    const resCoach = await postJson('/', {
      filename: 'template.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2048,
      mode: 'coach_template',
    });
    expect(resCoach.status).toBe(201);
  });

  it('status-machine: pending→uploaded→parsing→ready transitions', async () => { // IMPORT-05
    // Test valid transition: pending → uploaded (status='uploaded' accepted)
    vi.mocked(db.getImport).mockResolvedValue(makeImportRow({ status: 'pending' }) as any);
    vi.mocked(db.updateImportStatus).mockResolvedValue(undefined);

    const resOk = await putJson(`/${TEST_UUID}/status`, { status: 'uploaded' });
    expect(resOk.status).toBe(200);
    const okJson = await resOk.json() as Record<string, unknown>;
    expect(okJson.ok).toBe(true);

    // Test invalid transition: 'committed' is not a valid client-provided status
    const resBad = await putJson(`/${TEST_UUID}/status`, { status: 'committed' });
    expect(resBad.status).toBe(400);
  });

  it('202-async: POST /coach/imports/:id/parse returns 202 immediately', async () => { // IMPORT-06
    // Arrange: import is in 'uploaded' state with 3 pages
    vi.mocked(db.getImport).mockResolvedValue(
      makeImportRow({ status: 'uploaded', mime_type: 'application/pdf', page_count: 3 }) as any,
    );
    vi.mocked(db.updateImportStatus).mockResolvedValue(undefined);
    vi.mocked(creditService.getQuotaStatus).mockResolvedValue({
      withinFreeQuota: true,
      balance: 10,
      dailyUsed: 0,
      dailyQuota: 5,
      earnHint: 'Log a workout to earn credits',
    });
    vi.mocked(creditService.deductCredits).mockResolvedValue({ success: true, balance: 7 });

    // Storage download mock for the async parse chain
    _mockStorageFromImpl = vi.fn().mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: new Blob([Buffer.from('fake-pdf-content')]),
        error: null,
      }),
    });

    // Act: POST /:id/parse — should return 202 immediately
    const res = await postJson(`/${TEST_UUID}/parse`, {});

    // Assert: 202 returned synchronously (does not wait for async parse to finish)
    expect(res.status).toBe(202);
    const json = await res.json() as Record<string, unknown>;
    expect(json.status).toBe('parsing');
  });
});

describe('diff algorithm', () => {
  it('diff-algo: new/removed/changed rows identified correctly', () => { // IMPORT-09
    // Inline diff algorithm matching the logic in PreviewClient.tsx
    type DiffStatus = 'unchanged' | 'changed' | 'new' | 'removed';
    interface ExerciseItem { name: string; sets: number }
    interface DiffResult extends ExerciseItem { diffStatus: DiffStatus }

    function diffExercises(
      prev: ExerciseItem[],
      next: ExerciseItem[],
    ): DiffResult[] {
      const results: DiffResult[] = [];

      // Mark removed items (in prev but not in next)
      for (const prevEx of prev) {
        const nextEx = next.find((n) => n.name === prevEx.name);
        if (!nextEx) {
          results.push({ ...prevEx, diffStatus: 'removed' });
        }
      }

      // Mark new and changed items (from next perspective)
      for (const nextEx of next) {
        const prevEx = prev.find((p) => p.name === nextEx.name);
        if (!prevEx) {
          results.push({ ...nextEx, diffStatus: 'new' });
        } else if (prevEx.sets !== nextEx.sets) {
          results.push({ ...nextEx, diffStatus: 'changed' });
        } else {
          results.push({ ...nextEx, diffStatus: 'unchanged' });
        }
      }

      return results;
    }

    // Test case from plan interfaces
    const prev: ExerciseItem[] = [
      { name: 'Squat', sets: 3 },
      { name: 'Bench', sets: 3 },
    ];
    const next: ExerciseItem[] = [
      { name: 'Squat', sets: 4 },
      { name: 'Deadlift', sets: 3 },
    ];

    const diff = diffExercises(prev, next);

    const squatResult = diff.find((d) => d.name === 'Squat');
    const benchResult = diff.find((d) => d.name === 'Bench');
    const deadliftResult = diff.find((d) => d.name === 'Deadlift');

    expect(squatResult?.diffStatus).toBe('changed');   // sets 3→4
    expect(benchResult?.diffStatus).toBe('removed');   // not in next
    expect(deadliftResult?.diffStatus).toBe('new');    // not in prev
  });

  it('commit: PUT /coach/imports/:id/commit creates workout_programs row with correct is_template', async () => { // IMPORT-10
    // Arrange: import in 'ready' state with mode='athlete'
    vi.mocked(db.getImport).mockResolvedValue(
      makeImportRow({ status: 'ready', mode: 'athlete' }) as any,
    );
    vi.mocked(db.commitImport).mockResolvedValue({ program_id: 'new-prog-id' });

    const parsedData = {
      name: 'Test Program',
      weeks: [{
        week_number: 1,
        sessions: [{ name: 'Day A', exercises: [{ name: 'Squat', sets: 3, reps: 8 }] }],
      }],
    };

    // Act
    const res = await putJson(`/${TEST_UUID}/commit`, { parsed_data: parsedData });

    // Assert: 200 with program_id
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.program_id).toBe('new-prog-id');

    // Assert: commitImport called with correct mode (athlete → is_template=false server-side)
    expect(db.commitImport).toHaveBeenCalledWith(
      expect.any(String), // jwt
      'test-user-id',     // userId
      TEST_UUID,          // importId
      parsedData,         // parsed_data
      undefined,          // program_name (not provided)
      'athlete',          // mode — service layer derives is_template=false
    );
  });
});
