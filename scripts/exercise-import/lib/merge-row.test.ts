// Unit tests for scripts/exercise-import/lib/merge-row.ts
// Follows the call-recording stub-client convention established in
// supabase-client.test.ts: a shared `calls: string[]` array records a
// label for every from()/select()/insert()/update()/eq()/single()/
// storage.upload() invocation, so tests can assert ORDER, not just
// presence. No real network I/O, no real image file, no real Supabase
// client anywhere in this file.
import { describe, it, expect, vi } from 'vitest';
import {
  processRow,
  EXERCISE_MEDIA_BUCKET,
  type MergeRowInput,
  type MergeRowDeps,
} from './merge-row';
import type { DatasetExercise } from './types';

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeDatasetRecord(overrides: Partial<DatasetExercise> = {}): DatasetExercise {
  return {
    id: '0001',
    name: 'Push-up',
    category: 'strength',
    body_part: 'chest',
    equipment: 'body weight',
    instructions: { en: 'Do a push-up.', fr: 'Faites une pompe.' },
    instruction_steps: { en: ['Step 1', 'Step 2'], fr: ['Étape 1', 'Étape 2'] },
    muscle_group: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    target: 'pectorals',
    media_id: 'm0001',
    image: 'images/0001.jpg',
    gif_url: 'videos/0001.gif',
    attribution: 'Gym visual',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function matchedInput(overrides: Partial<MergeRowInput> = {}): MergeRowInput {
  return {
    kind: 'matched',
    sourceId: '0001',
    exerciseId: 'orig-uuid-1234',
    datasetRecord: makeDatasetRecord(),
    ...overrides,
  };
}

function unmatchedNewInput(overrides: Partial<MergeRowInput> = {}): MergeRowInput {
  return {
    kind: 'unmatched_new',
    sourceId: '0002',
    exerciseId: null,
    datasetRecord: makeDatasetRecord({ id: '0002', name: 'New Exercise' }),
    ...overrides,
  };
}

function needsReviewInput(overrides: Partial<MergeRowInput> = {}): MergeRowInput {
  return {
    kind: 'needs_review',
    sourceId: 'legacy-uuid-9999',
    exerciseId: 'legacy-uuid-9999',
    datasetRecord: null,
    ...overrides,
  };
}

// ─── Stub client builder ────────────────────────────────────────────────────

interface StubOptions {
  failOn?: string; // exact call label to fail, e.g. 'exercises_merge_backup.insert'
  selectData?: Record<string, unknown>; // what exercises.select().eq().single() returns
}

/**
 * Builds a call-recording stub Supabase client. Every from()/select()/
 * insert()/update()/eq()/single()/storage.upload() invocation appends a
 * label to the shared `calls` array so tests can assert relative ordering.
 * `insertPayloads`/`updatePayloads`/`updateEqCalls`/`uploadCalls` expose
 * the exact arguments each call received. `deleteSpy`/`upsertSpy`/`rpcSpy`
 * are shared across every table so "never called" is trivial to assert.
 */
function makeStubClient(options: StubOptions = {}) {
  const { failOn, selectData = { id: 'existing-uuid-selected', name: 'Existing Name' } } = options;

  const calls: string[] = [];
  const insertPayloads: Array<{ table: string; payload: unknown }> = [];
  const updatePayloads: Array<{ table: string; payload: unknown }> = [];
  const updateEqCalls: Array<{ table: string; col: string; val: unknown }> = [];
  const selectEqCalls: Array<{ table: string; col: string; val: unknown }> = [];
  const uploadCalls: Array<{ path: string; buffer: Buffer; opts: unknown }> = [];

  const deleteSpy = vi.fn();
  const upsertSpy = vi.fn();
  const rpcSpy = vi.fn();

  function makeTableBuilder(table: string) {
    return {
      select: vi.fn(() => {
        calls.push(`${table}.select`);
        return {
          eq: vi.fn((col: string, val: unknown) => {
            selectEqCalls.push({ table, col, val });
            return {
              single: vi.fn(async () => {
                calls.push(`${table}.select.single`);
                const label = `${table}.select`;
                if (failOn === label) {
                  return { data: null, error: new Error(`stub failure: ${label}`) };
                }
                return { data: selectData, error: null };
              }),
            };
          }),
        };
      }),
      insert: vi.fn(async (row: unknown) => {
        insertPayloads.push({ table, payload: row });
        calls.push(`${table}.insert`);
        const label = `${table}.insert`;
        if (failOn === label) {
          return { data: null, error: new Error(`stub failure: ${label}`) };
        }
        return { data: row, error: null };
      }),
      update: vi.fn((payload: unknown) => {
        updatePayloads.push({ table, payload });
        return {
          eq: vi.fn(async (col: string, val: unknown) => {
            updateEqCalls.push({ table, col, val });
            calls.push(`${table}.update`);
            const label = `${table}.update`;
            if (failOn === label) {
              return { data: null, error: new Error(`stub failure: ${label}`) };
            }
            return { data: null, error: null };
          }),
        };
      }),
      delete: deleteSpy,
      upsert: upsertSpy,
    };
  }

  const tableBuilders = new Map<string, ReturnType<typeof makeTableBuilder>>();

  const client: any = {
    from: vi.fn((table: string) => {
      if (!tableBuilders.has(table)) tableBuilders.set(table, makeTableBuilder(table));
      return tableBuilders.get(table)!;
    }),
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(async (path: string, buffer: Buffer, opts: unknown) => {
          uploadCalls.push({ path, buffer, opts });
          const label = `storage.${bucket}.upload:${path}`;
          calls.push(label);
          if (failOn === 'storage.upload' || failOn === label) {
            return { data: null, error: new Error(`stub failure: ${label}`) };
          }
          return { data: { path }, error: null };
        }),
      })),
    },
    rpc: rpcSpy,
  };

  return {
    client,
    calls,
    insertPayloads,
    updatePayloads,
    updateEqCalls,
    selectEqCalls,
    uploadCalls,
    deleteSpy,
    upsertSpy,
    rpcSpy,
  };
}

