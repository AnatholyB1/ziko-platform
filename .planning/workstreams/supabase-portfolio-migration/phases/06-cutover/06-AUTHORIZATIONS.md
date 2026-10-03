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
