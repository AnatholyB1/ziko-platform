# Ziko Platform — Mood Board & Visual Direction

**Created:** 2026-05-21
**Phase:** v1.5 Coach Platform (applies to all web + mobile surfaces)

---

## Visual Palette

| Role | Hex | Usage |
|------|-----|-------|
| Background | `#F7F6F3` | Page canvas — warm off-white that feels like quality paper |
| Surface | `#FFFFFF` | Cards, modals, panels — pure white for contrast |
| Surface Muted | `#F0EFE9` | Subtle inner zones, table zebra rows, input fills |
| Border | `#E2E0DA` | Dividers, card outlines, input borders — sandy warmth |
| Primary / Accent | `#FF5C1A` | Orange — primary CTA buttons, active states, progress bars, confidence-high chips |
| Text Primary | `#1C1A17` | Near-black — all body text, headings |
| Text Muted | `#6B6963` | Labels, helper text, timestamps, placeholders |
| Text Inverse | `#FFFFFF` | On primary (orange) backgrounds |
| Success | `#22C55E` | Confidence high ≥0.8, success toasts, committed status |
| Warning | `#F59E0B` | Confidence medium 0.5–0.8, yellow field highlights |
| Destructive | `#EF4444` | Failed status, removed rows in diff, destructive confirmation |
| Blue | `#3B82F6` | Parsing/in-progress status, info states |
| Purple | `#8B5CF6` | Committed status chip (distinct from success) |

**Rationale:** The warm off-white (`#F7F6F3`) grounds the entire product in a calm, sport-focused register. The orange primary creates decisive energy without aggression. Status colors (red/green/amber) carry full semantic weight — no decorative use.

---

## Typography Direction

**Font family:** Inter (system fallback: -apple-system, BlinkMacSystemFont, Segoe UI)
- Chosen for: legibility in data-dense UIs, excellent numeric tabular figures, reliable Figma library
- Not Geist (too code-editorial), not DM Sans (too geometric), not Sora (too playful)

**Scale rationale:** Data-dense editor UI (exercise tables, week accordions) demands tight-but-readable sizing. The scale skips small extremes — nothing below 12px, nothing above 32px for data screens.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display | 28px | 700 Bold | 1.2 | Page titles (web) |
| H1 | 22px | 600 Semibold | 1.3 | Section headings, modal titles |
| H2 | 18px | 600 Semibold | 1.35 | Card headings, accordion week titles |
| H3 | 15px | 600 Semibold | 1.4 | Table column headers, subsection labels |
| Body Large | 16px | 400 Regular | 1.5 | Lead paragraphs, status messages |
| Body | 14px | 400 Regular | 1.5 | General UI text, table cell values |
| Label | 13px | 500 Medium | 1.4 | Input labels, chip text, metadata |
| Caption | 12px | 400 Regular | 1.4 | Timestamps, helper text, footnotes |

---

## Motion Direction

**Personality:** Snappy + Fluid hybrid
- Entrances: 200ms `power2.out` — confident, not sluggish
- Exits: 150ms `power2.in` — clean, no trailing
- Interactive feedback (press/hover): 100ms `power3.out`
- Complex reveals (accordion, modal): 250ms `power2.inOut`
- Parsing animation: continuous sine pulse at 1.5s cycle

**Easing character:** Power curves (not expo) — assertive but not mechanical. The parsing/polling states use sinusoidal breathing to feel alive without feeling frantic.

---

## UI Density

**Balanced** — data-dense enough for a coach reviewing a 12-week program, but not claustrophobic. Key principles:
- Web: 8px grid, 16px default padding, 24px section gaps
- Mobile: 16px horizontal padding, 20px vertical rhythm
- Exercise table rows: 44px min height (touch-target compliant on mobile, comfortable on web)
- Accordion expand area: 12px inner padding per side

---

## Corner Radius Personality

**Subtle → Rounded** — depends on component size:
- xs radius (4px): input fields, table cells, inline badges
- sm radius (6px): small chips/tags
- md radius (8px): cards, modal dialogs, dropdowns
- lg radius (12px): upload zone, large action cards on mobile
- xl radius (16px): bottom sheets, major modals
- None (0px): table dividers, progress bars (except caps)

**Anti-pattern:** No pill shapes on primary CTAs — this is a professional coach tool, not a consumer app.

---

## Shadow Philosophy

**Soft elevation** — no harsh box shadows. Shadows communicate stacking, not decoration.

| Level | Value | Usage |
|-------|-------|-------|
| none | `none` | Flat surfaces, table rows |
| sm | `0 1px 2px rgba(28,26,23,0.06)` | Input focus rings, inline chips |
| md | `0 4px 8px rgba(28,26,23,0.08)` | Cards, dropdown menus |
| lg | `0 8px 24px rgba(28,26,23,0.10)` | Modals, bottom sheets |
| xl | `0 16px 40px rgba(28,26,23,0.12)` | Upload zone hover, fullscreen overlays |

---

## References

1. **Linear** — precision UI for technical users, data tables with inline editing, accordion patterns, subtle grays, Inter typography. What we borrow: table density, inline edit UX, keyboard-first feel.
2. **Vercel Dashboard** — clean deployment/status pages, status chip language (building/ready/error), progress polling UI, confident orange accents for CTA. What we borrow: status chip design, upload zones, async polling feedback patterns.
3. **Notion** — structured document editing with block-level controls, drag-to-reorder, subtle confidence annotations. What we borrow: the structural editor metaphor for weeks/sessions/exercises.

---

## Anti-Patterns — What This Project Must Never Do

1. **No generic gradient backgrounds** — no `linear-gradient(135deg, orange, red)` hero sections. The import flow is functional, not promotional. Background stays `#F7F6F3`.
2. **No animated loading skeletons that pulse in primary orange** — orange is the action color, not the waiting color. Use `#E2E0DA` for skeleton fills. Orange only on the parsing progress bar.
3. **No modal-heavy editing flows** — the structural editor on web is inline (accordion + inline input). Do not push users into nested modal stacks to edit a single exercise rep count.
