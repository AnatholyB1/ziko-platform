# Phase 4: Mobile Consumption & Attribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 4-Mobile Consumption & Attribution
**Areas discussed:** Chain order (workflow), Hero media treatment, Attribution badge design, Missing-media fallback, ExercisePicker thumbnail layout

---

## Chain order (workflow, not phase-content)

| Option | Description | Selected |
|--------|-------------|----------|
| Discuss → UI-phase → Plan → Execute | Insert /gsd:ui-phase before planning, per user's established UI-design-first rule and this phase's UI hint | ✓ |
| Discuss → Plan → Execute (as invoked) | Skip UI-phase, follow --chain literally | |

**User's choice:** Discuss → UI-phase → Plan → Execute
**Notes:** This phase is visual-heavy (attribution badge, hero redesign, thumbnails); ROADMAP.md flags `UI hint: yes`; user's memory-recorded rule requires UI-phase before planning for any visual-deliverable phase.

---

## Hero media treatment

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Aspect ratio | Square card, full width | Hero reshapes to 1:1, no distortion/letterboxing | ✓ |
| | Keep 16:9 frame, letterbox | Square GIF centered, blurred background fills sides | |
| | Keep 16:9 frame, crop to fill | Square GIF scaled/cropped to cover 16:9 | |
| Video chrome | Strip it all | No play icon, no HD badge, no duration text | ✓ |
| | Keep play icon only, drop text badges | Play icon stays, HD/duration removed | |
| | Keep everything as-is | Just swap background image | |
| Autoplay | Autoplay + loop always | GIF plays immediately and loops | ✓ |
| | Static thumb.png first, tap to animate | Adds play/pause state | |

**User's choice:** Square card, chrome stripped, autoplay always.
**Notes:** All three questions landed on the recommended option.

---

## Attribution badge design

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Prominence | Small persistent overlay, corner-anchored | Semi-transparent tag, similar spot to old HD badge | ✓ |
| | Caption below the media | Text line under hero, outside image | |
| | Prominent banner | Full-width bar, high contrast | |
| Badge scope | Once per screen, on primary/largest media | Hero carries it; nothing else repeats it | ✓ |
| | Every single media instance, everywhere | Including ExercisePicker thumbnails | |
| List thumbs | No badge on list thumbnails | Detail screen (larger display) carries attribution | ✓ |
| | Tiny badge/dot indicator even on list thumbnails | More conservative, adds clutter | |
| MOBILE-03 scope (follow-up) | "Once per screen" satisfies it — keep my answer | Requirement's intent read as "no screen unattributed," not "every instance" | ✓ |
| | Every media instance needs it, including list thumbnails | Literal requirement-text reading | |

**User's choice:** Small corner-anchored overlay, once per screen (hero only), no badge on list thumbnails — explicitly confirmed against MOBILE-03's literal wording.
**Notes:** Claude flagged a tension between the user's answer and MOBILE-03's literal text ("chaque surface d'affichage de média... structurellement"). User explicitly confirmed the narrower "once per screen" interpretation after the tension was raised. Recorded as D-06 in CONTEXT.md — a deliberate interpretation, not an oversight, to prevent a future audit from mistakenly flagging it as a requirement violation.

---

## Missing-media fallback

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Hero fallback | Icon placeholder, no attribution badge | Neutral icon in same square slot, no badge | ✓ |
| | Hide the hero entirely | Skip rendering when no media | |
| List fallback | Small icon placeholder in thumbnail slot | Same neutral icon at thumbnail size | ✓ |
| | No thumbnail slot at all for that row | Falls back to text-only layout | |

**User's choice:** Icon placeholder in both hero and list, uniform layout regardless of media presence.
**Notes:** Applies to the 6 currently-unmatched-new exercises and any future needs_review legacy rows.

---

## ExercisePicker thumbnail layout

| Option | Description | Selected |
|--------|-------------|----------|
| Small rounded-square, left of checkbox | ~40×40px, matches app's card corner-radius convention | ✓ |
| Circular avatar-style, left of checkbox | More "profile-picture" feeling | |
| Larger thumbnail, replaces checkbox position | 56×56, checkbox overlays image corner | |

**User's choice:** Small rounded-square, left of checkbox.
**Notes:** None.

---

## Claude's Discretion

- Exact corner placement/opacity/typography of the attribution overlay
- Exact icon choice for missing-media placeholder
- Instructions fallback behavior when `instruction_steps` is null (6 unmatched-new rows)
- Exact scope of TanStack Query keys to version-bump (whether `workoutStore.ts`'s non-cached inline queries count)

## Deferred Ideas

None — discussion stayed within phase scope.
