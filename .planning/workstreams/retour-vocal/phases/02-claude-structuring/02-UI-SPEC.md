---
phase: 02
slug: claude-structuring
workstream: retour-vocal
status: approved
shadcn_initialized: true
preset: none
figma_file_url: pending-figma
moodboard_path: .planning/MOODBOARD.md
created: 2026-05-27
---

# Phase 02 — UI Design Contract: Claude Structuring

> Visual and interaction contract for the "Claude Structuring" states of the VocalRetourPanel state machine.
> This is a direct continuation of Phase 01. All design tokens are inherited unchanged.
> The 5-section structured card is the hero UI of this phase.
> **This document is the written contract. Figma is the visual source of truth. Both are required.**

---

## Figma Designs

> **Status:** Figma MCP requires the Figma desktop app to be open with an active plugin connection.
> The `whoami` endpoint did not return a valid planKey during spec creation.
> **The executor must create the Figma file using the steps below, then update `figma_file_url` in this frontmatter.**

### How to Create the Figma File (Executor Instructions)

1. Open Figma desktop app with the Claude MCP plugin connected
2. Run: `mcp__claude_ai_Figma__create_new_file` with:
   - `fileName`: "Ziko Coach CRM — Retour Vocal v1.9" (reuse the Phase 01 file if it exists, or create new)
   - `planKey`: (from `whoami` tool — use the `key` field of your plan)
   - `editorType`: "design"
3. Add a page named "Phase 02 — Claude Structuring" to the file
4. Use the design spec below to build all 6 frames at 1440×900px (web)
5. Update `figma_file_url` in this frontmatter with the file URL

### Expected Screen Frames

| Screen | State | Dimensions | Frame Name |
|--------|-------|------------|------------|
| Retour Vocal | structuring | 1440×900 | `vocal/structuring` |
| Retour Vocal | card-ready | 1440×900 | `vocal/card-ready` |
| Retour Vocal | card-editing | 1440×900 | `vocal/card-editing` |
| Retour Vocal | card-saving | 1440×900 | `vocal/card-saving` |
| Retour Vocal | card-saved | 1440×900 | `vocal/card-saved` |
| Retour Vocal | structuring-error | 1440×900 | `vocal/structuring-error` |

> **Executors:** Once Figma file is created, use frames as pixel-perfect reference. Deviations require explicit justification.

---

## Design System

> **Inherited from Phase 01 without changes.** Only delta from Phase 01 is listed here.

| Property | Value |
|----------|-------|
| Tool | shadcn (components.json present) + Tailwind CSS |
| Figma Library | pending-figma (same file as Phase 01) |
| Preset | not applicable |
| Component library | Radix UI (via shadcn) |
| Icon library | Lucide React (standard shadcn default) |
| Font | Inter — from MOODBOARD.md |
| Mood board | `.planning/MOODBOARD.md` |

**Phase 02 additions to the design system:**
- `section-card` component — white surface card with labeled section header and editable body
- `tag-chip` component — selectable pill chip for the 5 auto-tags
- `card-section-label` — 12px/400/`#6B6963` label above each section
- Editing state: inline `<textarea>` replaces read-only `<p>` with animated border transition
- Save action row: bottom of card, flex row justify-end

---

## Spacing Scale

Inherited from Phase 01. No changes.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gap, chip padding, section label-to-content gap |
| sm | 8px | Button internal vertical padding, tight element gaps |
| md | 16px | Card inner padding, section body padding |
| lg | 24px | Gap between card sections, card outer padding |
| xl | 32px | Gap between card and action row |
| 2xl | 48px | Top margin of panel in content area |
| 3xl | 64px | Page-level vertical padding |

---

## Typography

Inherited from Phase 01. No changes to scale or weights.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Heading | 18px | 600 | 1.35 | Panel heading during loading states |
| Body | 14px | 400 or 600 | 1.5 | Button labels (600), body copy (400), section body content (400) |
| Section content | 16px | 400 | 1.6 | Content inside each feedback card section — slightly generous LH for readability |
| Caption | 12px | 400 | 1.4 | Section labels, metadata, tag chips, helper text |

**Phase 02 note:** The section body uses `16px/400` (same as transcript text in Phase 01) for visual consistency. The section label above each block uses `12px/400/muted`. This creates a clear hierarchy: label → content.

---

## Color

