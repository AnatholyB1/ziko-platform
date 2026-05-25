# Phase 31: AI Tools — coach_get_link + coach_revoke_link — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 31-ai-tools-coach
**Areas discussed:** Revoke safety gate, coach_get_link data scope, System prompt hint

---

## Revoke Safety Gate

### Q1: How should coach_revoke_link guard against accidental calls?

| Option | Description | Selected |
|--------|-------------|----------|
| confirmed: true param | Requires { confirmed: true } before executing DELETE. Returns error+instruction if missing/false. | ✓ |
| Orchestrator-trust only | Executes directly; description says "Ask for confirmation first." Same as nutrition_delete_entry. | |
| Two-step dry-run flag | { dry_run?: boolean } — returns preview when true, executes when false. | |

**User's choice:** confirmed: true param
**Notes:** Revoking a coach link is more consequential than deleting a nutrition log — a hard schema gate is warranted.

---

### Q2: What should coach_revoke_link return when confirmed is missing or false?

| Option | Description | Selected |
|--------|-------------|----------|
| Error + instruction | { ok: false, error: 'confirmation_required', message: 'Call again with confirmed: true...' } | ✓ |
| Silent no-op | { ok: false, error: 'confirmation_required' } with no message | |
| Throw 400 | Throws HTTP error — may disrupt orchestrator loop | |

**User's choice:** Error + instruction

---

### Q3: Does coach_revoke_link need a link_id parameter?

| Option | Description | Selected |
|--------|-------------|----------|
| Self-contained — zero params | Fetches active link ID from GET /links/me internally. Caller only passes { confirmed: true }. | ✓ |
| Require link_id | Takes { link_id, confirmed: true }. Caller must call coach_get_link first. | |

**User's choice:** Self-contained — zero params
**Notes:** Only one active link can exist per athlete at a time.

---

## coach_get_link Data Scope

### Q1: What should coach_get_link return when linked?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured | { linked, link_id, coach_name, linked_at, kyc_verified, bio, specialties[] } | ✓ |
| Minimal | { linked, coach_name, linked_at } only — per ROADMAP SC2 | |
| Full preview | All CoachPreviewPayload fields including signed photo_url | |

**User's choice:** Structured
**Notes:** All fields are fetched by getActiveLink at no extra cost. Enables richer AI responses without additional tool calls. photo_url excluded — signed URLs expire and aren't useful in text responses.

---

### Q2: What should coach_get_link return when not linked?

| Option | Description | Selected |
|--------|-------------|----------|
| { linked: false } + helpful message | Includes instructions for how to link | ✓ |
| { linked: false } only | Minimal — orchestrator composes its own reply | |

**User's choice:** { linked: false } + helpful message

---

## System Prompt Hint

### Q1: Should coach manifest declare aiSystemPromptAddition?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add a brief hint | Static string injected when plugin installed. Follows habits/journal pattern. | ✓ |
| No — tools-only | Tools discovered via tool list; no prompt injection. | |

**User's choice:** Yes — add a brief hint

---

### Q2: Should aiSystemPromptAddition be conditional or static?

| Option | Description | Selected |
|--------|-------------|----------|
| Single static string | Always injected when plugin installed; AI calls coach_get_link for dynamic state. | ✓ |
| Dynamic via user context | fetchUserContext() injects different hints based on link state. | |

**User's choice:** Single static string

---

## Claude's Discretion

- Tool file location: `backend/api/src/tools/coach.ts` (new file, consistent with other plugin tool files)
- `aiTools` manifest shape: full `AITool` objects (matching backend schema)
- `aiSkills` remains `[]` — system prompt addition is sufficient for orchestrator discovery

## Deferred Ideas

- `aiSkills` with trigger keywords (coach_info, coach_revoke) — not required by COACH-15
- Real-time link state push for AI tool staleness — acceptable for Phase 31
- Coach-initiated messaging tools — future milestone
