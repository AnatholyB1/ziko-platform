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

### 07-09 PostgreSQL client tools install
Decision: option-scoop-18 (scoop install postgresql, PostgreSQL client tools for pg_dump/pg_restore)
Timestamp: 2026-10-04T10:17:32Z
Reply: "option-scoop-18 (Recommended)"

### 07-11 second copy
Second copy: verified
Timestamp: 2026-10-04T20:27:24Z
Reply: "second copy ok 1732e313ee71, passphrase stored"

### 07-14 env remediation
Approved: env-remediation
Integration: none
Timestamp: 2026-10-05T10:01:53Z
Reply: "approve env-remediation (Recommended)" + "no-integration (Recommended)"

### 07-15 ci verify target
ci-verify-target: disabled
Timestamp: 2026-10-05T10:31:23Z
Source: 07-CONTEXT.md research-driven adjustment 7 (default disable)

### 07-15 ci token waiver
Waiver: ci_token_revoked (token ziko-ci-portfolio NOT revoked; user decision)
Timestamp: 2026-10-05T12:25:16Z
Reply: "I will not revoke it"
Reply: "Waive it, keep the token (Recommended)"
Note: token ziko-ci-portfolio showed "Never used" at decision time; ziko-ci-portfolio-2 stays (backs the migrate-portfolio CI secret). No revocation took place.

### 07-16 scratch deletion
Approved: delete scratch rkirvurggtgjlkeuhded
Timestamp: 2026-10-05T21:46:45Z
Reply: "Approve scratch deletion (Recommended)"

### 07-17 D-15 confirmation
Confirmation: yes (delete ziko slkobhavpwsubnsmuhya)
Timestamp: 2026-10-06T13:56:46Z
Reply: "yes"