Inherited from Phase 01. No changes to palette.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#F7F6F3` | Page background |
| Secondary (30%) | `#FFFFFF` | Section cards, panel container |
| Accent (10%) | `#FF5C1A` | [Sauvegarder] primary button, [Réessayer] primary button in structuring-error state, structuring spinner border-top |
| Destructive | `#EF4444` | Error heading text, error icon |
| Muted surface | `#F0EFE9` | Read-only section body background (card-ready state), inline textarea hover |
| Edit active | `#FFFFFF` | Textarea background when section is in edit mode |
| Border default | `#E2E0DA` | Card border, section dividers, read-only section border |
| Border focus | `#1C1A17` | Textarea border when focused (edit mode) |
| Text Primary | `#1C1A17` | All headings, section content, tags selected label |
| Text Muted | `#6B6963` | Section labels, helper text, tag deselected label |
| Tag selected bg | `#1C1A17` | Active tag chip background |
| Tag selected text | `#FFFFFF` | Active tag chip text |
| Tag deselected bg | `#F0EFE9` | Inactive tag chip background |
| Tag deselected border | `#E2E0DA` | Inactive tag chip border |

**Accent reserved for:** [Sauvegarder] primary button, [Réessayer] primary button in structuring-error state, and structuring spinner border-top. No other element in Phase 02 uses `#FF5C1A`.

---

## Screen-by-Screen Design Specification

### Layout Context

All Phase 02 states live inside the same `VocalRetourPanel` container as Phase 01:
- Max-width: 640px, mx-auto
- Content area: full width below ClientTabStrip, `#F7F6F3` background
- Phase 02 states are triggered by the [Valider] action from the Phase 01 review state
- The panel does NOT scroll the page — the card itself may scroll internally if the section content is long

---

### State 1: structuring

**Purpose:** Loading state while Claude processes transcript + athlete context. Triggered immediately after [Valider] is pressed in the Phase 01 review state.

**Trigger:** `status: 'review'` → `status: 'structuring'`

**Layout:**
```
[Content area — full width, #F7F6F3 background]

        ┌─────────────────────────────────┐  max-w: 640px, mx-auto
        │                                 │
        │                                 │
        │   [Spinner — 32×32px]           │  CSS border-spinner
        │                                 │  border-4px solid #E2E0DA
        │   "Structuration en cours…"     │  border-top: #FF5C1A
        │   14px / 600 / #1C1A17          │  spin 0.8s linear infinite
        │   mt-16px, text-center          │
        │                                 │
        │   "Claude analyse le retour     │
        │    vocal et le contexte de      │
        │    l'athlète. Cela prend        │
        │    généralement 5 à 10 s."      │
        │   12px / 400 / #6B6963          │
        │   text-center, max-w: 300px     │
        │   mt-8px                        │
        │                                 │
        │                                 │
        └─────────────────────────────────┘
```

**Exact pixel spec:**
- Container: max-width 640px, mx-auto, px-24px, mt-48px, flex-col items-center gap-0
- Spinner: 32×32px, `border-4px solid #E2E0DA`, `border-top: 4px solid #FF5C1A`, radius 9999px, animation: `spin 0.8s linear infinite`
- Heading: "Structuration en cours…", 14px/600/`#1C1A17`, text-center, mt-16px
- Body: 12px/400/`#6B6963`, text-center, max-width 300px, line-height 1.5, mt-8px
- No interactive elements — user cannot cancel in-flight Claude call

---

### State 2: card-ready

**Purpose:** The 5-section structured card is displayed. All sections are read-only (bg `#F0EFE9`). Coach can click any section to edit it, or click [Sauvegarder] directly.

**Trigger:** `status: 'structuring'` → `status: 'card-ready'`

