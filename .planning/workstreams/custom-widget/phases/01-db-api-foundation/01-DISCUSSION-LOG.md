# Phase 01: DB + API Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 01-DB + API Foundation
**Areas discussed:** Zod schema completeness, Default config source, coach_memory structure

---

## Zod Schema Completeness

### Q1: How complete should the Zod widget schemas be in Phase 01?

| Option | Description | Selected |
|--------|-------------|----------|
| Full schemas now | Define all 7 variant shapes with specific fields; additionalProperties: false on all variants. Phase 02 imports types directly. | ✓ |
| Minimal stub (type only) | Discriminated union on type field only, payload open JSONB. Phase 02 fills in per-variant schemas. | |

**User's choice:** Full schemas now (Recommended)

---

### Q2: Should `period` be a free string or a closed enum?

| Option | Description | Selected |
|--------|-------------|----------|
| Closed enum | '7d' \| '30d' \| '90d' \| 'all' — Zod rejects unknown values at schema level. | ✓ |
| Free string | No validation on period value — simpler schema, more defensive error handling required. | |

**User's choice:** Closed enum (Recommended)

---

## Default Config Source

### Q3: Who generates the 3-4 default widgets for a new coach+client pair?

| Option | Description | Selected |
|--------|-------------|----------|
| Backend injects defaults | GET returns computed defaults server-side when no row exists. Single source of truth. | ✓ |
| Frontend holds defaults | Backend returns [] and frontend has a hardcoded DEFAULT_WIDGETS constant. | |

**User's choice:** Backend injects defaults (Recommended)

---

### Q4: Should the default config be persisted on first GET or lazily on first PUT?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy — only on PUT | GET computes defaults on the fly without writing. Row created only on explicit save. | ✓ |
| Eager — write on first GET | GET creates the row immediately with defaults. No phantom rows, but more complex. | |

**User's choice:** Lazy — only on PUT (Recommended)

---

## coach_memory Structure

### Q5: One row per coach (global) or one row per coach+client pair?

| Option | Description | Selected |
|--------|-------------|----------|
| One row per coach | Upsert on coach_id. Templates apply across all athletes. Matches MEM-01. | ✓ |
| Per coach+client pair | Separate prefs per athlete. More granular but not called for by requirements. | |

**User's choice:** One row per coach (Recommended)

---

### Q6: What should coach_memory JSONB contain at migration time?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal placeholder | { templates: [], preferences: {} } — Phase 04 defines the full shape. | ✓ |
| Full schema now | Define template shape and preference keys in Phase 01. | |

**User's choice:** Minimal placeholder (Recommended)

---

## Claude's Discretion

None — all areas had clear user decisions.

## Deferred Ideas

None — discussion stayed within Phase 01 scope.
