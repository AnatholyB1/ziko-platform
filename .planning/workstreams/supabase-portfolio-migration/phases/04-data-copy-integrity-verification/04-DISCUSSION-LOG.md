# Phase 4: Data Copy & Integrity Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-02
**Phase:** 4-Data Copy & Integrity Verification
**Areas discussed:** Load mechanism & trigger suppression, Re-run strategy for the final delta, Rehearsal & rollback path, Remap depth & verification strictness

---

## Load mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Node script COPY TO/FROM streams | Two pg connections, in-flight rename + remap | ✓ |
| pg_dump --data-only \| sed \| psql | Fragile for JSONB remap | |
| Supabase MCP execute_sql batches | Slow, size-limited | |

**User's choice:** Node script COPY streams (Recommended)

## Trigger suppression

| Option | Description | Selected |
|--------|-------------|----------|
| session_replication_role = replica | Silences triggers + FK checks, order-independent | ✓ |
| DISABLE TRIGGER USER per table | Explicit but needs FK ordering | |

**User's choice:** session_replication_role = replica (Recommended)

## Final delta strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full truncate-and-reload of ziko_* | Same code path, ~42 MB | ✓ |
| Incremental upsert by PK | Misses deletes, more failure modes | |

**User's choice:** Full truncate-and-reload (Recommended)

## Rehearsal

| Option | Description | Selected |
|--------|-------------|----------|
| Scratch rehearsal then portfolio, typed-phrase gate | Same cadence as Phases 2-3 | ✓ |
| Straight to portfolio | | |

**User's choice:** Scratch rehearsal (Recommended)

## Rollback model

| Option | Description | Selected |
|--------|-------------|----------|
| Transaction per table + guarded TRUNCATE and retry | | ✓ |
| One transaction for entire load | | |

**User's choice:** Per-table transactions (Recommended)

## Remap depth

| Option | Description | Selected |
|--------|-------------|----------|
| FK columns + known non-FK + text/JSONB scan | Zero-occurrence verification | ✓ |
| FK columns only | | |

**User's choice:** Full depth (Recommended)

## Row-count parity

| Option | Description | Selected |
|--------|-------------|----------|
| Exact parity, no exclusions | | ✓ |
| Named exclusion list | | |

**User's choice:** Exact parity (Recommended)

## Verification suite

| Option | Description | Selected |
|--------|-------------|----------|
| scripts/portfolio-migration/ .mjs + node:test, PII-safe | Mirrors auth-merge 06-verify | ✓ |
| SQL files only | | |

**User's choice:** .mjs + node:test (Recommended)

## Claude's Discretion

Script layout/numbering, batching, in-flight replacement implementation, load ordering, connection/secret handling.

## Deferred Ideas

- Real final delta / write-freeze execution — Phase 6
- Collision-user storage re-keying — Phase 5