**Layout:**
```
[Content area — #F7F6F3]

        ┌─────────────────────────────────┐  max-w: 640px, mx-auto
        │                                 │  px-0 (card is the container)
        │  ┌─────────────────────────────┐│  WHITE card
        │  │  [sparkles icon] Retour     ││  bg: #FFFFFF
        │  │  structuré                  ││  border: 1px solid #E2E0DA
        │  │  12px/600/#6B6963 + icon    ││  radius: 8px
        │  │─────────────────────────────││  shadow: md
        │  │                             ││  p: 24px
        │  │  Contexte séance            ││  ← section label: 12px/400/#6B6963
        │  │  ┌────────────────────────┐ ││
        │  │  │ Joaquim a travaillé   │ ││  bg: #F0EFE9
        │  │  │ sur le squat. RPE 8   │ ││  border: 1px solid #E2E0DA
        │  │  │ sur les 3 derniers    │ ││  radius: 6px
        │  │  │ sets. Bonne séance.   │ ││  p: 12px
        │  │  └────────────────────────┘ ││  16px/400/#1C1A17
        │  │                             ││  cursor: pointer (edit hint)
        │  │  Points forts               ││
        │  │  ┌────────────────────────┐ ││  ← same section block
        │  │  │ …                      │ ││
        │  │  └────────────────────────┘ ││
        │  │                             ││  [sections repeat × 3 more]
        │  │  Corrections                ││
        │  │  ┌────────────────────────┐ ││
        │  │  │ …                      │ ││
        │  │  └────────────────────────┘ ││
        │  │                             ││
        │  │  Prochaines étapes          ││
        │  │  ┌────────────────────────┐ ││
        │  │  │ …                      │ ││
        │  │  └────────────────────────┘ ││
        │  │                             ││
        │  │  Tags                       ││  ← tag section
        │  │  [force] [technique]        ││  chip row, flex-wrap, gap-8px
        │  │  [mental] [cardio]          ││
        │  │  [récupération]             ││
        │  │                             ││
        │  │─────────────────────────────││
        │  │           [Sauvegarder]     ││  primary orange button, right-aligned
        │  └─────────────────────────────┘│
        └─────────────────────────────────┘
```

**Exact pixel spec:**

**Card container:**
- Background: `#FFFFFF`
- Border: `1px solid #E2E0DA`
- Border-radius: 8px
- Box-shadow: `0 4px 8px rgba(28,26,23,0.08)` (md shadow from MOODBOARD)
- Padding: 24px (all sides)
- Display: flex-col, gap: 16px (between sections)

**Card header row (inside card, before sections):**
- Flex row, items-center, gap-8px
- Lucide `sparkles` icon: 14px, color `#6B6963`
- Label: "Retour structuré", 12px/600/`#6B6963`, uppercase tracking: 0.05em
- Border-bottom: `1px solid #E2E0DA`, pb-16px, mb-4px

**Section block (Contexte séance, Points forts, Corrections, Prochaines étapes):**
- Section label: 12px/400/`#6B6963`, mb-8px (above the block)
- Content block:
  - Background: `#F0EFE9`
  - Border: `1px solid #E2E0DA`
  - Border-radius: 6px
  - Padding: 12px
  - Font: 16px/400/`#1C1A17`, line-height 1.6
  - Min-height: 60px (prevents tiny blocks for short content)
  - Cursor: pointer (click to enter edit mode)
  - Hover: border-color `#1C1A17` (subtle signal it is editable), transition 150ms
  - No explicit "Edit" button — the whole block is the click target

**Tags section:**
- Section label: "Tags", 12px/400/`#6B6963`, mb-8px
- Chip row: flex, flex-wrap, gap-8px
- Each chip (5 total: force / technique / mental / cardio / récupération):
  - Height: 28px, px: 12px, radius: 9999px (pill shape — exception per MOODBOARD: tags/chips only)
  - Font: 12px/400
  - **Selected state:** bg `#1C1A17`, text `#FFFFFF`, border: none
  - **Deselected state:** bg `#F0EFE9`, text `#6B6963`, border `1px solid #E2E0DA`
  - Toggle on click — no other affordance needed
  - Transition: bg + color 150ms ease

**Card footer (action row):**
- Border-top: `1px solid #E2E0DA`, pt-16px, mt-4px
- Flex row, justify-end
- [Sauvegarder] button: bg `#FF5C1A`, text white, h 40px, px 24px, radius 8px, 14px/600
  - Hover: bg `#E5521A` (darken 8%)
  - Disabled (during saving): opacity 0.5, cursor not-allowed

---

### State 3: card-editing

**Purpose:** One section is in active edit mode. Its content block becomes an editable textarea. The other 3 text sections remain visible in read-only mode. Tags remain toggleable.

**Trigger:** Coach clicks on any section content block in card-ready state

