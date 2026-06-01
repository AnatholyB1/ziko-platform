# Phase 03: Persistence & Memory - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 03-Persistence Memory
**Areas discussed:** Save endpoint & DB schema, N feedbacks for memory, History view layout

---

## Save Endpoint & DB Schema

### Save route

| Option | Description | Selected |
|--------|-------------|----------|
| POST /coach/voice/save | Clean separation: /structure returns card, /save persists it. Only called on explicit [Sauvegarder] press. | ✓ |
| /structure saves automatically | Structure + persist in one call. Simpler but creates a DB record on every structuring even if card is discarded. | |

**User's choice:** POST /coach/voice/save (Recommended)

---

### DB fields

| Option | Description | Selected |
|--------|-------------|----------|
| coach_id + athlete_id + transcript + card | Explicit coach_id enables RLS. Aligns with all other coach tables. | ✓ |
| athlete_id + transcript + card only | Leaner schema, coach identity from JWT. | |
| Also store tags as separate column | TEXT[] column for tag filtering without JSON parsing. | |

**User's choice:** coach_id + athlete_id + transcript + card (Recommended)

---

### RLS policy

| Option | Description | Selected |
|--------|-------------|----------|
| Coach only | auth.uid() = coach_id. Athlete never sees this. Consistent with coach_client_notes. | ✓ |
| Coach + athlete can read their own | Useful for sharing feedback later, but out of scope v1.9. | |

**User's choice:** Coach only (Recommended)

---

## N Feedbacks for Memory

### N value

| Option | Description | Selected |
|--------|-------------|----------|
| 3 | ~600 extra tokens. Good balance for Sonnet. | ✓ |
| 5 | More trend detection, ~1000 extra tokens. | |
| 10 | Maximum recall, risk of long prompts for frequent athletes. | |

**User's choice:** 3 (Recommended)

---

### Format in Claude prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Date + card JSON summary | Compact, machine-readable. Matches placeholder format in service.ts line 178. | ✓ |
| Date + human-readable prose | More readable for Claude but verbose. | |
| Date + tags + context only | Minimal, saves tokens, loses trend data. | |

**User's choice:** Date + card JSON summary (Recommended)

---

## History View Layout

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Below the panel in same tab | Idle state: micro button top, history list below. Matches Phase 01 D-02 intent. | ✓ |
| Separate sub-tab or accordion | Separate Historique tab/section. Cleaner but more complex. | |

**User's choice:** Below the panel in same tab (Recommended)

---

### Detail expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand — full card in place | Click row → card expands inline with all 5 sections read-only. No modal. | ✓ |
| Slide-over / modal | SessionSlideOver pattern, overlay management needed. | |
| Read-only, no expand | Date + tags + first 80 chars only. No full-card detail for v1.9. | |

**User's choice:** Inline expand (Recommended)

---

## Claude's Discretion

- Exact heading style for "Feedbacks précédents" section
- Loading skeleton for history list
- Collapse animation for inline-expanded card rows

## Deferred Ideas

- Sharing vocal feedback with athlete (email / push) — post-v1.9 (already in REQUIREMENTS.md §Deferred)
- PDF export — post-v1.9
- Monthly synthesis per athlete — post-v1.9
- Editing a saved feedback — not in scope v1.9
- Pagination / infinite scroll — not needed at current scale
