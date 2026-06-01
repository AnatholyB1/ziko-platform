# Phase 04: Athlete Blocking Overlay (Mobile) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 04 — Athlete Blocking Overlay (Mobile)
**Areas discussed:** Fetch gate & app launch, Scale (1–10) input, Answer validation, Between-form transition

---

## Fetch Gate & App Launch

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic — show app | Render app immediately; overlay snaps on top when query resolves | ✓ |
| Pessimistic — block until resolved | Show loading screen until query returns, then route to overlay or app | |
| MMKV cache — restore instantly | Persist `hasPendingForms` flag in MMKV; restore on launch, revalidate in background | |

**User's choice:** Optimistic — show app
**Notes:** Brief flash of home screen (200–400ms) is acceptable. No MMKV overhead needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — refetch on foreground | Invalidate `['pending-forms']` on AppState `active` | ✓ |
| No — once per session only | Query runs on mount only; no re-check on resume | |

**User's choice:** Yes — refetch on foreground
**Notes:** Mirrors existing AppState listener already in `_layout.tsx`.

---

## Scale (1–10) Input

| Option | Description | Selected |
|--------|-------------|----------|
| 10 tap buttons (single row) | 10 numbered buttons, flexGrow: 1; selected highlights in primary color | ✓ |
| Horizontal slider | Draggable slider; needs @react-native-community/slider | |
| 2 rows of 5 buttons | [1-5] and [6-10] split — avoids cramped single row | |

**User's choice:** 10 tap buttons
**Notes:** Zero new dependencies; accessible.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show endpoint labels | Static "Pas du tout" (1) and "Totalement" (10) below the row | ✓ |
| Numbers only | No additional text labels | |

**User's choice:** Yes — show labels
**Notes:** Standard survey UX; accepted the static label trade-off.

---

## Answer Validation

| Option | Description | Selected |
|--------|-------------|----------|
| All required — block submit | CTA disabled (opacity 0.4) until all questions answered | ✓ |
| Optional — allow empty submit | CTA always active; empty answers stored as null | |

**User's choice:** All required — block submit
**Notes:** Ensures coach always gets complete data.

---

| Option | Description | Selected |
|--------|-------------|----------|
| showAlert + retry CTA | `showAlert('Erreur', ..., [Réessayer, Annuler])` on API failure | ✓ |
| Inline error banner | Red error text below submit button | |

**User's choice:** showAlert + retry CTA
**Notes:** Consistent with project-wide alert convention.

---

## Between-Form Transition

| Option | Description | Selected |
|--------|-------------|----------|
| Instant replace | `setCurrentIndex(i + 1)` immediately after submit success | ✓ |
| Brief success flash then replace | Checkmark shown ~800ms before advancing | |
| Slide (next form slides in) | Animated.timing slide-in from right | |

**User's choice:** Instant replace
**Notes:** No animation cost; acceptable to not have a between-form acknowledgment.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fade out (300ms) | Animated.timing opacity 1→0 on final dismiss | ✓ |
| Instant dismiss | Unmount immediately | |

**User's choice:** Fade out (300ms)
**Notes:** Clear "block lifted" signal for the athlete.

---

## Claude's Discretion

- Yes/No toggle button visual design (two full-width buttons vs. toggle switch)
- Single-choice radio button visual (circular indicator vs. highlighted option card)
- ScrollView vs. paginated question display
- Loading indicator style during submit API call

## Deferred Ideas

- **Save-and-resume draft answers** — if app is force-quit mid-form; not required for v1.14
- **Offline submit queue** — submit when back online; out of scope
- **Per-question progress bar** — showing "Question 2 / 5"; UX improvement for follow-on
- **Paginated question display** — one question per screen; scroll covers v1.14
