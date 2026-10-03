# Phase 5: Storage Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-02
**Phase:** 5-Storage Migration
**Areas discussed:** Bucket config & policy fidelity, Bucket-name rename in code & stored URLs, Copy mechanism & delta sync, Verification & authenticated flow tests

---

## Bucket config

| Option | Selected |
|---|---|
| Exact copy, read live | ✓ |
| Exact copy + fix profile-photos | |
| You decide | |

## Storage policies

| Option | Selected |
|---|---|
| Generated from live, ziko_-prefixed | ✓ |
| Hand-written migration | |
| You decide | |

## Codemod ownership

| Option | Selected |
|---|---|
| Phase 5 builds, Phase 6 merges | ✓ |
| Phase 6 owns everything | |
| Env-driven bucket names | |

## Stored URLs

| Option | Selected |
|---|---|
| In-flight in Phase 4 loader | ✓ |
| One-off UPDATE script | |
| Normalize to relative paths | |

## Copy method

| Option | Selected |
|---|---|
| Node script, Storage API | ✓ |
| S3-compatible endpoint | |
| You decide | |

## Delta sync

| Option | Selected |
|---|---|
| Re-run add-only + report | ✓ |
| Mirror: delete extras | |

## Checksum

| Option | Selected |
|---|---|
| Per-object SHA-256 + count/size, full | ✓ |
| Count + size + ETag only | |

## Authenticated tests

| Option | Selected |
|---|---|
| Scratch full rehearsal, portfolio smoke | ✓ |
| Portfolio only | |
| Scratch only | |

**Notes:** All recommended options chosen.

## Claude's Discretion

Script layout, concurrency/retry, constant naming, throwaway-user handling, empty-bucket hashing, storage.objects owner metadata.

## Deferred Ideas

profile-photos public-URL fix; mirror sync; env-driven prefix.
