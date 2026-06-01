# Phase 3: AI Classification & Chat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 03-ai-classification-chat
**Areas discussed:** Classification logic, Summary message content, Ambiguity flow, Trigger timing

---

## Classification Logic

### Q1 — How to derive doc type from parsed_data

| Option | Description | Selected |
|--------|-------------|----------|
| Confidence threshold | overall_confidence ≥ 0.6 → template_programme, < 0.6 → da_coach | ✓ |
| Structural heuristic | Check if weeks array has ≥1 session with ≥1 exercise | |
| Both combined | Needs confidence ≥ 0.6 AND ≥1 exercise | |

**User's choice:** Confidence threshold  
**Notes:** Recommended option accepted.

### Q2 — Threshold value

| Option | Description | Selected |
|--------|-------------|----------|
| 0.6 | Reasonable middle ground | ✓ |
| 0.7 | Stricter — more clarification questions | |
| 0.5 | Lenient — fewer clarification questions | |

**User's choice:** 0.6  
**Notes:** Recommended option accepted.

### Q3 — données_client visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into da_coach | Only 2 types: da_coach and template_programme | ✓ |
| Show all 3 types | Display da_coach / template_programme / données_client labels | |

**User's choice:** Fold into da_coach  
**Notes:** Aligns with REQUIREMENTS.md deferred scope for client_data.

### Q4 — Where does docType live

| Option | Description | Selected |
|--------|-------------|----------|
| Local state only | Classification in FileState, no API call | ✓ |
| Persist to API | Would require new PATCH endpoint — out of scope | |

**User's choice:** Local state only  
**Notes:** Consistent with "no backend changes" constraint.

---

## Summary Message Content

### Q1 — How to generate summary

| Option | Description | Selected |
|--------|-------------|----------|
| Template string from parsed_data | Built from name, weeks, sessions — no API call | ✓ |
| Frontend API call to Claude | Natural language but 2–5s latency + cost per file | |
| Simple file-level label only | Would not satisfy PARSE-02 requirement | |

**User's choice:** Template string from parsed_data  
**Notes:** Deterministic, zero added latency.

### Q2 — What to include for template_programme

| Option | Description | Selected |
|--------|-------------|----------|
| Name + weeks + sessions/week | Core facts a coach cares about | ✓ |
| Name + weeks + sessions + exercise count | More detail but potentially overwhelming | |
| Name + type label only | Too minimal for PARSE-02 | |

**User's choice:** Name + weeks + sessions/week

### Q3 — da_coach summary content

| Option | Description | Selected |
|--------|-------------|----------|
| Generic coaching doc message | Honest about low-confidence parse | ✓ |
| Same template as template_programme | Would show confusing partial program data | |

**User's choice:** Generic coaching doc message  
**Notes:** E.g. "ce document ressemble à une DA coach ou un document méthodologique."

---

## Ambiguity Flow

### Q1 — What triggers clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Borderline confidence 0.4–0.6 | Middle band only; clear cases classified silently | ✓ |
| Always ask for da_coach | Any doc below 0.6 triggers question | |
| Never ask | Would leave PARSE-03 unmet | |

**User's choice:** Borderline confidence 0.4–0.6  
**Notes:** Three zones: confident da_coach (<0.4), ambiguous (0.4–0.6, ask), confident template (≥0.6).

### Q2 — Clarification UX form

| Option | Description | Selected |
|--------|-------------|----------|
| Choice buttons in the chat | Two clickable pills inline in the IA bubble | ✓ |
| Free-text input below chat | More flexible but adds friction | |
| Inline dropdown on file card | Breaks chat metaphor | |

**User's choice:** Choice buttons in the chat

### Q3 — After coach clicks a button

| Option | Description | Selected |
|--------|-------------|----------|
| Update local state + confirmation bubble | docType updated + IA confirms + coach reply shown right-aligned | ✓ |
| Update local state silently | No visible confirmation | |
| API call to persist | Out of scope | |

**User's choice:** Update local state + confirmation bubble

---

## Trigger Timing

### Q1 — When does Phase 3 activate

| Option | Description | Selected |
|--------|-------------|----------|
| Per-file, as each reaches `ready` | Progressive — immediately on ready status | ✓ |
| After all files are ready | Batch reveal, simpler state machine | |

**User's choice:** Per-file, immediately on `ready`

### Q2 — How coach advances to Phase 4

| Option | Description | Selected |
|--------|-------------|----------|
| 'Continue' button appears | Shows when all ready files classified; coach controls advance | ✓ |
| Auto-advance when all done | No coach control before Phase 4 | |

**User's choice:** 'Continue' button appears

### Q3 — Failed files and the Continue button

| Option | Description | Selected |
|--------|-------------|----------|
| Failed files don't block Continue | Coach can proceed with successfully parsed docs | ✓ |
| All files must be ready | Could leave coach stuck on persistent failures | |

**User's choice:** Failed files don't block Continue

---

## Claude's Discretion

- Exact French wording for all IA chat messages (summary, confirmation, clarification question)
- Visual styling of clarification choice pills within Tailwind v4 palette
- Right-aligned coach reply bubble CSS (mirror of left-aligned IA bubble)
- i18n key names for new chat messages under the Onboarding namespace
- Whether docType badge appears on file card, in chat bubble, or both

## Deferred Ideas

- données_client type visibility — deferred to future phase (no target table in v1.0)
- Retry button on failed files — noted in Phase 2, still deferred
- Re-uploading or replacing a failed file — out of scope v1.0