**Layout:**
```
[Content area — #F7F6F3]

        ┌─────────────────────────────────┐
        │  ┌─────────────────────────────┐│
        │  │  [sparkles] Retour structuré││
        │  │─────────────────────────────││
        │  │                             ││
        │  │  Contexte séance            ││
        │  │  ┌────────────────────────┐ ││  ← ACTIVE EDIT SECTION
        │  │  │ Joaquim a travaillé   │ ││  bg: #FFFFFF
        │  │  │ sur le squat.         │ ││  border: 1.5px solid #1C1A17 ← focused
        │  │  │ [text cursor blinking] │ ││  radius: 6px
        │  │  │                        │ ││  p: 12px
        │  │  └────────────────────────┘ ││  min-h: 80px (slightly taller)
        │  │                             ││  resize: vertical (subtle drag handle)
        │  │  Points forts               ││
        │  │  ┌────────────────────────┐ ││  ← read-only sections unchanged
        │  │  │ …                      │ ││  bg: #F0EFE9, no hover effect
        │  │  └────────────────────────┘ ││  (other sections still clickable)
        │  │                             ││
        │  │  [remaining sections...]    ││
        │  │                             ││
        │  │  Tags                       ││  ← still toggleable
        │  │  [force ✓] [technique]      ││
        │  │                             ││
        │  │─────────────────────────────││
        │  │           [Sauvegarder]     ││
        │  └─────────────────────────────┘│
        └─────────────────────────────────┘
```

**Exact pixel spec:**

**Active textarea (editing section):**
- Element: `<textarea>` (replaces the `<p>` / `<div>` in read-only mode)
- Background: `#FFFFFF`
- Border: `1.5px solid #1C1A17` (strong focus ring, not the default browser outline)
- Border-radius: 6px
- Padding: 12px
- Font: 16px/400/`#1C1A17`, line-height 1.6 (same as read-only — no visual shift)
- Min-height: 80px
- Resize: vertical
- Outline: none (override browser default — the border IS the focus indicator)
- `box-shadow: 0 0 0 3px rgba(28,26,23,0.06)` — subtle outer glow to reinforce focus

**Read-only sections while one is editing:**
- Visual appearance: identical to card-ready read-only state
- Hover: cursor pointer, border transitions active (still clickable to switch editing focus)
- Switching: clicking another section deactivates current editor (content saved in local state), activates new one

**No explicit "Done" or "Cancel" per-section.** Clicking another section switches focus. Clicking [Sauvegarder] commits all edits at once. This mirrors Linear/Notion inline editing UX.

---

### State 4: card-saving

**Purpose:** Coach pressed [Sauvegarder]. POST request in flight to `/coach/voice/structure` (or `/coach/vocal/save`). Short blocking state.

**Trigger:** [Sauvegarder] button pressed in card-ready or card-editing state

**Layout:** Identical to `card-ready` layout with two visual changes:

1. **[Sauvegarder] button:**
   - Text replaced by: spinner icon (Lucide `loader-2`, 16px, white, `animate-spin`) + " Sauvegarde…"
   - Disabled: opacity 0.7, cursor not-allowed
   - Width: preserved (no layout shift)

2. **Card sections:**
   - All sections: `pointer-events: none` (cannot click to edit during save)
   - Tags: `pointer-events: none`
   - Visual opacity: unchanged (no dim — the button state is sufficient feedback)

**Exact pixel spec:**
- Button content: flex row, items-center, gap-8px
  - `<Loader2 className="w-4 h-4 animate-spin" />` (Lucide, white, 16px)
  - "Sauvegarde…" — same 14px/600 weight
- All interactive elements: `pointer-events: none` via CSS class applied to card

---

### State 5: card-saved

**Purpose:** Save confirmed. Brief success state before the component resets to idle or stays to show the saved card in read-only mode.

**Trigger:** Successful API response from save endpoint

**Layout:**
```
[Content area — #F7F6F3]

        ┌─────────────────────────────────┐  max-w: 640px, mx-auto
        │                                 │
        │  ┌─────────────────────────────┐│  GREEN success block
        │  │  ✓  Retour sauvegardé.      ││  bg: #F0FDF4 (green-50)
        │  │                             ││  border: 1px solid #BBF7D0 (green-200)
        │  │  La card structurée a été   ││  radius: 8px
        │  │  enregistrée avec succès    ││  p: 16px
        │  │  pour cet athlète.          ││
        │  └─────────────────────────────┘│
        │                                 │
        │  [  + Nouveau retour  ]         │  Ghost/outline button, right-aligned
        │                                 │  border #E2E0DA, bg white
        └─────────────────────────────────┘
```

