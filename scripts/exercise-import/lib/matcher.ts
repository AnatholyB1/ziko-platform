/**
 * 3-tier precision-first matching engine for the exercise-import pipeline
 * (IMPORT-02). Pure functions only — no database client construction, no
 * filesystem reads, no environment-variable reads, no CommonJS-directory
 * or ESM-module-url globals. This module only compares in-memory records
 * and returns plain data; the entrypoint script does all I/O and printing.
 *
 * Tier ordering is deliberate and load-bearing:
 *  - Tier 1 (exact normalized name, against both production `name` and
 *    `name_fr`) runs to completion across the WHOLE dataset before Tier 2
 *    starts, so a fuzzy match can never steal a production row that some
 *    other dataset record matches exactly.
 *  - Tier 2 (fuzzy, conservative threshold) only sees production rows Tier
 *    1 left unconsumed.
 *  - Tier 3 (attribute overlap) is structurally incapable of producing a
 *    `matched` row — multiple distinct exercises can legitimately share
 *    body_part + equipment + target, so any Tier 3 hit is always reported
 *    `ambiguous`.
 */
import { normalizeExerciseName, similarityRatio, TIER2_THRESHOLD, groupByNormalizedName } from './normalize';
import type {
  DatasetExercise,
  ProductionExercise,
  Candidate,
  MatchedOn,
  MatchedRow,
  UnmatchedNewRow,
  UnmatchedLegacyRow,
  AmbiguousRow,
} from './types';

// ─── Duplicate-name safety check (Pitfall 4 / T-02-10) ────────────────────

/**
 * Groups production rows by normalized `name` and, separately, by
 * normalized `name_fr`, returning every group of size > 1. Production
 * `name` has no database-level uniqueness constraint, so this makes a
 * latent data-quality issue visible in the report instead of letting an
 * array-valued index silently carry a collision through unnoticed.
 * Reporting only — never throws, never filters production rows.
 */
export function findDuplicateNames(
  production: ProductionExercise[],
): Array<{ normalized_name: string; exercise_ids: string[] }> {
  const results: Array<{ normalized_name: string; exercise_ids: string[] }> = [];

  const byName = groupByNormalizedName(production, (row) => row.name);
  for (const [normalizedName, rows] of byName) {
    if (rows.length > 1) {
      results.push({ normalized_name: normalizedName, exercise_ids: rows.map((row) => row.id) });
    }
  }

  const byNameFr = groupByNormalizedName(production, (row) => row.name_fr);
  for (const [normalizedName, rows] of byNameFr) {
    if (rows.length > 1) {
      results.push({ normalized_name: normalizedName, exercise_ids: rows.map((row) => row.id) });
    }
  }

  return results;
}

// ─── Tier 1: exact normalized name ─────────────────────────────────────────

export interface NameIndex {
  byName: Map<string, ProductionExercise[]>;
  byNameFr: Map<string, ProductionExercise[]>;
}

/**
 * Builds the Tier 1 lookup index. Values are ARRAYS, never a single row,
 * precisely so a duplicate normalized name cannot silently drop a row via
 * a plain `Map.set()` collision.
 */
export function buildNameIndex(production: ProductionExercise[]): NameIndex {
  return {
    byName: groupByNormalizedName(production, (row) => row.name),
    byNameFr: groupByNormalizedName(production, (row) => row.name_fr),
  };
}

/**
 * Tries the index's `byName` map first; if that yields zero rows, falls
 * back to `byNameFr`. Returns the raw row array (length 0, 1, or more) —
 * the caller decides matched vs. ambiguous, this function never picks a
 * winner among multiple candidates.
 */
export function tier1Match(
  dataset: DatasetExercise,
  index: NameIndex,
): { rows: ProductionExercise[]; matched_on: MatchedOn } {
  const normalized = normalizeExerciseName(dataset.name);

  const byNameRows = index.byName.get(normalized);
  if (byNameRows && byNameRows.length > 0) {
    return { rows: byNameRows, matched_on: 'name' };
  }

  const byNameFrRows = index.byNameFr.get(normalized);
  if (byNameFrRows && byNameFrRows.length > 0) {
    return { rows: byNameFrRows, matched_on: 'name_fr' };
  }

  return { rows: [], matched_on: 'name' };
}

// ─── Tier 2: fuzzy, conservative ───────────────────────────────────────────

