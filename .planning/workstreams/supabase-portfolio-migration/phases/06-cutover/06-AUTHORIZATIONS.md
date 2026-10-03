# Phase 6 Authorization Log

Append-only. Every Phase 6 typed-phrase gate greps this file for the exact approval line.

## Rules

- Each decision is recorded as a block of three lines:
  1. `Typed authorization: <exact phrase>` or `Typed authorization: none (option-abort)` on its own line
  2. an ISO timestamp line
  3. `Reply: "<verbatim user reply>"`
- Claude never writes an approve line that is not the user's verbatim reply in the conversation.
- Never edit or delete an earlier block. Corrections are new blocks.
- No pre-filled approve lines exist in this file. The phrases below are documentation only.

## Phase 6 phrases

Each phrase is listed in an example block prefixed `Phrase:` so that no line starts with the approval prefix.

    Phrase: approve main option-merge-working-branch
    Phrase: approve ubxllsvanurkwkohzxau option-preview-smoke
    Phrase: approve ubxllsvanurkwkohzxau option-cutover-delta
    Phrase: approve ubxllsvanurkwkohzxau option-backend-flip
    Phrase: approve ubxllsvanurkwkohzxau option-web-flip
    Phrase: approve ubxllsvanurkwkohzxau option-ci-repoint
    Phrase: approve ubxllsvanurkwkohzxau option-mobile-build

## Log

### 06-07 main merge
Typed authorization: approve main option-merge-working-branch
Timestamp: 2026-10-03T00:18:55Z
Reply: "approve main option-merge-working-branch"

### 06-12 preview smoke
Typed authorization: approve ubxllsvanurkwkohzxau option-preview-smoke
Timestamp: 2026-10-03T12:21:49Z
Reply: "approve ubxllsvanurkwkohzxau option-preview-smoke"

### 06-13 final delta
Typed authorization: approve ubxllsvanurkwkohzxau option-cutover-delta
Timestamp: 2026-10-03T13:51:10Z
Reply: "approve ubxllsvanurkwkohzxau option-cutover-delta"

### 06-15 backend flip
Typed authorization: approve ubxllsvanurkwkohzxau option-backend-flip
Timestamp: 2026-10-03T14:26:23Z
Reply: "approve ubxllsvanurkwkohzxau option-backend-flip"