**Exact pixel spec:**
- Container: max-width 640px, mx-auto, px-0, mt-48px, flex-col gap-16px
- Success block:
  - Background: `#F0FDF4` (Tailwind green-50)
  - Border: `1px solid #BBF7D0` (Tailwind green-200)
  - Radius: 8px, padding: 16px
- Success icon row: flex, items-center, gap-8px
  - Lucide `check-circle` icon: 18px, color `#22C55E`
  - Heading: "Retour sauvegardé.", 14px/600/`#1C1A17`
- Body: "La card structurée a été enregistrée avec succès pour cet athlète.", 12px/400/`#6B6963`, mt-4px
- Action row: mt-0, flex, justify-end
- [Nouveau retour] button: ghost, border `1px solid #E2E0DA`, bg `#FFFFFF`, text `#1C1A17`, h 40px, px 24px, radius 8px, 14px/400
  - Hover: bg `#F0EFE9`
  - On press: state machine resets to `idle`

**Auto-reset behavior:** After 3 seconds with no user action, the panel automatically transitions to `idle`. The [Nouveau retour] button also triggers immediate reset.

---

### State 6: structuring-error

**Purpose:** Claude API call failed. Coach can retry (with same transcript) or go back to review.

**Trigger:** API error from `/coach/voice/structure` endpoint during `structuring` state

**Layout:**
```
[Content area — #F7F6F3]

        ┌─────────────────────────────────┐  max-w: 640px, mx-auto
        │                                 │
        │  ┌─────────────────────────────┐│  RED error block
        │  │  ⚠  La structuration a      ││  bg: #FEF2F2
        │  │     échoué.                 ││  border: 1px solid #FECACA
        │  │                             ││  radius: 8px
        │  │  Claude n'a pas pu          ││  p: 16px
        │  │  analyser le retour vocal.  ││
        │  │  Vérifiez votre connexion   ││
        │  │  ou réessayez.              ││
        │  └─────────────────────────────┘│
        │                                 │
        │         ┌──────────────┐ ┌──────────────┐
        │         │   Réessayer  │ │ Retour        │
        │         └──────────────┘ └──────────────┘
        │                                 │
        └─────────────────────────────────┘
```

**Exact pixel spec:**
- Container: max-width 640px, mx-auto, px-0, mt-48px, flex-col gap-16px
- Error block:
  - Background: `#FEF2F2` (Tailwind red-50)
  - Border: `1px solid #FECACA` (Tailwind red-200)
  - Radius: 8px, padding: 16px
- Error icon row: flex, items-center, gap-8px
  - Lucide `alert-triangle` icon: 18px, color `#EF4444`
  - Heading: "La structuration a échoué.", 14px/600/`#1C1A17`
- Body: "Claude n'a pas pu analyser le retour vocal. Vérifiez votre connexion ou réessayez.", 12px/400/`#6B6963`, mt-4px
- Button row: flex, gap-8px, justify-end
- [Réessayer] button: primary, bg `#FF5C1A`, text white, h 40px, px 24px, radius 8px, 14px/600
  - Action: retries the Claude API call with same transcript + context (no re-recording needed)
- [Retour] button: ghost/outline, border `1px solid #E2E0DA`, bg `#FFFFFF`, text `#1C1A17`, h 40px, px 24px, radius 8px, 14px/400
  - Hover: bg `#F0EFE9`
  - Action: transitions back to Phase 01 `review` state (transcript still available)

---

## Copywriting Contract

All copy in French. Inherits Phase 01 contract. Phase 02 additions:

| Element | Copy |
|---------|------|
| Structuring heading | "Structuration en cours…" |
| Structuring body | "Claude analyse le retour vocal et le contexte de l'athlète. Cela prend généralement 5 à 10 secondes." |
| Card header label | "Retour structuré" |
| Section label — Contexte | "Contexte séance" |
| Section label — Strengths | "Points forts" |
| Section label — Corrections | "Corrections" |
| Section label — Next steps | "Prochaines étapes" |
| Section label — Tags | "Tags" |
| Tag chip — force | "force" |
| Tag chip — technique | "technique" |
| Tag chip — mental | "mental" |
| Tag chip — cardio | "cardio" |
| Tag chip — recovery | "récupération" |
| Save button | "Sauvegarder" |
| Save in-progress button | "Sauvegarde…" |
| Saved heading | "Retour sauvegardé." |
| Saved body | "La card structurée a été enregistrée avec succès pour cet athlète." |
| New after save CTA | "Nouveau retour" |
| Error heading | "La structuration a échoué." |
| Error body | "Claude n'a pas pu analyser le retour vocal. Vérifiez votre connexion ou réessayez." |
| Error retry CTA | "Réessayer" |
| Error back CTA | "Retour" |

