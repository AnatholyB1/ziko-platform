// Unit tests for scripts/exercise-import/lib/report.ts
import { describe, test, expect } from 'vitest';
import { buildReport, mergePriorHumanDecisions, renderMarkdown, type BuildReportInput } from './report';
import { MatchReportSchema, type MatchReport } from './types';
import type { CategorizeAllResult } from './matcher';
import type { MatchedRow, UnmatchedNewRow, UnmatchedLegacyRow, AmbiguousRow, Candidate } from './types';

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    exercise_id: 'prod-1',
    production_name: 'Barbell Squat',
    production_name_fr: null,
    score: 0.9,
    tier: 'tier2',
    matched_on: 'name',
    ...overrides,
  };
}

function makeMatchedRow(overrides: Partial<MatchedRow> = {}): MatchedRow {
  return {
    dataset_id: '0001',
    dataset_name: 'Barbell Squat',
    exercise_id: 'prod-1',
    production_name: 'Barbell Squat',
    tier: 'tier1',
    score: 1,
    matched_on: 'name',
    field_conflicts: [],
    ...overrides,
  };
}

function makeUnmatchedNewRow(overrides: Partial<UnmatchedNewRow> = {}): UnmatchedNewRow {
  return {
    dataset_id: '0002',
    dataset_name: 'Cable Crunch',
    body_part: 'waist',
    equipment: 'cable',
    target: 'abs',
    ...overrides,
  };
}

function makeUnmatchedLegacyRow(overrides: Partial<UnmatchedLegacyRow> = {}): UnmatchedLegacyRow {
  return {
    exercise_id: 'prod-2',
    production_name: 'Reverse Hyperextension',
    production_name_fr: null,
    body_part: 'back',
    equipment: 'machine',
    target_muscle: 'lower back',
    ...overrides,
  };
}

function makeAmbiguousRow(overrides: Partial<AmbiguousRow> = {}): AmbiguousRow {
  return {
    dataset_id: '0003',
    dataset_name: 'Lat Pulldown',
    reason: 'tier2-multiple-candidates',
    candidates: [makeCandidate()],
    human_decision: null,
    ...overrides,
  };
}

function makeCategorized(overrides: Partial<CategorizeAllResult> = {}): CategorizeAllResult {
  return {
    matched: [makeMatchedRow()],
    unmatched_new: [makeUnmatchedNewRow()],
    unmatched_legacy: [makeUnmatchedLegacyRow()],
    ambiguous: [makeAmbiguousRow()],
    duplicate_production_names: [],
    ...overrides,
  };
}

function makeBuildInput(overrides: Partial<BuildReportInput> = {}): BuildReportInput {
  return {
    categorized: makeCategorized(),
    datasetCount: 4,
    productionCount: 3,
    datasetCommit: 'abc1234',
    tier2Threshold: 0.87,
    generatedAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  };
}

// ─── buildReport ─────────────────────────────────────────────────────────

