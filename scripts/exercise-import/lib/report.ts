/**
 * Report assembly, prior-decision merge, and Markdown rendering for the
 * exercise-import pipeline (IMPORT-02). Pure functions only — no
 * filesystem access, no Supabase client construction, no environment-
 * variable reads. match.ts (the entrypoint) performs all file I/O; this
 * module only builds and returns plain objects/strings, which keeps it
 * trivially unit-testable.
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */
import type { CategorizeAllResult } from './matcher';
import {
  MatchReportSchema,
  PHASE3_STATUS_HINT,
  type MatchReport,
  type ReportMatchedRow,
  type ReportUnmatchedNewRow,
  type ReportUnmatchedLegacyRow,
  type ReportAmbiguousRow,
} from './types';

// ─── buildReport ────────────────────────────────────────────────────────────

export interface BuildReportInput {
  categorized: CategorizeAllResult;
  datasetCount: number;
  productionCount: number;
  datasetCommit: string;
  tier2Threshold: number;
  generatedAt: string;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Assembles a schema-validated MatchReport from categorizeAll's output.
 * Stamps `phase3_status` on every row from PHASE3_STATUS_HINT (never a
 * hardcoded literal), sorts each category deterministically, and truncates
 * every candidates array to 3 entries (D-09) before validating the whole
 * object with MatchReportSchema.parse — a malformed report can never reach
 * disk.
 */
export function buildReport(input: BuildReportInput): MatchReport {
  const { categorized, datasetCount, productionCount, datasetCommit, tier2Threshold, generatedAt } = input;

  const matched: ReportMatchedRow[] = [...categorized.matched]
    .sort((a, b) => compareStrings(a.dataset_id, b.dataset_id))
    .map((row) => ({ ...row, phase3_status: PHASE3_STATUS_HINT.matched }));

  const unmatched_new: ReportUnmatchedNewRow[] = [...categorized.unmatched_new]
    .sort((a, b) => compareStrings(a.dataset_id, b.dataset_id))
    .map((row) => ({ ...row, phase3_status: PHASE3_STATUS_HINT.unmatched_new }));

  const unmatched_legacy: ReportUnmatchedLegacyRow[] = [...categorized.unmatched_legacy]
    .sort((a, b) => compareStrings(a.production_name, b.production_name))
    .map((row) => ({ ...row, phase3_status: PHASE3_STATUS_HINT.unmatched_legacy }));

  const ambiguous: ReportAmbiguousRow[] = [...categorized.ambiguous]
    .sort((a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0))
    .map((row) => ({
      ...row,
      candidates: row.candidates.slice(0, 3),
      phase3_status: PHASE3_STATUS_HINT.ambiguous,
      stale_decision: false,
    }));

  const report = {
    generated_at: generatedAt,
    dataset_commit: datasetCommit,
    dataset_count: datasetCount,
    production_count: productionCount,
    thresholds: { tier2: tier2Threshold },
    warnings: { duplicate_production_names: categorized.duplicate_production_names },
    counts: {
      matched: matched.length,
      unmatched_new: unmatched_new.length,
      unmatched_legacy: unmatched_legacy.length,
      ambiguous: ambiguous.length,
    },
    matched,
    unmatched_new,
    unmatched_legacy,
    ambiguous,
  };

  return MatchReportSchema.parse(report);
}

// ─── mergePriorHumanDecisions ───────────────────────────────────────────────

export interface MergeResult {
  report: MatchReport;
  carriedForward: number;
  stale: number;
}

/**
 * Carries forward every non-null `human_decision` from `priorReport`'s
 * ambiguous rows onto `newReport`'s matching rows (by `dataset_id`). If a
 * carried-forward `{ action: 'match', exercise_id }` decision no longer
 * names one of the row's current candidates, the decision is still kept but
 * `stale_decision` is set true and counted in `stale`. A prior ambiguous
 * `dataset_id` that is no longer ambiguous in `newReport` is dropped
 * silently — it must never resurrect a phantom row. This is the D-08
 * safety net: overwriting a fixed filename on every re-run must never
 * destroy reviewer work.
 */
export function mergePriorHumanDecisions(
  newReport: MatchReport,
  priorReport: MatchReport | null,
): MergeResult {
  if (!priorReport) {
    return { report: newReport, carriedForward: 0, stale: 0 };
  }

  const priorByDatasetId = new Map(priorReport.ambiguous.map((row) => [row.dataset_id, row]));

  let carriedForward = 0;
  let stale = 0;

  const ambiguous: ReportAmbiguousRow[] = newReport.ambiguous.map((row) => {
    const prior = priorByDatasetId.get(row.dataset_id);
    if (!prior || prior.human_decision === null) {
      return row;
    }

    carriedForward += 1;

    let staleDecision = false;
    const priorDecision = prior.human_decision;
    if (priorDecision.action === 'match') {
      const targetExerciseId = priorDecision.exercise_id;
      const stillCandidate = row.candidates.some(
        (candidate) => candidate.exercise_id === targetExerciseId,
      );
      if (!stillCandidate) {
        staleDecision = true;
        stale += 1;
      }
    }

    return { ...row, human_decision: prior.human_decision, stale_decision: staleDecision };
  });

  const report: MatchReport = { ...newReport, ambiguous };
  return { report, carriedForward, stale };
}

// ─── renderMarkdown ─────────────────────────────────────────────────────────

const SAMPLE_SIZE = 20;

function pushSampleSection<T>(
  lines: string[],
  title: string,
  rows: T[],
  renderRow: (row: T) => string,
): void {
  lines.push(`## ${title}`);
  lines.push('');
  if (rows.length === 0) {
    lines.push('none.');
  } else {
    for (const row of rows.slice(0, SAMPLE_SIZE)) lines.push(renderRow(row));
    if (rows.length > SAMPLE_SIZE) {
      lines.push(`... and ${rows.length - SAMPLE_SIZE} more — see match-report.json`);
    }
  }
  lines.push('');
}

function formatPercent(count: number, total: number): string {
  if (total <= 0) return 'N/A';
  return `${((count / total) * 100).toFixed(1)}%`;
}

/**
 * Renders a reviewer-oriented Markdown summary of a MatchReport — not a
 * dump of the JSON. Every ambiguous row is rendered in full (never
 * truncated, since that is the section the reviewer actually works
 * through); matched/unmatched sections are capped at a 20-row sample.
 */
export function renderMarkdown(report: MatchReport): string {
  const lines: string[] = [];

  lines.push('# Exercise Import — Match Report');
  lines.push('');
  lines.push(`Generated: ${report.generated_at}  |  Dataset commit: \`${report.dataset_commit}\``);
  lines.push('');

  // Counts table.
  lines.push('## Summary');
  lines.push('');
  lines.push('| Category | Count | % of dataset | phase3_status |');
  lines.push('| --- | --- | --- | --- |');
  lines.push(
    `| Matched | ${report.counts.matched} | ${formatPercent(report.counts.matched, report.dataset_count)} | ${PHASE3_STATUS_HINT.matched} |`,
  );
  lines.push(
    `| Unmatched (new) | ${report.counts.unmatched_new} | ${formatPercent(report.counts.unmatched_new, report.dataset_count)} | ${PHASE3_STATUS_HINT.unmatched_new} |`,
  );
  lines.push(
    `| Unmatched (legacy) | ${report.counts.unmatched_legacy} | ${formatPercent(report.counts.unmatched_legacy, report.dataset_count)} | ${PHASE3_STATUS_HINT.unmatched_legacy} |`,
  );
  lines.push(
    `| Ambiguous | ${report.counts.ambiguous} | ${formatPercent(report.counts.ambiguous, report.dataset_count)} | ${PHASE3_STATUS_HINT.ambiguous} |`,
  );
  lines.push('');
  lines.push(
    `Dataset rows: ${report.dataset_count}  |  Production rows: ${report.production_count}  |  Tier 2 threshold: ${report.thresholds.tier2}`,
  );
  lines.push('');

  // Data quality warnings.
  lines.push('## Data quality warnings');
  lines.push('');
  if (report.warnings.duplicate_production_names.length === 0) {
    lines.push('none — no duplicate production names detected.');
  } else {
    for (const dup of report.warnings.duplicate_production_names) {
      lines.push(
        `- \`${dup.normalized_name}\` — ${dup.exercise_ids.length} production rows: ${dup.exercise_ids.join(', ')}`,
      );
    }
  }
  lines.push('');

  // Ambiguous — needs your decision. Never truncated.
  lines.push('## Ambiguous — needs your decision');
  lines.push('');
  if (report.ambiguous.length === 0) {
    lines.push('none.');
  } else {
    for (const row of report.ambiguous) {
      lines.push(`### ${row.dataset_name} (dataset_id: ${row.dataset_id})`);
      lines.push('');
      const staleNote = row.stale_decision
        ? ' — **stale prior decision: candidate no longer offered**'
        : '';
      lines.push(`Reason: ${row.reason}${staleNote}`);
      lines.push('');
      lines.push('Candidates:');
      for (const candidate of row.candidates) {
        lines.push(
          `- ${candidate.production_name} (\`${candidate.exercise_id}\`) — score ${candidate.score.toFixed(2)}, ${candidate.tier}, matched_on ${candidate.matched_on} — paste to approve: \`{"action":"match","exercise_id":"${candidate.exercise_id}"}\``,
        );
      }
      lines.push('');
      lines.push(`Current human_decision: \`${JSON.stringify(row.human_decision)}\``);
      lines.push('');
    }
  }

  // Matched with field conflicts.
  const conflicted = report.matched.filter((row) => row.field_conflicts.length > 0);
  lines.push('## Matched with field conflicts');
  lines.push('');
  if (conflicted.length === 0) {
    lines.push('none.');
  } else {
    for (const row of conflicted) {
      lines.push(
        `- ${row.dataset_name} -> ${row.production_name} (\`${row.exercise_id}\`) — conflicts: ${row.field_conflicts.join(', ')}`,
      );
    }
  }
  lines.push('');

  // Sample sections.
  pushSampleSection(lines, 'Matched (sample)', report.matched, (row) => {
    return `- ${row.dataset_name} -> ${row.production_name} (\`${row.exercise_id}\`), tier ${row.tier}, score ${row.score.toFixed(2)}`;
  });
  pushSampleSection(lines, 'Unmatched — new (sample)', report.unmatched_new, (row) => {
    return `- ${row.dataset_name} (dataset_id ${row.dataset_id}) — ${row.body_part} / ${row.equipment}`;
  });
  pushSampleSection(lines, 'Unmatched — legacy (sample)', report.unmatched_legacy, (row) => {
    return `- ${row.production_name} (\`${row.exercise_id}\`)`;
  });

  // How to approve.
  lines.push('## How to approve');
  lines.push('');
  lines.push(
    'Edit `human_decision` on ambiguous rows in `match-report.json`, then commit both `match-report.json` and `match-report.md`. The committed report is what Phase 3 treats as approved.',
  );
  lines.push('');

  return lines.join('\n');
}