**Destructive action note:** "Retour" in the error state navigates back to the Phase 01 review transcript. The transcript is not lost. No confirmation required — this is a navigational back action, not a destructive delete.

---

## Motion Design

> Inherits Phase 01 personality: Snappy + Fluid hybrid
> Entrances: 200ms `power2.out`
> Interactive feedback: 100ms `power3.out`
> Complex reveals: 250ms `power2.inOut`

| Trigger | Animation | Duration | Easing | CSS/GSAP Pattern |
|---------|-----------|----------|--------|------------------|
| review → structuring (Valider press) | Panel crossfade | 200ms | power2.inOut | `gsap.to(".vocal-panel", { opacity: 0, duration: 0.1 })` then swap then `gsap.from(el, { opacity: 0, duration: 0.2, ease: "power2.out" })` |
| Spinner — structuring state | Continuous spin | 800ms | linear | `@keyframes spin { to { transform: rotate(360deg) } }` — 0.8s linear infinite (same as Phase 01 transcribing spinner) |
| structuring → card-ready | Card entrance | 250ms | power2.out | `gsap.from(".feedback-card", { y: 16, opacity: 0, duration: 0.25, ease: "power2.out" })` |
| Card sections stagger on enter | Sections cascade in | 200ms total | power2.out | `gsap.from(".card-section", { y: 8, opacity: 0, duration: 0.2, stagger: 0.04, ease: "power2.out" })` — 4 sections × 40ms stagger = 160ms total, snappy cascade |
| Tags entrance | Tags pop in after sections | 150ms | back.out(1.4) | `gsap.from(".tag-chip", { scale: 0.85, opacity: 0, duration: 0.15, stagger: 0.03, ease: "back.out(1.4)" })` |
| Section hover (card-ready) | Border color shift | 150ms | CSS ease | `transition: border-color 150ms ease` on `.section-block:hover` |
| Section click to edit | Textarea slide-in | 150ms | power2.out | `gsap.from("textarea", { opacity: 0, y: 4, duration: 0.15, ease: "power2.out" })` + border color transition |
| Tag toggle (on) | Scale bounce + fill | 150ms | back.out(1.4) | `gsap.to(chip, { scale: 1, duration: 0.15, ease: "back.out(1.4)" })` + CSS `transition: background-color 150ms, color 150ms` |
| Tag toggle (off) | Scale shrink + unfill | 100ms | power2.in | `gsap.to(chip, { scale: 0.95, duration: 0.05, yoyo: true, repeat: 1 })` + CSS transition |
| [Sauvegarder] press | Button scale feedback | 100ms | power3.out | `gsap.to(btn, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 })` |
| card-ready → card-saving | Button morph (text → spinner) | 150ms | power2.out | CSS transition on button content, `opacity: 0` on text then `opacity: 1` on spinner — no layout shift |
| card-saving → card-saved | Success block entrance | 200ms | power2.out | `gsap.from(".success-block", { y: 12, opacity: 0, duration: 0.2, ease: "power2.out" })` |
| Checkmark icon draw | SVG stroke draw | 300ms | power2.out | Lucide `check-circle` — CSS `stroke-dashoffset` animation: `@keyframes draw { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }` 0.3s power2.out |
| card-saving → structuring-error | Error block entrance + shake | 200ms + 300ms | power2.out + none | Entrance: `gsap.from(".error-block", { y: 8, opacity: 0, duration: 0.2 })` then shake: `gsap.to(".error-block", { keyframes: { x: [-6, 6, -4, 4, -2, 2, 0] }, duration: 0.3 })` |
| [Réessayer] press | Button scale feedback | 100ms | power3.out | Same as [Sauvegarder] press |
| [Retour] press | Panel crossfade back to review | 200ms | power2.inOut | Same crossfade pattern as review → structuring, reversed |
| card-saved → idle (auto or button) | Panel crossfade to idle | 200ms | power2.out | Same panel crossfade pattern |

**GSAP setup:**
```bash
# Check if already installed from Phase 01
npm list gsap 2>/dev/null || npm install gsap
```

---

## Generated Assets

No visual assets (hero images, illustrations, photography) required for this phase. The design is purely functional — card layout, chips, and editable sections only. No Higgsfield generation needed.

