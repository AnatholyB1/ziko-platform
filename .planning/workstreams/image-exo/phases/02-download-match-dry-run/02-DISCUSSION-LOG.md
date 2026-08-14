# Phase 2: Download & Match (Dry-Run) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 2-Download & Match (Dry-Run)
**Areas discussed:** Match tiers & fields, Report format & location, Ambiguous-match presentation, Fetch & manifest failure behavior

---

## Match tiers & fields

| Question | Selected |
|---|---|
| Name matches exactly but other fields conflict/unverifiable — what should the matcher do? | Let Claude decide |
| Match on name only, or also try name_fr (French)? | **Try name + name_fr** |
| Fuzzy matching aggressiveness (Tier 2)? | Let Claude decide |
| Last-resort Tier 3 attribute-based guess for exercises with no name match at all? | Let Claude decide |

**Options considered per question:**
1. Name/field-conflict handling: Trust name match / Downgrade to ambiguous / **Let Claude decide** ✓
2. Language scope: English `name` only / **Try name + name_fr** ✓ / Let Claude decide
3. Fuzzy threshold: Fuzzy similarity threshold / Normalized substring/word-overlap only / **Let Claude decide** ✓
4. Tier 3 guessing: Tier 3 attribute guess (always ambiguous) / No Tier 3 guessing / **Let Claude decide** ✓

**Notes:** User referenced STATE.md's own blocker note (dataset field names unverified) when deferring question 1 — explicitly wants the researcher to verify `hasaneyldrm/exercises-dataset`'s actual schema before locking matcher field logic.

---

## Report format & location

| Question | Selected |
|---|---|
| Report format? | **JSON** |
| Companion human-readable summary alongside JSON? | Let Claude decide |
| Report location? | **`.planning/workstreams/image-exo/reports/`** |
| Overwrite fixed filename or timestamped per run? | **Overwrite fixed filename** |

**Options considered per question:**
1. Format: Markdown / CSV / **JSON** ✓
2. Summary: JSON + Markdown summary / JSON only / **Let Claude decide** ✓
3. Location: **`.planning/workstreams/image-exo/reports/`** ✓ / `scripts/` output dir (gitignored) / Let Claude decide
4. Overwrite policy: **Overwrite fixed filename** ✓ / Timestamped per run / Let Claude decide

**Notes:** User chose JSON specifically because it doubles as Phase 3's direct merge-script input, not just a human-review artifact — this creates a follow-on tension (flagged in CONTEXT.md D-06) between "human-reviewable" (roadmap SC) and "machine-consumable" that planning must resolve.

---

## Ambiguous-match presentation

| Question | Selected |
|---|---|
| Top-N candidates with scores, or single best guess flagged uncertain? | Let Claude decide |
| Reviewer edits JSON inline, or ambiguous always routed to manual review separately? | Let Claude decide |
| How much manual review effort is acceptable? | Let Claude decide |

**Options considered per question:**
1. Presentation: Top-N candidates with scores / Single best guess, flagged uncertain / **Let Claude decide** ✓
2. Resolution mechanism: Reviewer edits the JSON inline / Report is read-only; ambiguous = always manual / **Let Claude decide** ✓
3. Review tolerance: Fine reviewing dozens/hundreds / Want it mostly automatic / **Let Claude decide** ✓

**Notes:** No strong preference expressed — user is comfortable letting planning calibrate based on actual data volume once the matcher runs.

---

## Fetch & manifest failure behavior

| Question | Selected |
|---|---|
| What should 'fail loudly' mean on manifest mismatch? | Let Claude decide |
| Fresh git clone every run, or reuse/pull existing clone? | Let Claude decide |
| Where should the cloned dataset live on disk? | Let Claude decide |
| Where should the fetch/match scripts themselves live? | Let Claude decide |

**Options considered per question:**
1. Failure mode: Hard exit, no report / Partial report with warnings / **Let Claude decide** ✓
2. Clone strategy: Always fresh clone / Reuse if present, git pull to update / **Let Claude decide** ✓
3. Dataset location: Inside repo, gitignored / Outside the repo (temp/system dir) / **Let Claude decide** ✓
4. Script location: New `scripts/exercise-import/` folder / Flat files in `scripts/` / **Let Claude decide** ✓

**Notes:** All deferred to planning/research. Discussion surfaced (as context for the planner) that this pipeline will likely be re-run multiple times while tuning the matcher — worth weighing against always-fresh-clone for iteration speed.

---

## Claude's Discretion

The majority of this phase's decisions were explicitly deferred by the user, consistently citing either (a) the unverified dataset schema (STATE.md blocker) or (b) a preference to see real data volume before committing to a specific mechanic. Deferred items, all noted in CONTEXT.md:
- Tier 1 conflict-resolution rule (name match vs. conflicting attributes)
- Tier 2 fuzzy-match algorithm/threshold
- Tier 3 attribute-based last-resort guessing (yes/no)
- Whether a Markdown summary accompanies the JSON report
- Ambiguous-match presentation format (top-N vs single guess)
- Whether the report is reviewer-editable or strictly read-only
- Manifest-mismatch failure severity (hard exit vs partial report)
- Git clone reuse strategy
- Dataset-on-disk location
- Fetch/match script folder layout

**Locked decisions** (not deferred): match both `name` + `name_fr` (D-01); JSON report format (D-05); report location `.planning/workstreams/image-exo/reports/` (D-07); fixed-filename overwrite on re-run (D-08).

## Deferred Ideas

None — discussion stayed within phase scope throughout. No scope-creep items came up.
