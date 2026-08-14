# Phase 1: Schema & Storage Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-14
**Phase:** 1-Schema & Storage Foundation
**Areas discussed:** Image column scope, Storage path convention, Import log schema, Migration naming convention

---

## Image column scope

| Option | Description | Selected |
|--------|-------------|----------|
| Add image + gif now (Recommended) | Migration adds both `image` and `gif` (nullable text) columns in Phase 1. Avoids a second schema migration mid-pipeline; Phase 3's merge script can populate both columns in one pass. | ✓ |
| Image only, gif column later | Strictly matches ROADMAP's literal Phase 1 criterion. A `gif` column gets added via its own migration whenever Phase 3 (merge) is planned and actually needs to write it. | |
| You decide | Let Claude pick during planning based on what's cleanest for the migration/merge script split. | |

**User's choice:** Add image + gif now (Recommended)
**Notes:** ROADMAP's Phase 1 criterion literally only lists an `image` column, but Phase 4 (MOBILE-01) requires rendering both a real GIF and a thumbnail — adding both columns now avoids retrofitting the schema later.

| Option | Description | Selected |
|--------|-------------|----------|
| Relative storage path (Recommended) | e.g. `barbell-squat/thumb.png`. The app builds the public URL client-side via the Supabase Storage client. Decouples the DB from the project's storage domain. | ✓ |
| Full public URL | e.g. full `https://<project>.supabase.co/storage/...` URL. Simpler to consume directly, but breaks if the bucket/project URL ever changes. | |
| You decide | Let Claude pick the storage format during planning. | |

**User's choice:** Relative storage path (Recommended)
**Notes:** None.

---

## Storage path convention

| Option | Description | Selected |
|--------|-------------|----------|
| Folder per exercise_id (Recommended) | e.g. `{exercise_id}/thumb.png` + `{exercise_id}/animation.gif`. Stable even if the exercise name changes later; matches the existing avatars/profile-photos bucket convention. | ✓ |
| Folder per dataset slug | e.g. `barbell-squat/thumb.png`. Human-readable, but breaks if a name/slug is ever renamed. | |
| You decide | Let Claude pick the convention during planning. | |

**User's choice:** Folder per exercise_id (Recommended)
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed names (Recommended) | Always `thumb.png` + `animation.gif` regardless of source. Simple, predictable, easy to overwrite on re-import. | ✓ |
| Preserve source filenames | Keep whatever filename the dataset ships (e.g. `0001.gif`). More traceable but messier in code. | |
| You decide | Let Claude pick during planning. | |

**User's choice:** Fixed names (Recommended)
**Notes:** None.

---

## Import log schema

| Option | Description | Selected |
|--------|-------------|----------|
| matched / inserted / skipped / needs_review (Recommended) | matched = existing exercise UPDATEd, inserted = new exercise created, skipped = already processed (idempotency), needs_review = legacy exercise with real history but no confident match (per IMPORT-05, never auto-merged). | ✓ |
| Simpler success/failure only | Just `success` / `failed` / `pending`. Less granular — merge script and human reviewer would need to infer why a row is in a given state from other columns. | |
| You decide | Let Claude design the status enum during planning, informed by IMPORT-02 through IMPORT-05's four report categories. | |

**User's choice:** matched / inserted / skipped / needs_review (Recommended)
**Notes:** None.

| Option | Description | Selected |
|--------|-------------|----------|
| Source id + matched exercise_id + error message + timestamp (Recommended) | Dataset source identifier (detect re-runs), nullable exercise_id, nullable error_message, processed_at. Enough for resumability and human-readable review. | ✓ |
| Minimal — just source id + status | Smallest possible table. Error detail and touched exercise would have to be reconstructed from logs/report files instead of the DB. | |
| You decide | Let Claude design the full column set during planning. | |

**User's choice:** Source id + matched exercise_id + error message + timestamp (Recommended)
**Notes:** None.

---

## Migration naming convention

| Option | Description | Selected |
|--------|-------------|----------|
| Dated (Recommended) | e.g. `20260814_exercise_media_schema.sql` — matches the project's most recent convention (last 5 migrations are all dated), avoids numbering collisions across parallel workstreams. | ✓ |
| Sequential | e.g. `065_exercise_media_schema.sql` — continues the older numeric sequence (last sequential file is 064). | |
| You decide | Let Claude pick during planning based on what's currently in the migrations folder at that time. | |

**User's choice:** Dated (Recommended)
**Notes:** None.

---

## Claude's Discretion

None — every discussed area reached an explicit user decision.

## Deferred Ideas

None — discussion stayed within Phase 1's scope (schema and storage infrastructure only).