describe('buildReport', () => {
  test('output passes MatchReportSchema.parse without throwing', () => {
    const report = buildReport(makeBuildInput());
    expect(() => MatchReportSchema.parse(report)).not.toThrow();
  });

  test('counts equal the actual array lengths for a mixed fixture', () => {
    const report = buildReport(makeBuildInput());
    expect(report.counts.matched).toBe(report.matched.length);
    expect(report.counts.unmatched_new).toBe(report.unmatched_new.length);
    expect(report.counts.unmatched_legacy).toBe(report.unmatched_legacy.length);
    expect(report.counts.ambiguous).toBe(report.ambiguous.length);
  });

  test('every matched row has phase3_status matched, unmatched_new inserted, unmatched_legacy/ambiguous needs_review', () => {
    const report = buildReport(makeBuildInput());
    for (const row of report.matched) expect(row.phase3_status).toBe('matched');
    for (const row of report.unmatched_new) expect(row.phase3_status).toBe('inserted');
    for (const row of report.unmatched_legacy) expect(row.phase3_status).toBe('needs_review');
    for (const row of report.ambiguous) expect(row.phase3_status).toBe('needs_review');
  });

  test('no row anywhere in the report has phase3_status skipped', () => {
    const report = buildReport(makeBuildInput());
    const allStatuses = [
      ...report.matched.map((r) => r.phase3_status),
      ...report.unmatched_new.map((r) => r.phase3_status),
      ...report.unmatched_legacy.map((r) => r.phase3_status),
      ...report.ambiguous.map((r) => r.phase3_status),
    ];
    expect(allStatuses).not.toContain('skipped');
  });

  test('a candidates array supplied with 5 entries is truncated to 3', () => {
    const fiveCandidates = [1, 2, 3, 4, 5].map((n) =>
      makeCandidate({ exercise_id: `prod-${n}`, score: 1 - n * 0.01 }),
    );
    const report = buildReport(
      makeBuildInput({
        categorized: makeCategorized({
          ambiguous: [makeAmbiguousRow({ candidates: fiveCandidates })],
        }),
      }),
    );
    expect(report.ambiguous[0].candidates.length).toBe(3);
  });

  test('determinism: calling buildReport twice on the same input produces byte-identical JSON.stringify output', () => {
    const input = makeBuildInput();
    const first = buildReport(input);
    const second = buildReport(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('every ambiguous row gets stale_decision false by default', () => {
    const report = buildReport(makeBuildInput());
    for (const row of report.ambiguous) expect(row.stale_decision).toBe(false);
  });
});

// ─── mergePriorHumanDecisions ────────────────────────────────────────────

describe('mergePriorHumanDecisions', () => {
  test('carries a prior { action: "match", exercise_id } forward onto the matching dataset_id and reports carriedForward 1', () => {
    const newReport = buildReport(makeBuildInput());
    const priorReport: MatchReport = {
      ...newReport,
      ambiguous: newReport.ambiguous.map((row) => ({
        ...row,
        human_decision: { action: 'match', exercise_id: row.candidates[0].exercise_id },
      })),
    };

    const result = mergePriorHumanDecisions(newReport, priorReport);
    expect(result.carriedForward).toBe(1);
    expect(result.report.ambiguous[0].human_decision).toEqual({
      action: 'match',
      exercise_id: newReport.ambiguous[0].candidates[0].exercise_id,
    });
    expect(result.stale).toBe(0);
  });

  test('with a null prior returns the report unchanged with carriedForward 0', () => {
    const newReport = buildReport(makeBuildInput());
    const result = mergePriorHumanDecisions(newReport, null);
    expect(result.carriedForward).toBe(0);
    expect(result.stale).toBe(0);
    expect(result.report).toBe(newReport);
  });

  test('a prior decision whose exercise_id is no longer a candidate sets stale_decision true and is counted in stale', () => {
    const newReport = buildReport(makeBuildInput());
    const priorReport: MatchReport = {
      ...newReport,
      ambiguous: newReport.ambiguous.map((row) => ({
        ...row,
        human_decision: { action: 'match', exercise_id: 'no-longer-a-candidate' },
      })),
    };

    const result = mergePriorHumanDecisions(newReport, priorReport);
    expect(result.report.ambiguous[0].stale_decision).toBe(true);
    expect(result.stale).toBe(1);
    // The decision itself is still kept, not dropped.
    expect(result.report.ambiguous[0].human_decision).toEqual({
      action: 'match',
      exercise_id: 'no-longer-a-candidate',
    });
  });

  test('a dataset_id present in the prior report but no longer ambiguous produces no phantom row and no throw', () => {
    const newReport = buildReport(makeBuildInput());
    const priorReport: MatchReport = {
      ...newReport,
      ambiguous: [
        ...newReport.ambiguous,
        {
          dataset_id: '9999',
          dataset_name: 'Now Resolved Exercise',
          reason: 'tier2-multiple-candidates',
          candidates: [makeCandidate({ exercise_id: 'prod-99' })],
          human_decision: { action: 'insert_new' },
          phase3_status: 'needs_review',
          stale_decision: false,
        },
      ],
    };

    expect(() => mergePriorHumanDecisions(newReport, priorReport)).not.toThrow();
    const result = mergePriorHumanDecisions(newReport, priorReport);
    const phantom = result.report.ambiguous.find((row) => row.dataset_id === '9999');
    expect(phantom).toBeUndefined();
    expect(result.report.ambiguous.length).toBe(newReport.ambiguous.length);
  });

  test('an actionType of insert_new is carried forward without a stale check', () => {
    const newReport = buildReport(makeBuildInput());
    const priorReport: MatchReport = {
      ...newReport,
      ambiguous: newReport.ambiguous.map((row) => ({
        ...row,
        human_decision: { action: 'insert_new' },
      })),
    };

    const result = mergePriorHumanDecisions(newReport, priorReport);
    expect(result.carriedForward).toBe(1);
    expect(result.stale).toBe(0);
    expect(result.report.ambiguous[0].human_decision).toEqual({ action: 'insert_new' });
  });
});

// ─── renderMarkdown ──────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  test('output contains all four category counts', () => {
    const report = buildReport(makeBuildInput());
    const markdown = renderMarkdown(report);
    expect(markdown).toContain(`| Matched | ${report.counts.matched} |`);
    expect(markdown).toContain(`| Unmatched (new) | ${report.counts.unmatched_new} |`);
    expect(markdown).toContain(`| Unmatched (legacy) | ${report.counts.unmatched_legacy} |`);
    expect(markdown).toContain(`| Ambiguous | ${report.counts.ambiguous} |`);
  });

  test('contains every ambiguous dataset name (4-ambiguous-row fixture)', () => {
    const ambiguousRows = ['Row A', 'Row B', 'Row C', 'Row D'].map((name, i) =>
      makeAmbiguousRow({ dataset_id: `100${i}`, dataset_name: name }),
    );
    const report = buildReport(
      makeBuildInput({ categorized: makeCategorized({ ambiguous: ambiguousRows }) }),
    );
    const markdown = renderMarkdown(report);
    for (const name of ['Row A', 'Row B', 'Row C', 'Row D']) {
      expect(markdown).toContain(name);
    }
  });

  test('truncates a 30-row matched fixture to 20 rows plus a line containing "and 10 more"', () => {
    const matchedRows = Array.from({ length: 30 }, (_, i) =>
      makeMatchedRow({ dataset_id: String(i).padStart(4, '0'), exercise_id: `prod-${i}` }),
    );
    const report = buildReport(
      makeBuildInput({ categorized: makeCategorized({ matched: matchedRows }) }),
    );
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('and 10 more');
  });

  test('contains the substrings human_decision and match-report.json', () => {
    const report = buildReport(makeBuildInput());
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('human_decision');
    expect(markdown).toContain('match-report.json');
  });

  test('contains the substring dataset_commit', () => {
    const report = buildReport(makeBuildInput());
    const markdown = renderMarkdown(report);
    expect(markdown.toLowerCase()).toContain('dataset commit');
  });

  test('renders an explicit "none" line when duplicate_production_names is empty', () => {
    const report = buildReport(makeBuildInput());
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('none — no duplicate production names detected.');
  });

  test('lists duplicate production names when present', () => {
    const report = buildReport(
      makeBuildInput({
        categorized: makeCategorized({
          duplicate_production_names: [{ normalized_name: 'lat pulldown', exercise_ids: ['p1', 'p2'] }],
        }),
      }),
    );
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('lat pulldown');
  });
});
