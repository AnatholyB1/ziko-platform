# Phase 4: Review & Commit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 4-Review & Commit
**Areas discussed:** Review transition, Type correction UX, Commit flow & failures, da_coach doc treatment

---

## Review transition

| Option | Description | Selected |
|--------|-------------|----------|
| Swap to review screen | Chat, drop zone, file list fully replaced by a dedicated review screen | ✓ |
| Append below | Chat/drop zone/file list stay visible, review section appears underneath | |
| Replace file list only | Chat bubbles stay, drop zone + file list replaced by review list | |

**User's choice:** Swap to review screen
**Notes:** Cleaner, avoids a very long card, matches a typical wizard final-step pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| One-way, no back button | Only Confirmer et importer / Ignorer pour l'instant on review | ✓ |
| Back button to file list | Retour link returns to file list, preserving state | |

**User's choice:** One-way, no back button

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, still available | Skip still redirects to dashboard from review screen | ✓ |
| No, commit is the only exit | Skip removed once on review | |

**User's choice:** Yes, still available
**Notes:** Consistent with Step 4 being optional throughout (PROJECT.md: not a blocker).

---

## Type correction UX

| Option | Description | Selected |
|--------|-------------|----------|
| Pill toggle per row | Reuses Phase 3's pill-button pattern inline in each doc row | ✓ |
| Dropdown per row | Compact select next to each doc | |
| Tap badge to cycle | Existing docType badge becomes clickable | |

**User's choice:** Pill toggle per row

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, live-updates commit set | "N docs will be imported" count updates live as types change | ✓ |
| Only applies on confirm | Commit batch computed once at confirm-click | |

**User's choice:** Yes, live-updates commit set

---

## Commit flow & failures

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel, all at once | Promise.all across all coach_template docs | ✓ |
| Sequential, one by one | Docs commit one at a time with progress indicator | |

**User's choice:** Parallel, all at once
**Notes:** Matches Phase 2's parallel-upload precedent.

| Option | Description | Selected |
|--------|-------------|----------|
| Partial success + retry failed | Successful docs stay committed; failed doc gets a scoped Retry button | ✓ |
| Partial success, redirect anyway | Failed doc simply isn't imported, no blocking | |
| All-or-nothing block | Any failure blocks the whole confirm action | |

**User's choice:** Partial success + retry failed
**Notes:** Deliberate exception to Phase 2's "retry deferred" decision — losing an already-uploaded, already-classified doc at the final commit step is worse UX than the upload-stage failures Phase 2 deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-redirect after brief success state | Short confirmation message, then automatic navigation | ✓ |
| Manual Continuer button | Coach clicks a final button to proceed | |

**User's choice:** Auto-redirect after brief success state

---

## da_coach doc treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Same list, "no action" badge | All docs in one list; da_coach rows get a distinct badge | ✓ |
| Separate section | Two groups: "Programmes à importer" / "Documents de contexte" | |
| Omit from review entirely | Only coach_template docs shown | |

**User's choice:** Same list, "no action" badge
**Notes:** Satisfies REVIEW-01 (consolidated summary of ALL analyzed docs) without hiding da_coach docs.

---

## Claude's Discretion

- Exact French wording for review screen heading, per-doc summary lines, success message, retry error text
- Visual treatment of the running commit count and the "no action" badge (text vs styled counter)
- Internal view-state variable naming
- i18n key names for all new Phase 4 strings

## Deferred Ideas

None — discussion stayed within phase scope.
