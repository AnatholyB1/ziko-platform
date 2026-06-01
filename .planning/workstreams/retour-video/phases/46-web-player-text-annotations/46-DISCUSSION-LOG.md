# Phase 46: Web Player & Text Annotations — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 46 — Web Player & Text Annotations
**Areas discussed:** Player layout, Annotation creation UX, Push notification trigger, Athlete mobile review

---

## Player Layout

### Notes panel fate

| Option | Description | Selected |
|--------|-------------|----------|
| Hide notes panel (Recommended) | Video page hides notes panel; annotation panel takes right column | ✓ |
| Keep notes panel, stack inside flex-1 | Existing layout unchanged; player + annotation panel stacked vertically inside tab content | |
| Full-page takeover | Dedicated full-screen view, breaks out of client detail layout | |

**User's choice:** Hide notes panel (Recommended)

### Video navigation

| Option | Description | Selected |
|--------|-------------|----------|
| New sub-page /videos/[videoId] (Recommended) | Click video → navigate to player URL; tab strip stays visible | ✓ |
| Inline expand in same tab | Video expands inline, no URL change | |

**User's choice:** New sub-page /videos/[videoId] (Recommended)

### Column proportions

| Option | Description | Selected |
|--------|-------------|----------|
| 2/3 player + 1/3 annotation panel (Recommended) | Player takes ~2/3, panel ~1/3 | ✓ |
| 3/4 player + 1/4 annotation panel | Player gets more room, narrower panel | |
| You decide | Claude picks proportions | |

**User's choice:** 2/3 player + 1/3 annotation panel (Recommended)

---

## Annotation Creation UX

### How coach starts an annotation

| Option | Description | Selected |
|--------|-------------|----------|
| Pause → click 'Annoter' button (Recommended) | Coach pauses, clicks button below player; timestamp captured | ✓ |
| Click directly on timeline | Click on Vidstack scrub bar; player seeks and composer pops | |
| Persistent timestamp button (always visible) | Button always active during playback or pause | |

**User's choice:** Pause → click 'Annoter' button (Recommended)

### Where composer appears

| Option | Description | Selected |
|--------|-------------|----------|
| Top of annotation panel, replaces list temporarily (Recommended) | Panel switches to composer; list reappears after save | ✓ |
| Inline in panel below the list | Composer slides in below annotation list | |
| Modal overlay on the player | Centered modal over player | |

**User's choice:** Top of annotation panel, replaces list temporarily (Recommended)

### Marker design on timeline

| Option | Description | Selected |
|--------|-------------|----------|
| Small colored dots on progress bar (Recommended) | Orange dots at timestamp %; hover = tooltip with annotation text | ✓ |
| Vertical tick marks with numbers | Numbered ticks above progress bar | |
| You decide | Claude picks marker style | |

**User's choice:** Small colored dots on progress bar (Recommended)

---

## Push Notification Trigger

### When to notify athlete

| Option | Description | Selected |
|--------|-------------|----------|
| Batch: 'Envoyer le retour' button (Recommended) | Coach annotates freely, sends all at once; one notification | ✓ |
| Per save (each annotation) | Notification on every annotation save; simpler but noisy | |
| You decide | Claude picks (batch is almost always right) | |

**User's choice:** Batch: 'Envoyer le retour' (Recommended)

### What happens on send

| Option | Description | Selected |
|--------|-------------|----------|
| Status → annotated + one push (Recommended) | Hono endpoint: status update + push; button becomes 'Retour envoyé' | ✓ |
| Push only, status updated separately | Notification via Hono, status updated on first annotation save | |

**User's choice:** Status → annotated + one push (Recommended)

---

## Athlete Mobile Review

### How athlete views annotated video

| Option | Description | Selected |
|--------|-------------|----------|
| expo-video + custom annotation overlay (Recommended) | expo-video renders video; custom timeline strip with orange dots; tap dot → seek + comment card | ✓ |
| Full-screen WebView of web player | Open /videos/[videoId] in WebView; no native player | |
| Video list + annotation cards (no seek) | Thumbnail + cards with timecodes; basic video player on tap | |

**User's choice:** expo-video + custom annotation overlay (Recommended)

### Where athlete accesses annotated videos

| Option | Description | Selected |
|--------|-------------|----------|
| Same 'Vidéos' tab in Mon coach plugin (Recommended) | VideoListScreen extended; tapping annotated video opens VideoPlayerScreen | ✓ |
| New dedicated 'Retour vidéo' tab | Separate tab for annotated videos | |

**User's choice:** Same 'Vidéos' tab (Recommended)

---

## Claude's Discretion

- Slow-motion playback (0.5x / 0.25x): Vidstack supports natively — planner includes if trivial, defers if complex
- Hono endpoint structure: extend `coach-videos.ts` or create `coach-video-annotations.ts` — planner decides based on route count

## Deferred Ideas

- Resend retour / re-notify athlete — deferred post-v1.13
- Voice annotation review on mobile — Phase 47