/**
 * Scores `dataset` against every row in `production` using the shared
 * similarity function, comparing against both `name` and `name_fr` and
 * keeping whichever score is higher (and which field produced it). Only
 * rows scoring at or above the shared conservative threshold are
 * returned, sorted by score descending. Callers pass an already-filtered
 * `production` array (typically the rows Tier 1 left unconsumed) — this
 * function does not track consumption itself.
 */
export function tier2Match(dataset: DatasetExercise, production: ProductionExercise[]): Candidate[] {
  const normalizedDatasetName = normalizeExerciseName(dataset.name);
  const candidates: Candidate[] = [];

  for (const row of production) {
    const scoreAgainstName = similarityRatio(normalizedDatasetName, normalizeExerciseName(row.name));
    let bestScore = scoreAgainstName;
    let bestMatchedOn: MatchedOn = 'name';

    if (row.name_fr) {
      const scoreAgainstNameFr = similarityRatio(normalizedDatasetName, normalizeExerciseName(row.name_fr));
      if (scoreAgainstNameFr > bestScore) {
        bestScore = scoreAgainstNameFr;
        bestMatchedOn = 'name_fr';
      }
    }

    if (bestScore >= TIER2_THRESHOLD) {
      candidates.push({
        exercise_id: row.id,
        production_name: row.name,
        production_name_fr: row.name_fr,
        score: bestScore,
        tier: 'tier2',
        matched_on: bestMatchedOn,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ─── Tier 3: attribute overlap (never confident) ───────────────────────────

function normalizedFieldsAgree(datasetValue: string | null | undefined, productionValue: string | null | undefined): boolean {
  if (datasetValue == null || productionValue == null) return false;
  const a = datasetValue.trim().toLowerCase();
  const b = productionValue.trim().toLowerCase();
  if (a === '' || b === '') return false;
  return a === b;
}

/**
 * Attribute-overlap candidates: counts agreement among body_part,
 * equipment, and target/target_muscle (case-insensitive, trimmed).
 * Requires at least 2 of 3 agreeing fields to produce a candidate at all.
 * Scored as `agreeing / 3`, sorted descending. Every returned candidate
 * carries `matched_on: 'attributes'` and `tier: 'tier3'` — the caller
 * (`categorizeAll`) must never place a Tier 3 result into `matched`;
 * multiple distinct exercises can legitimately share all three attributes.
 */
export function tier3Candidates(dataset: DatasetExercise, production: ProductionExercise[]): Candidate[] {
  const candidates: Candidate[] = [];

  for (const row of production) {
    let agreeing = 0;
    if (normalizedFieldsAgree(dataset.body_part, row.body_part)) agreeing += 1;
    if (normalizedFieldsAgree(dataset.equipment, row.equipment)) agreeing += 1;
    if (normalizedFieldsAgree(dataset.target, row.target_muscle)) agreeing += 1;

    if (agreeing >= 2) {
      candidates.push({
        exercise_id: row.id,
        production_name: row.name,
        production_name_fr: row.name_fr,
        score: agreeing / 3,
        tier: 'tier3',
        matched_on: 'attributes',
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ─── Field-conflict reporting (D-02) ───────────────────────────────────────

const CONFLICT_FIELDS: Array<{ label: 'body_part' | 'equipment' | 'target'; datasetKey: 'body_part' | 'equipment' | 'target' }> = [
  { label: 'body_part', datasetKey: 'body_part' },
  { label: 'equipment', datasetKey: 'equipment' },
  { label: 'target', datasetKey: 'target' },
];

/**
 * Returns the subset of ['body_part', 'equipment', 'target'] whose values
 * disagree between a dataset record and a production row it was matched
 * to on name (case-insensitive, trimmed comparison). A null/empty
 * production value counts as a conflict only when the dataset value is
 * non-empty, and is labeled `<field>:missing-in-production` so a reviewer
 * can tell a genuine disagreement apart from a gap. Per D-02, a conflict
 * never downgrades a name match to ambiguous — it is reported alongside
 * the matched row.
 */
export function computeFieldConflicts(dataset: DatasetExercise, production: ProductionExercise): string[] {
  const conflicts: string[] = [];

  for (const { label, datasetKey } of CONFLICT_FIELDS) {
    const datasetValue = (dataset[datasetKey] ?? '').trim().toLowerCase();
    const productionValue = label === 'target' ? production.target_muscle : production[label];
    const normalizedProductionValue = productionValue == null ? '' : productionValue.trim().toLowerCase();

    if (normalizedProductionValue === '') {
      if (datasetValue !== '') conflicts.push(`${label}:missing-in-production`);
      continue;
    }

    if (datasetValue !== normalizedProductionValue) conflicts.push(label);
  }

  return conflicts;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export interface CategorizeAllResult {
  matched: MatchedRow[];
  unmatched_new: UnmatchedNewRow[];
  unmatched_legacy: UnmatchedLegacyRow[];
  ambiguous: AmbiguousRow[];
  duplicate_production_names: Array<{ normalized_name: string; exercise_ids: string[] }>;
}

function toCandidateFromTier1(row: ProductionExercise, matchedOn: MatchedOn): Candidate {
  return {
    exercise_id: row.id,
    production_name: row.name,
    production_name_fr: row.name_fr,
    score: 1,
    tier: 'tier1',
    matched_on: matchedOn,
  };
}

/**
 * Runs every dataset record through Tier 1 -> Tier 2 -> Tier 3 in that
 * strict order (Tier 1 to completion across the whole dataset before
 * Tier 2 starts, matching the plan's precision-first ordering guarantee),
 * then derives `unmatched_legacy` from whatever production rows remain
 * neither consumed by a match nor offered as an ambiguous candidate.
 *
 * Invariants held by construction and asserted by the test suite:
 *  - `matched.length + unmatched_new.length + ambiguous.length === dataset.length`
 *  - no production id appears in both `matched` and `unmatched_legacy`
 *  - no production id appears more than once across `matched` (a Tier 1
 *    name index hit against an already-`consumed` row falls through to
 *    Tier 2/3 instead of double-claiming — see the Pass 1 comment below;
 *    real-world trigger: two dataset records sharing an identical name)
 *  - no production id appears in both `matched` and any `ambiguous` row's
 *    `candidates` (CR-01 fix, 02-REVIEW.md): every id ever offered as an
 *    ambiguous candidate is added to `consumed` at push time, so nothing
 *    later in the same run (same pass or a subsequent one) can silently
 *    auto-claim a row a human still needs to adjudicate. This also
 *    prevents an already-`consumed` row from being re-offered as a stale
 *    Tier 1 collision candidate (the static name index never shrinks).
 */
export function categorizeAll(dataset: DatasetExercise[], production: ProductionExercise[]): CategorizeAllResult {
  const duplicate_production_names = findDuplicateNames(production);
  const index = buildNameIndex(production);
  // `consumed` means "no longer available to offer/claim in this run" — it
  // holds both rows already placed in `matched` AND every row ever offered
  // as a candidate on an ambiguous row (CR-01 fix). Reusing one set for
  // both keeps the invariant matched ∩ ambiguous[].candidates === ∅ true
  // by construction rather than by a post-hoc reconciliation pass.
  const consumed = new Set<string>();

  const matched: MatchedRow[] = [];
  const unmatched_new: UnmatchedNewRow[] = [];
  const ambiguous: AmbiguousRow[] = [];

  // Pass 1 — Tier 1 across the entire dataset first.
  //
  // The index is built once from the full production array and never
  // shrinks as rows are consumed, so two DIFFERENT dataset records that
  // normalize to the same name (a genuine upstream duplicate — verified
  // live in the hasaneyldrm/exercises-dataset clone, e.g. two distinct
  // ids both named "Barbell Seated Calf Raise") would otherwise both
  // resolve to the same single production row and both get pushed to
  // `matched`, silently double-claiming one production id. Checking
  // `consumed` here is what stops that: the second dataset record with an
  // already-claimed target name falls through to Tier 2/3 against
  // whatever production rows remain, instead of producing a second
  // `matched` row for a production id that can only be UPDATEd once in
  // Phase 3.
  const afterTier1: DatasetExercise[] = [];
  for (const ex of dataset) {
    const tier1 = tier1Match(ex, index);

    if (tier1.rows.length === 1 && !consumed.has(tier1.rows[0].id)) {
      const row = tier1.rows[0];
      matched.push({
        dataset_id: ex.id,
        dataset_name: ex.name,
        exercise_id: row.id,
        production_name: row.name,
        tier: 'tier1',
        score: 1,
        matched_on: tier1.matched_on,
        field_conflicts: computeFieldConflicts(ex, row),
      });
      consumed.add(row.id);
    } else if (tier1.rows.length === 1 && consumed.has(tier1.rows[0].id)) {
      afterTier1.push(ex);
    } else if (tier1.rows.length > 1) {
      // CR-01 fix: `index` is a static snapshot built once and never
      // shrinks, so `tier1.rows` can include a row already claimed by an
      // earlier dataset record in THIS SAME pass (e.g. matched via
      // name_fr moments ago). Filter those out before presenting
      // candidates — never offer an already-consumed row as if it were
      // still available.
      const unconsumedRows = tier1.rows.filter((row) => !consumed.has(row.id));
      if (unconsumedRows.length === 0) {
        // Every row sharing this name was already claimed elsewhere in
        // this pass — nothing left to offer here; let Tier 2/3 have a
        // shot against whatever else remains.
        afterTier1.push(ex);
      } else {
        const candidates = unconsumedRows.slice(0, 3).map((row) => toCandidateFromTier1(row, tier1.matched_on));
        ambiguous.push({
          dataset_id: ex.id,
          dataset_name: ex.name,
          reason: 'tier1-name-collision',
          candidates,
          human_decision: null,
        });
        // Reserve every offered candidate so a later record (this pass or
        // a subsequent one) can never silently claim it out from under
        // this pending human decision (CR-01).
        for (const candidate of candidates) consumed.add(candidate.exercise_id);
      }
    } else {
      afterTier1.push(ex);
    }
  }

  // Pass 2 — Tier 2 against whatever Tier 1 left unconsumed.
  const afterTier2: DatasetExercise[] = [];
  for (const ex of afterTier1) {
    const unconsumed = production.filter((row) => !consumed.has(row.id));
    const candidates = tier2Match(ex, unconsumed);

    if (candidates.length === 1) {
      const winner = candidates[0];
      const winnerRow = unconsumed.find((row) => row.id === winner.exercise_id)!;
      matched.push({
        dataset_id: ex.id,
        dataset_name: ex.name,
        exercise_id: winner.exercise_id,
        production_name: winner.production_name,
        tier: 'tier2',
        score: winner.score,
        matched_on: winner.matched_on,
        field_conflicts: computeFieldConflicts(ex, winnerRow),
      });
      consumed.add(winner.exercise_id);
    } else if (candidates.length > 1) {
      const ambiguousCandidates = candidates.slice(0, 3);
      ambiguous.push({
        dataset_id: ex.id,
        dataset_name: ex.name,
        reason: 'tier2-multiple-candidates',
        candidates: ambiguousCandidates,
        human_decision: null,
      });
      // CR-01 fix: reserve so a later record's Tier 2 (recomputes
      // `unconsumed` fresh each iteration) or Tier 3 pass can never claim
      // a row this ambiguous entry is still offering to the reviewer.
      for (const candidate of ambiguousCandidates) consumed.add(candidate.exercise_id);
    } else {
      afterTier2.push(ex);
    }
  }

  // Pass 3 — Tier 3 last-resort attribute overlap. Never produces `matched`.
  for (const ex of afterTier2) {
    const unconsumed = production.filter((row) => !consumed.has(row.id));
    const candidates = tier3Candidates(ex, unconsumed);

    if (candidates.length > 0) {
      const ambiguousCandidates = candidates.slice(0, 3);
      ambiguous.push({
        dataset_id: ex.id,
        dataset_name: ex.name,
        reason: 'attribute-overlap-only',
        candidates: ambiguousCandidates,
        human_decision: null,
      });
      // CR-01 fix: reserve so a later Tier 3 record in this same pass
      // (unconsumed is recomputed fresh each iteration) does not also
      // offer the same row as a candidate on a second, independent
      // ambiguous entry — avoiding a double-approval race of the same
      // kind CR-01 describes, just entirely within Tier 3.
      for (const candidate of ambiguousCandidates) consumed.add(candidate.exercise_id);
    } else {
      unmatched_new.push({
        dataset_id: ex.id,
        dataset_name: ex.name,
        body_part: ex.body_part,
        equipment: ex.equipment,
        target: ex.target,
      });
    }
  }

  // unmatched_legacy: production rows neither consumed by a match nor
  // offered as a candidate on any ambiguous row — no double-counting.
  const ambiguousCandidateIds = new Set<string>();
  for (const row of ambiguous) {
    for (const candidate of row.candidates) ambiguousCandidateIds.add(candidate.exercise_id);
  }

  const unmatched_legacy: UnmatchedLegacyRow[] = [];
  for (const row of production) {
    if (consumed.has(row.id)) continue;
    if (ambiguousCandidateIds.has(row.id)) continue;
    unmatched_legacy.push({
      exercise_id: row.id,
      production_name: row.name,
      production_name_fr: row.name_fr,
      body_part: row.body_part,
      equipment: row.equipment,
      target_muscle: row.target_muscle,
    });
  }

  return { matched, unmatched_new, unmatched_legacy, ambiguous, duplicate_production_names };
}
