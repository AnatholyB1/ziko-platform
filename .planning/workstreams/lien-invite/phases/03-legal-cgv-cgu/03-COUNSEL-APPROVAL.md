# Phase 3 — Counsel Approval Record (D-01, LEGAL-05)

This document is the written record required by D-01 and LEGAL-05: the phase does not close on
drafting alone, and Phase 4 (Credit-Gate Alignment) and Phase 6 (Founder Offer Go-Live) may only
rely on the CGV/CGU text once this record exists and names a real approval.

## Approval summary

| Field | Value |
|---|---|
| Approving counsel | Individual outside lawyer (solo practitioner, not a firm) — name withheld at the approver's request |
| Relationship to Ziko | Outside counsel, not Ziko staff |
| Approval date | 2026-08-15 |
| Selected checkpoint option | `approved-as-drafted` |
| Revisions applied | None to the drafted wording itself. The one open item — the Q6 notice-period figure — was supplied as **90 days / 90 jours** and substituted for the `[TBD]` placeholder in `SHUTDOWN_MODIFICATION_CLAUSE`. No other clause, heading, or sentence was changed. |
| Git SHA of the approved text | `04a24908ba622b3e44f58bf75002d55f83a35d02` |

**On the withheld name:** the approving lawyer explicitly declined to have their name recorded in
this document when asked directly. This is recorded here as a fact about how the approval was
obtained, not as a gap in the approval itself — the approval is real, dated, and tied to a specific
answer set (below); only the identifying detail of *who* gave it is withheld at their request. No
name has been fabricated or inferred to fill this field.

## Per-question resolution (03-COUNSEL-BRIEFING.md, Q1–Q7)

| # | Question (one-line) | Resolution |
|---|---|---|
| Q1 | Does "à vie" scoped to the Service's operating lifetime hold up under `pratique commerciale trompeuse`? | Approved as drafted. No wording change to `LIFETIME_SCOPE_SENTENCE`. |
| Q2 | Does the grey-list framing (narrow, justified, notice-bearing) hold for a free lifetime benefit vs. a paid one? | Approved as drafted. No wording change to `SHUTDOWN_MODIFICATION_CLAUSE`'s structure. |
| Q3 | Does a claimed founder spot survive an erasure request as an accepted contractual offer? | Approved as drafted — current CGV silence plus the RPC's existing behavior (identity erased, spot number retained but unclaimed) accepted as sufficient for launch. No CGV text added. |
| Q4 | Is advance notice plus continued use sufficient acceptance of the new AI-credit cap for any existing premium user? | Approved as drafted — moot for v1 per CRED-01's working assumption (no real `tier='premium'` users); answer kept on record for any future capacity change, no text change required now. |
| Q5 | Does the CGU's pre-existing general amendment clause (section 10, now section 10 pre-renumber / 10 in the CGU numbering) need the same grey-list narrowing as the new founder-offer clause? | Approved as drafted — left unmodified, as it was throughout plans 01–03. No text change. |
| Q6 | What advance-notice period (in days) should the shutdown clause commit to? | **Resolved: 90 days / 90 jours**, selected by the approver from a 30/60/90-day menu. Substituted for the `[TBD]` placeholder in `SHUTDOWN_MODIFICATION_CLAUSE` in both locales (commit `04a24908ba622b3e44f58bf75002d55f83a35d02`). |
| Q7 | Should the CGU's `[A COMPLÉTÉ]` court-designation placeholder be filled in, or is the CGV's generic "ordinary-law jurisdiction" pattern preferable? | Approved as drafted — the CGU's pre-existing `[A COMPLÉTÉ]` placeholder is left unmodified (it predates this phase and was already out of this phase's scope in plans 01–03); the CGV's own jurisdiction clause (section 10, "tribunaux compétents désignés par le droit commun") stands as drafted. No text change made by this plan. |

No revision was applied apart from the Q6 notice-period figure. Options `approved-with-revisions`
and `not-yet-reviewed` were not selected.

## LEGAL-05 statement

This CGV and CGU text — as it stands at commit `04a24908ba622b3e44f58bf75002d55f83a35d02` — is
**approved and, once merged, live**. Per LEGAL-05, Phase 4's credit-gate change and Phase 6's
feature-flag flip must not activate before this text is live in production. Concretely:

- Phase 4 (Credit-Gate Alignment) may begin planning and implementation now that this phase's
  blocking gate has cleared, but its code change must not be **activated** (feature flag flipped)
  before this legal text is live in production per Phase 6's activation checklist.
- Phase 6's activation checklist criterion 2 ("the credit-gate feature flag is flipped only after
  the CGU/CGV pages describing the AI-credit cap are already live") is the place this ordering
  constraint gets verified against production, not this record — this record establishes that the
  precondition text itself is approved and ready to ship.

**ROADMAP dependency check:** `.planning/workstreams/lien-invite/ROADMAP.md`'s Phase 4 entry
already states `**Depends on**: Phase 1 ..., Phase 3 (legal text must already be live per
LEGAL-05)` — confirmed present by reading the file during this plan's execution. No ROADMAP edit
was needed to establish this dependency; it predates this approval.

## What was NOT touched

Per `approved-as-drafted`, no clause wording changed apart from the Q6 figure substitution above.
Specifically left byte-identical: `AI_CREDIT_CAP_SENTENCE`, `LIFETIME_SCOPE_SENTENCE`,
`RETENTION_STATEMENT`, `LANGUAGE_PRECEDENCE_CLAUSE`, `ERASURE_REQUEST_STATEMENT`,
`CONSENT_CHECKBOX_LABEL`, `COLLECTION_POINT_NOTICE`, all ten CGV sections' surrounding prose, the
CGU's pre-existing section-10 general amendment clause, and the CGU's pre-existing `[A COMPLÉTÉ]`
jurisdiction placeholder (both left exactly as counsel reviewed them).

## Next step (this plan's own remaining task)

With this approval recorded, the draft-pending-review banner and the test assertions guarding its
presence are removed together, in one commit, immediately after this record is written — never
before it, per T-03-19's mitigation.
