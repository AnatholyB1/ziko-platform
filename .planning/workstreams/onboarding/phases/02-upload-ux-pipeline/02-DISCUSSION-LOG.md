# Phase 2: Upload UX & Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 02-Upload UX & Pipeline
**Areas discussed:** File picker UI, Progress indicator, Pipeline concurrency, IA opening message

---

## File Picker UI

| Option | Description | Selected |
|--------|-------------|----------|
| Dropzone + button | Styled drop area with drag-over state + Browse button inside. Custom code, no library. | ✓ |
| Button-only picker | Simple button opens native file picker, no drag state. | |

**Follow-up — zone behavior after selection:**

| Option | Description | Selected |
|--------|-------------|----------|
| Stays visible | Zone remains, files appear below. Coach adds files incrementally up to cap. | ✓ |
| Collapses after first pick | Zone disappears once files selected. | |

**Follow-up — 4-file cap behavior:**

| Option | Description | Selected |
|--------|-------------|----------|
| Block with visual feedback | Zone dims, shows "Maximum de 4 fichiers atteint". | ✓ |
| Auto-replace oldest | 5th file replaces the first. | |

**Notes:** No dropzone library — native drag events only. Drop zone stays visible throughout.

---

## Progress Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| File card with status pill | Row: filename + size left, animated status pill right. | ✓ |
| Inline spinner + label | No card border, just filename + spinner + state label. | |
| Progress bar per file | Thin bar below filename. Indeterminate for parse phase. | |

**Follow-up — cancel during pipeline:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with cancel | × button always visible. Best-effort cancel, stop polling. | ✓ |
| No removal after start | × disappears once pipeline fires. | |

**Follow-up — failure UX:**

| Option | Description | Selected |
|--------|-------------|----------|
| Error pill + inline message | Red pill + short error string below filename. | ✓ |
| Error pill only | Red pill, no detail text. | |
| Toast notification | Error pill + toast popup. No toast component exists yet. | |

**Notes:** Error message sourced from `import.error_message` field in GET response, truncated at 80 chars.

---

## Pipeline Concurrency

| Option | Description | Selected |
|--------|-------------|----------|
| All in parallel | All pipelines start simultaneously. Fastest UX. | ✓ |
| Sequential | File 2 starts only after file 1 completes. Slower. | |

**Follow-up — polling interval:**

| Option | Description | Selected |
|--------|-------------|----------|
| Every 3 seconds | Responsive without hammering serverless API. | ✓ |
| Every 5 seconds | Less responsive. | |
| Every 1 second | Very responsive but aggressive for 4 concurrent files. | |

**Notes:** `setInterval` cleaned up on `ready`, `failed`, file removal, or unmount.

---

## IA Opening Message

| Option | Description | Selected |
|--------|-------------|----------|
| Chat bubble — early | Avatar + bubble. Foundation for Phase 3 chat layer. Phase 3 appends to it. | ✓ |
| Static info banner | Border-left info box. Phase 3 would need to replace it entirely. | |

**Follow-up — avatar style:**

| Option | Description | Selected |
|--------|-------------|----------|
| Small rounded square "IA" | `bg-primary text-white w-8 h-8 rounded-lg` with "IA" text. | ✓ |
| You decide | Claude picks style matching design tokens. | |

**Follow-up — message text:**

| Option | Description | Selected |
|--------|-------------|----------|
| "Envoie-moi tes docs et je m'occupe du reste." | Short, direct, action-oriented. | ✓ |
| More descriptive | Adds file type context. | |

**Notes:** The chat bubble created in Phase 2 is intentionally the Phase 3 container foundation — Phase 3 MUST NOT replace it, only extend it.

---

## Claude's Discretion

- File type icon mapping (PDF / Excel / Word) — emoji or react-icons choice
- Exact Tailwind classes for drop zone container height/padding within the card
- i18n key name for "Maximum de 4 fichiers atteint" message

## Deferred Ideas

- **Retry button on failed files** — re-trigger pipeline on error. Future improvement phase.
- **Upload progress bar** — XHR progress events for byte-level upload feedback. Deferred.
- **`onSuccess` trigger** — Phase 2 does not call `onSuccess`. Phase 3 decides when to advance.