// ─── Deps builder ───────────────────────────────────────────────────────────

function makeDeps(client: unknown, overrides: Partial<MergeRowDeps> = {}): MergeRowDeps {
  const SOURCE_BYTES = Buffer.from('source-bytes');
  const CAPPED_IMAGE = Buffer.from('capped-image-bytes');
  const CAPPED_GIF = Buffer.from('capped-gif-bytes');

  return {
    client: client as MergeRowDeps['client'],
    readMediaBytes: vi.fn(async (_path: string) => SOURCE_BYTES),
    capImage: vi.fn(async (_buf: Buffer) => CAPPED_IMAGE),
    capGif: vi.fn(async (_buf: Buffer) => CAPPED_GIF),
    withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    newId: vi.fn(() => 'new-uuid-0001'),
    ...overrides,
  } as MergeRowDeps;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('IMPORT-03 — matched rows UPDATE in place', () => {
  it('updates .eq(\'id\', original uuid); payload has no id/name/name_fr; newId never called', async () => {
    const { client, updateEqCalls, updatePayloads } = makeStubClient();
    const deps = makeDeps(client);
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    const result = await processRow(input, deps);

    expect(result.status).toBe('matched');
    expect(result.errorMessage).toBeNull();
    expect(result.exerciseId).toBe('orig-uuid-1234');
    expect(deps.newId).not.toHaveBeenCalled();

    expect(updateEqCalls).toEqual([{ table: 'exercises', col: 'id', val: 'orig-uuid-1234' }]);
    const payload = updatePayloads.find((p) => p.table === 'exercises')?.payload as Record<
      string,
      unknown
    >;
    expect(payload).toBeDefined();
    expect('id' in payload).toBe(false);
    expect('name' in payload).toBe(false);
    expect('name_fr' in payload).toBe(false);
  });
});

describe('IMPORT-03 — unmatched_new rows INSERT', () => {
  it('calls newId() once, derives upload paths from that id, uploads precede insert, payload carries id/name/is_custom:false', async () => {
    const { client, calls, insertPayloads, uploadCalls } = makeStubClient();
    const deps = makeDeps(client);
    const input = unmatchedNewInput();

    const result = await processRow(input, deps);

    expect(result.status).toBe('inserted');
    expect(result.errorMessage).toBeNull();
    expect(deps.newId).toHaveBeenCalledTimes(1);
    expect(result.exerciseId).toBe('new-uuid-0001');

    expect(uploadCalls.length).toBeGreaterThan(0);
    expect(uploadCalls.every((c) => c.path.startsWith('new-uuid-0001/'))).toBe(true);

    const insertIndex = calls.indexOf('exercises.insert');
    const uploadIndexes = calls
      .map((c, i) => (c.startsWith('storage.') ? i : -1))
      .filter((i) => i !== -1);
    expect(uploadIndexes.length).toBeGreaterThan(0);
    expect(Math.max(...uploadIndexes)).toBeLessThan(insertIndex);

    const payload = insertPayloads.find((p) => p.table === 'exercises')?.payload as Record<
      string,
      unknown
    >;
    expect(payload.id).toBe('new-uuid-0001');
    expect(payload.name).toBe('New Exercise');
    expect(payload.is_custom).toBe(false);
  });
});

describe('IMPORT-03 — never DELETE', () => {
  const cases: Array<[string, () => MergeRowInput]> = [
    ['matched', () => matchedInput()],
    ['unmatched_new', () => unmatchedNewInput()],
    ['needs_review', () => needsReviewInput()],
  ];

  it.each(cases)('never calls delete for a %s row', async (_label, buildInput) => {
    const { client, deleteSpy } = makeStubClient();
    const deps = makeDeps(client);

    await processRow(buildInput(), deps);

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

describe('IMPORT-05 — needs_review rows are untouched', () => {
  it('touches no exercises entry and no upload entry; status is needs_review', async () => {
    const { client, calls } = makeStubClient();
    const deps = makeDeps(client);
    const input = needsReviewInput();

    const result = await processRow(input, deps);

    expect(result.status).toBe('needs_review');
    expect(result.errorMessage).toBeNull();
    expect(result.exerciseId).toBe('legacy-uuid-9999');
    expect(calls.some((c) => c.startsWith('exercises.'))).toBe(false);
    expect(calls.some((c) => c.startsWith('storage.'))).toBe(false);
  });
});

describe('MEDIA-04 — backup precedes UPDATE', () => {
  it('backup insert index precedes update index and receives the exact select().single() row', async () => {
    const selectData = { id: 'orig-uuid-1234', name: 'Existing Name', category: 'strength' };
    const { client, calls, insertPayloads } = makeStubClient({ selectData });
    const deps = makeDeps(client);
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    await processRow(input, deps);

    const backupIndex = calls.indexOf('exercises_merge_backup.insert');
    const updateIndex = calls.indexOf('exercises.update');
    expect(backupIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(backupIndex).toBeLessThan(updateIndex);

    const backupPayload = insertPayloads.find((p) => p.table === 'exercises_merge_backup');
    expect(backupPayload?.payload).toEqual(selectData);
  });

  it('a failed backup insert leaves update uncalled and returns a non-null errorMessage', async () => {
    const { client, calls } = makeStubClient({ failOn: 'exercises_merge_backup.insert' });
    const deps = makeDeps(client);
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    const result = await processRow(input, deps);

    expect(result.errorMessage).not.toBeNull();
    expect(result.status).toBe('matched');
    expect(calls).not.toContain('exercises.update');
  });
});

describe('MEDIA-03 — only capped bytes are uploaded', () => {
  it('the uploaded buffers are the capImage/capGif outputs, never the readMediaBytes buffer', async () => {
    const { client, uploadCalls } = makeStubClient();
    const SOURCE = Buffer.from('raw-source-bytes');
    const CAP_IMAGE = Buffer.from('capped-image');
    const CAP_GIF = Buffer.from('capped-gif');
    const deps = makeDeps(client, {
      readMediaBytes: vi.fn(async () => SOURCE),
      capImage: vi.fn(async () => CAP_IMAGE),
      capGif: vi.fn(async () => CAP_GIF),
    });
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    await processRow(input, deps);

    const thumbUpload = uploadCalls.find((c) => c.path.endsWith('thumb.png'));
    const gifUpload = uploadCalls.find((c) => c.path.endsWith('animation.gif'));
    expect(thumbUpload?.buffer).toBe(CAP_IMAGE);
    expect(gifUpload?.buffer).toBe(CAP_GIF);
    expect(thumbUpload?.buffer).not.toBe(SOURCE);
    expect(gifUpload?.buffer).not.toBe(SOURCE);
  });
});

describe('D-06 — failures are contained', () => {
  const LEGAL_STATUSES = ['matched', 'inserted', 'skipped', 'needs_review'];

  it('resolves (never rejects) when media read fails', async () => {
    const { client } = makeStubClient();
    const deps = makeDeps(client, {
      readMediaBytes: vi.fn(async () => {
        throw new Error('media read failed');
      }),
    });
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    const result = await processRow(input, deps);

    expect(result.errorMessage).not.toBeNull();
    expect(LEGAL_STATUSES).toContain(result.status);
    expect(result.status).not.toBe('error');
  });

  it('resolves (never rejects) when a storage upload fails', async () => {
    const { client } = makeStubClient({ failOn: 'storage.upload' });
    const deps = makeDeps(client);
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    const result = await processRow(input, deps);

    expect(result.errorMessage).not.toBeNull();
    expect(LEGAL_STATUSES).toContain(result.status);
    expect(result.status).not.toBe('error');
  });

  it('resolves (never rejects) when the backup insert fails', async () => {
    const { client } = makeStubClient({ failOn: 'exercises_merge_backup.insert' });
    const deps = makeDeps(client);
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    const result = await processRow(input, deps);

    expect(result.errorMessage).not.toBeNull();
    expect(LEGAL_STATUSES).toContain(result.status);
    expect(result.status).not.toBe('error');
  });

  it('resolves (never rejects) when the exercises write fails', async () => {
    const { client } = makeStubClient({ failOn: 'exercises.update' });
    const deps = makeDeps(client);
    const input = matchedInput({ exerciseId: 'orig-uuid-1234' });

    const result = await processRow(input, deps);

    expect(result.errorMessage).not.toBeNull();
    expect(LEGAL_STATUSES).toContain(result.status);
    expect(result.status).not.toBe('error');
  });
});

describe('category guard', () => {
  it('a matched row with an unmappable category omits category from the update payload and sets categoryOmitted: true', async () => {
    const { client, updatePayloads } = makeStubClient();
    const deps = makeDeps(client);
    const record = makeDatasetRecord({ category: 'not-a-real-category' });
    const input = matchedInput({ exerciseId: 'orig-uuid-1234', datasetRecord: record });

    const result = await processRow(input, deps);

    expect(result.status).toBe('matched');
    expect(result.errorMessage).toBeNull();
    expect(result.categoryOmitted).toBe(true);
    const payload = updatePayloads.find((p) => p.table === 'exercises')?.payload as Record<
      string,
      unknown
    >;
    expect('category' in payload).toBe(false);
  });

  it('an unmatched_new row with an unmappable category never calls exercises.insert and returns exerciseId: null with an errorMessage naming the raw value', async () => {
    const { client, calls } = makeStubClient();
    const deps = makeDeps(client);
    const record = makeDatasetRecord({ id: '0002', name: 'New Exercise', category: 'bogus-category' });
    const input = unmatchedNewInput({ datasetRecord: record });

    const result = await processRow(input, deps);

    expect(result.exerciseId).toBeNull();
    expect(result.errorMessage).not.toBeNull();
    expect(result.errorMessage).toContain('bogus-category');
    expect(calls).not.toContain('exercises.insert');
  });
});

describe('FK safety', () => {
  it('a failed unmatched_new insert returns exerciseId: null so a follow-up import-log FK cannot be violated', async () => {
    const { client } = makeStubClient({ failOn: 'exercises.insert' });
    const deps = makeDeps(client);
    const input = unmatchedNewInput();

    const result = await processRow(input, deps);

    expect(result.exerciseId).toBeNull();
    expect(result.errorMessage).not.toBeNull();
  });
});

describe('EXERCISE_MEDIA_BUCKET', () => {
  it('is the exercise-media bucket name', () => {
    expect(EXERCISE_MEDIA_BUCKET).toBe('exercise-media');
  });
});