| Asset | Screen | Generator | URL |
|-------|--------|-----------|-----|
| None required | — | — | — |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Button, Textarea, Badge (for chip base) | not required |
| lucide-react | `sparkles`, `loader-2`, `check-circle`, `alert-triangle`, `x` icons | not required (Lucide is project standard) |

No third-party registries declared. Gate not applicable.

---

## Implementation Notes for Executor

### State Machine Extension

Phase 02 extends the `VocalState` type from Phase 01:

```ts
type VocalState =
  // Phase 01 states (unchanged)
  | { status: 'idle' }
  | { status: 'recording'; startedAt: number }
  | { status: 'transcribing'; blob: Blob }
  | { status: 'review'; transcript: string }
  | { status: 'error'; blob: Blob; message: string }
  // Phase 02 additions
  | { status: 'structuring'; transcript: string }
  | { status: 'card-ready'; card: StructuredCard; editedCard: StructuredCard }
  | { status: 'card-editing'; card: StructuredCard; editedCard: StructuredCard; activeSection: CardSection }
  | { status: 'card-saving'; editedCard: StructuredCard }
  | { status: 'card-saved' }
  | { status: 'structuring-error'; transcript: string; message: string }
```

### Data Types

```ts
type CardSection = 'context' | 'strengths' | 'corrections' | 'next_steps';

type TagKey = 'force' | 'technique' | 'mental' | 'cardio' | 'recuperation';

interface StructuredCard {
  context: string;          // "Contexte séance"
  strengths: string;        // "Points forts"
  corrections: string;      // "Corrections"
  next_steps: string;       // "Prochaines étapes"
  tags: TagKey[];           // auto-set by Claude, toggleable by coach
}
```

### Component Structure

New components in `apps/web/src/components/coach/vocal/`:

```
VocalStructuring.tsx      ← loading state (structuring)
VocalCardReady.tsx        ← 5-section card (card-ready + card-editing + card-saving + card-saved)
VocalStructuringError.tsx ← error state
FeedbackCard.tsx          ← the card component (used in VocalCardReady)
CardSection.tsx           ← individual section block (read-only / edit mode)
TagChip.tsx               ← toggleable chip
```

### Section Click-to-Edit Pattern

```tsx
// CardSection.tsx
const [isEditing, setIsEditing] = useState(false);

// Read-only: div with hover border, onClick to enter edit mode
// Edit mode: textarea with focus ring, onBlur to exit edit mode
// Value stored in parent editedCard state, not local state
```

### API Contract

The executor must call:
```
POST /coach/voice/structure
Body: {
  athlete_id: string,
  transcript: string,
  context: {
    sessions: WorkoutSession[],    // last 10 sessions
    measurements: Measurement[],   // recent measurements
    sleep_scores: SleepLog[],      // recent sleep scores
    coach_notes: string,           // private coach notes
    vocal_history: VocalFeedback[] // previous vocal feedbacks (Phase 03 dependency — empty array for Phase 02)
  }
}
Response: {
  card: StructuredCard
}
```

### Transition: review → structuring

The [Valider] button in Phase 01 `VocalReview.tsx` must dispatch to the new `structuring` state:

```ts
// On [Valider] press (was previously a no-op placeholder in Phase 01):
dispatch({ type: 'VALIDATE', transcript });
// Which sets: { status: 'structuring', transcript }
// And immediately fires: POST /coach/voice/structure
```

### Tag Display Labels

Map `TagKey` to French display labels:
```ts
const TAG_LABELS: Record<TagKey, string> = {
  force: 'force',
  technique: 'technique',
  mental: 'mental',
  cardio: 'cardio',
  recuperation: 'récupération',
};
```

### Accessibility

- Each section block has `role="button"` and `aria-label="Modifier : {section name}"` in read-only mode
- Textarea has `aria-label="{section name}"` when in edit mode
- Tag chips have `role="checkbox"` and `aria-checked={isSelected}` with `aria-label="{tag}"`
- [Sauvegarder] button is `disabled` and `aria-disabled="true"` during card-saving state
- Error block has `role="alert"` for screen reader announcement on entrance

### Auto-reset After Save

```ts
useEffect(() => {
  if (state.status !== 'card-saved') return;
  const timer = setTimeout(() => dispatch({ type: 'RESET' }), 3000);
  return () => clearTimeout(timer);
}, [state.status]);
```

---

## Checker Sign-Off

*Pending checker run.*
