# Phase 7 Authorization Log

Append-only. Every Phase 7 gate that depends on a user decision reads this file for the exact decision line.

## Rules

- Each decision is recorded as a block under a `### 07-NN <step>` heading:
  1. the decision line on its own line (exact text, see the list below)
  2. `Timestamp: <ISO>`
  3. `Reply: "<verbatim user reply>"`
- Claude never writes a decision line that is not backed by the user's verbatim reply in the conversation.
- Never edit or delete an earlier block. Corrections are new blocks.
- The D-15 deletion confirmation is its own block and is never combined with any other approval.
- No pre-filled decision lines exist in this file. The lines below are documentation only.

## Phase 7 decision lines

Each line is listed prefixed `Phrase:` so that no line starts with a decision prefix.

    Phrase: Second copy: verified
    Phrase: Approved: env-remediation
    Phrase: ci-verify-target: disabled
    Phrase: Token revoked: ziko-ci-portfolio
    Phrase: Approved: delete scratch rkirvurggtgjlkeuhded
    Phrase: Confirmation: yes (delete ziko slkobhavpwsubnsmuhya)
    Phrase: Revoked: ziko-cutover-phase6

DECOM-01 (rollback window) is recorded as a waiver, see the first block below.

## Log

### 07-01 DECOM-01 waiver
Waiver: DECOM-01 rollback window WAIVED by user
Timestamp: 2026-10-04
Source: 07-CONTEXT.md D-01 (user decision during discuss-phase; rationale: no real mobile users, 39 ziko profiles, 0 new accounts since the flip)
