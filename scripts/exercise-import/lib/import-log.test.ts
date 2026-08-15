// Unit tests for scripts/exercise-import/lib/import-log.ts
// Pure functions only — hand-built row fixtures, no Supabase mock needed.
import { describe, it, expect } from 'vitest';
import {
  computeResumeState,
  reduceLatestBySourceId,
  buildResumeMap,
  type ImportLogRow,
} from './import-log';

function makeRow(overrides: Partial<ImportLogRow> & Pick<ImportLogRow, 'source_id'>): ImportLogRow {
  return {
    source_id: overrides.source_id,
    exercise_id: overrides.exercise_id ?? null,
    status: overrides.status ?? 'matched',
    error_message: overrides.error_message ?? null,
    processed_at: overrides.processed_at ?? '2026-08-15T00:00:00.000Z',
  };
}

// ─── computeResumeState ─────────────────────────────────────────────────────

describe('computeResumeState', () => {
  it('returns "unprocessed" for undefined', () => {
    expect(computeResumeState(undefined)).toBe('unprocessed');
  });

  it('returns "retry" when the latest row has a non-null error_message (D-08 auto-retry)', () => {
    const row = makeRow({ source_id: '0001', status: 'matched', error_message: 'boom' });
    expect(computeResumeState(row)).toBe('retry');
  });

  it('returns "done" when status is "matched" and error_message is null', () => {
    const row = makeRow({ source_id: '0001', status: 'matched', error_message: null });
    expect(computeResumeState(row)).toBe('done');
  });

  it('returns "done" when status is "inserted" and error_message is null', () => {
    const row = makeRow({ source_id: '0002', status: 'inserted', error_message: null });
    expect(computeResumeState(row)).toBe('done');
  });

  it('returns "done" when status is "needs_review" and error_message is null', () => {
    const row = makeRow({ source_id: '0003', status: 'needs_review', error_message: null });
    expect(computeResumeState(row)).toBe('done');
  });

  it('returns "done" when status is "skipped" and error_message is null', () => {
    const row = makeRow({ source_id: '0004', status: 'skipped', error_message: null });
    expect(computeResumeState(row)).toBe('done');
  });
});

// ─── reduceLatestBySourceId ─────────────────────────────────────────────────

describe('reduceLatestBySourceId', () => {
  it('picks the row with the greatest processed_at per source_id, given arbitrary input order', () => {
    const rows: ImportLogRow[] = [
      makeRow({ source_id: '0001', processed_at: '2026-08-15T10:00:00.000Z', status: 'matched' }),
      makeRow({ source_id: '0001', processed_at: '2026-08-15T08:00:00.000Z', status: 'inserted' }),
      makeRow({ source_id: '0001', processed_at: '2026-08-15T12:00:00.000Z', status: 'needs_review' }),
    ];

    const result = reduceLatestBySourceId(rows);

    expect(result.get('0001')?.processed_at).toBe('2026-08-15T12:00:00.000Z');
    expect(result.get('0001')?.status).toBe('needs_review');
  });

  it('keeps a later successful row as the winner over an earlier errored row for the same source_id (done, not retry)', () => {
    const rows: ImportLogRow[] = [
      makeRow({
        source_id: '0001',
        processed_at: '2026-08-15T08:00:00.000Z',
        error_message: 'transient failure',
      }),
      makeRow({
        source_id: '0001',
        processed_at: '2026-08-15T09:00:00.000Z',
        error_message: null,
      }),
    ];

    const result = reduceLatestBySourceId(rows);

    expect(result.get('0001')?.error_message).toBeNull();
    expect(computeResumeState(result.get('0001'))).toBe('done');
  });

  it('keeps a later errored row as the winner over an earlier successful row for the same source_id', () => {
    const rows: ImportLogRow[] = [
      makeRow({
        source_id: '0001',
        processed_at: '2026-08-15T08:00:00.000Z',
        error_message: null,
      }),
      makeRow({
        source_id: '0001',
        processed_at: '2026-08-15T09:00:00.000Z',
        error_message: 'network error',
      }),
    ];

    const result = reduceLatestBySourceId(rows);

    expect(result.get('0001')?.error_message).toBe('network error');
    expect(computeResumeState(result.get('0001'))).toBe('retry');
  });

  it('produces an identical result regardless of input shuffle order', () => {
    const baseRows: ImportLogRow[] = [
      makeRow({ source_id: '0001', processed_at: '2026-08-15T08:00:00.000Z' }),
      makeRow({ source_id: '0001', processed_at: '2026-08-15T10:00:00.000Z' }),
      makeRow({ source_id: '0002', processed_at: '2026-08-15T09:00:00.000Z' }),
      makeRow({ source_id: '0002', processed_at: '2026-08-15T07:00:00.000Z' }),
      makeRow({ source_id: '0003', processed_at: '2026-08-15T11:00:00.000Z' }),
    ];

    const shuffled = [baseRows[4], baseRows[1], baseRows[3], baseRows[0], baseRows[2]];

    const resultOriginal = reduceLatestBySourceId(baseRows);
    const resultShuffled = reduceLatestBySourceId(shuffled);

    expect(resultShuffled.get('0001')?.processed_at).toBe(resultOriginal.get('0001')?.processed_at);
    expect(resultShuffled.get('0002')?.processed_at).toBe(resultOriginal.get('0002')?.processed_at);
    expect(resultShuffled.get('0003')?.processed_at).toBe(resultOriginal.get('0003')?.processed_at);
  });
});

// ─── buildResumeMap ─────────────────────────────────────────────────────────

describe('buildResumeMap', () => {
  it('returns the expected ResumeState per source_id over a mixed row set', () => {
    const rows: ImportLogRow[] = [
      // 0001: done (no error)
      makeRow({ source_id: '0001', processed_at: '2026-08-15T08:00:00.000Z', error_message: null }),
      // 0002: retry (errored, no fix)
      makeRow({ source_id: '0002', processed_at: '2026-08-15T08:00:00.000Z', error_message: 'boom' }),
      // 0003: errored then fixed -> done
      makeRow({ source_id: '0003', processed_at: '2026-08-15T08:00:00.000Z', error_message: 'boom' }),
      makeRow({ source_id: '0003', processed_at: '2026-08-15T09:00:00.000Z', error_message: null }),
      // 0004: succeeded then errored on retry -> retry
      makeRow({ source_id: '0004', processed_at: '2026-08-15T08:00:00.000Z', error_message: null }),
      makeRow({ source_id: '0004', processed_at: '2026-08-15T09:00:00.000Z', error_message: 'boom again' }),
    ];

    const result = buildResumeMap(rows);

    expect(result.get('0001')).toBe('done');
    expect(result.get('0002')).toBe('retry');
    expect(result.get('0003')).toBe('done');
    expect(result.get('0004')).toBe('retry');
    // Unprocessed source_id absent entirely from log -> not present in map at all.
    expect(result.has('9999')).toBe(false);
  });

  it('returns an empty map for an empty row set', () => {
    const result = buildResumeMap([]);
    expect(result.size).toBe(0);
  });
});
