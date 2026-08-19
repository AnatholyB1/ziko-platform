# Phase 3: Merge (Human-Approved Write) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 3-Merge (Human-Approved Write)
**Areas discussed:** UPDATE scope, Approval enforcement, Failure handling, Backup/rollback readiness

---

## UPDATE scope

| Option | Description | Selected |
|--------|-------------|----------|
| Media only | Only write image/gif storage paths; category/body_part/equipment/instructions untouched | |
| Media + attributes | Media + body_part/equipment/target_muscle/secondary_muscles/category; instructions untouched | |
| Full refresh (media + attributes + instructions) | Overwrite everything the dataset provides, including instructions text | ✓ |

**User's choice:** Full refresh (media + attributes + instructions)
**Notes:** Matches the milestone's "richer library" core value rather than a conservative patch.

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 adds the columns now | Add instructions_fr / instruction_steps (JSONB) in this phase's migration, populated during merge | |
| Defer to Phase 4 | Phase 3 stays strictly to IMPORT-03/04/05 + MEDIA-03/04; Phase 4 adds its own migration + backfill | |
| Let Claude decide | Claude's discretion — research the best fit during planning/research | ✓ |

**User's choice:** Let Claude decide
**Notes:** Flagged as a real tension in CONTEXT.md D-03 — "full refresh" already commits to overwriting instructions text, so whichever column shape is chosen must be populated during this phase's merge even if the column *addition* itself is debated.

| Option | Description | Selected |
|--------|-------------|----------|
| Production wins (skip conflicting fields) | Never overwrite a field flagged as conflicting | |
| Dataset wins (overwrite anyway) | Treat the dataset as source of truth for those fields too | ✓ |

**User's choice:** Dataset wins (overwrite anyway)
**Notes:** Consistent with treating this as a full library replacement. Production `name`/`name_fr` are not affected by this since the dataset has no French name field.

---

## Approval enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Approval field in the report itself | Reviewer hand-edits the JSON with approved_by/approved_at; merge refuses to run without it | |
| Interactive confirmation at merge time | merge.ts prints a summary and requires explicit operator confirmation before writing | ✓ |
| Both | Approval field AND interactive confirm | |

**User's choice:** Interactive confirmation at merge time
**Notes:** No persistent approval state added to the report schema — the live confirmation gate is what satisfies "no code path from fetch/match straight into merge."

| Option | Description | Selected |
|--------|-------------|----------|
| Single approval for the whole report | One confirmation covers matched + unmatched_new together | ✓ |
| Per-category approval | Separate confirmation for matched-updates vs new-inserts | |

**User's choice:** Single approval for the whole report

---

## Failure handling mid-run

| Option | Description | Selected |
|--------|-------------|----------|
| Log and continue | Record error in exercise_import_log, move to next row, run completes | ✓ |
| Halt immediately | Stop the entire run on first error | |
| Retry a few times, then log-and-continue | Bounded retry before giving up on a row | |

**User's choice:** Log and continue
**Notes:** One bad row out of 1,324 shouldn't block the rest of the batch.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-retry errored rows on next run | exercise_import_log error rows treated like unprocessed rows on next run | ✓ |
| Errored rows need manual review before retry | Flagged and skipped until a human clears them explicitly | |

**User's choice:** Auto-retry errored rows on next run

---

## Backup/rollback readiness

| Option | Description | Selected |
|--------|-------------|----------|
| Backup table only | exercises_merge_backup captures snapshots; restore is manual SQL later if ever needed | ✓ |
| Backup table + restore script | Also build and test a restore script this phase | |

**User's choice:** Backup table only
**Notes:** Matches the phase's literal success criteria — snapshot required, restore path not required.

| Option | Description | Selected |
|--------|-------------|----------|
| Full row snapshot | Every column of the pre-UPDATE row | ✓ |
| Changed columns only | Only the fields about to be overwritten | |

**User's choice:** Full row snapshot
**Notes:** Simplest and safest to restore from; storage cost irrelevant at 1,318 rows.

---

## Claude's Discretion

- Schema-gap resolution for bilingual/structured instructions (D-03) — Phase 3 vs Phase 4 migration placement
- Concrete retry count/backoff for transient failures before falling back to log-and-continue (D-07)
- Media resize/cap mechanics (library, source-resolution handling, format) to satisfy MEDIA-03
- Generic `needs_review` code path correctness for a hypothetical unmatched-legacy/ambiguous row, even though the current approved report has 0 of either

## Deferred Ideas

None — discussion stayed within phase scope.
