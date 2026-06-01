---
phase: "04"
phase_name: "Polish + Coach Memory"
workstream: "custom-widget"
figma_file_url: "pending — Figma desktop app not connected during this session; all specs are pixel-complete below"
status: "approved"
created: "2026-05-28"
reviewed_at: "2026-05-28"
---

# UI-SPEC: Phase 04 — Polish + Coach Memory

## Figma Designs

**Status:** Figma file creation blocked — the MCP server requires the Figma desktop app to be open with an accessible file. All design specifications below are pixel-complete and sufficient for implementation. No visual decision is deferred.

### Screens

| Screen | State | Figma Link |
|--------|-------|------------|
| DashboardEditOverlay — top bar (save-as-template variant) | Template action available | pending |
| TemplateNamingModal | Empty name field | pending |
| TemplateNamingModal | Name entered, save enabled | pending |
| TemplateNamingModal | Loading (saving) | pending |
| TemplateNamingModal | Error (duplicate name) | pending |
| TemplatePicker | Populated (1–N templates) | pending |
| TemplatePicker | Empty state (no templates yet) | pending |
| TemplatePicker | Loading skeleton | pending |
| EditChatPanel — personalized opening message | Memory loaded (recent actions visible) | pending |
| EditChatPanel — personalized opening message | First-time user (generic fallback) | pending |

---

## Design Tokens

All tokens are **locked from Phase 03 UI-SPEC** and the project MOODBOARD.md. No new tokens are introduced in Phase 04. The table below is a reference summary for executor convenience.

### Colors (inherited, no changes)

**Color distribution: 60% background/surface · 30% muted fills/borders · 10% primary orange.**

| Token | Hex | Phase 04 usage |
|-------|-----|----------------|
| `color/background` | `#F7F6F3` | TemplatePicker overlay backdrop, modal backdrop scrim |
| `color/surface` | `#FFFFFF` | TemplateNamingModal body, TemplatePicker card backgrounds, template card surfaces |
| `color/surface-muted` | `#F0EFE9` | Template card hover fill, modal input fill, skeleton blocks |
| `color/border` | `#E2E0DA` | Modal border, template card border, input border, dividers |
| `color/primary` | `#FF5C1A` | "Sauvegarder" in modal (primary action), active template card selection ring, "Utiliser ce modèle" button |
| `color/text` | `#1C1A17` | Modal title, template card name, all primary labels |
| `color/text-muted` | `#6B6963` | Template card subtitle ("Créé le…"), modal input hint, empty-state body text |
| `color/text-inverse` | `#FFFFFF` | Text on primary (orange) buttons |
| `color/success` | `#22C55E` | Template saved confirmation toast left border |
| `color/destructive` | `#EF4444` | Duplicate name error text under input |

### Typography (inherited, no changes)

**Scale: 4 sizes only. 2 weights only: 400 Regular for body and captions; 600 Semibold for all headings, button labels, and emphasis.**

| Role | Size | Weight | Line Height | Phase 04 usage |
|------|------|--------|-------------|----------------|
| H1 | 22px | 600 Semibold | 1.3 | TemplateNamingModal title ("Enregistrer comme modèle"), TemplatePicker heading ("Commencer depuis un modèle") |
| H2 | 18px | 600 Semibold | 1.35 | Template card name (truncated to 1 line) |
| Body | 14px | 400 Regular | 1.5 | Modal description text, template card widget summary, opening message content, button labels, input label, chip text ("N widgets"), "Annuler" / "Créer sans modèle" links, section sublabels (14px/600 for sublabel emphasis) |
| Caption | 12px | 400 Regular | 1.4 | "Créé le DD/MM/YYYY", skeleton timestamp placeholder, character counter |

> **Note on H3 removal:** There is no H3 (15px) size. Section sublabels previously assigned H3 use Body (14px) at 600 Semibold weight instead.
> **Note on Label merge:** There is no separate Label (13px) size. All button labels, chip text, and UI labels use Body (14px). This keeps the scale clean at 4 sizes.

### Spacing (inherited, 8-point grid)

| Token | Value | Phase 04 usage |
|-------|-------|----------------|
| `space/1` | 4px | Gap between template card badge and name |
| `space/2` | 8px | Button gap in modal footer, gap between template cards in grid |
| `space/3` | 12px | Template card inner padding (vertical rhythm) — intentional half-step between 8px and 16px for tight card internals |
| `space/4` | 16px | Modal content horizontal padding, TemplatePicker horizontal padding |
| `space/5` | 20px | Modal header bottom padding — intentional half-step between 16px and 24px for modal vertical rhythm |
| `space/6` | 24px | TemplatePicker section gap, modal vertical padding |
| `space/8` | 32px | TemplatePicker header area bottom margin |

### Corner Radius (inherited)

| Token | Value | Phase 04 usage |
|-------|-------|----------------|
| `radius/sm` | 6px | Widget count badge on template card |
| `radius/md` | 8px | Modal dialog, template card, input field, all buttons |
| `radius/lg` | 12px | Toast notification (same as Phase 03 SaveToast) |

### Shadows (inherited)

| Token | Value | Phase 04 usage |
|-------|-------|----------------|
| `shadow/md` | `0 4px 8px rgba(28,26,23,0.08)` | Template card (default) |
| `shadow/lg` | `0 8px 24px rgba(28,26,23,0.10)` | TemplateNamingModal, toast |
| `shadow/xl` | `0 16px 40px rgba(28,26,23,0.12)` | TemplatePicker overlay panel |

---

## Layout Specs

### 1. "Enregistrer comme modèle" Entry Point — Top Bar Modification

The DashboardEditOverlay top bar (from Phase 03) gains one secondary action in the button group.

**Updated top bar button group layout (right side):**
```
[Annuler]  [Enregistrer comme modèle ↓]  [Sauvegarder]
```

| Property | Value |
|----------|-------|
| Position in button group | Between "Annuler" and "Sauvegarder", gap 8px from each |
| Button style | Ghost/outline — identical to "Annuler" |
| Height | 36px |
| Horizontal padding | 16px |
| Icon | `bookmark-outline` (Ionicons, 14px, `#1C1A17`) left of text |
| Text | `Enregistrer comme modèle`, 14px/600, `#1C1A17` |
| Icon-text gap | 6px |
| Click action | Opens TemplateNamingModal (does NOT trigger a dashboard save) |
| Disabled state | When `isStreaming === true` — opacity 0.4, cursor not-allowed |
| Hover | background `#F0EFE9` |

**Full top bar width allocation:**
- Label "Dashboard • Édition" → left-aligned, 14px/600
- Spacer (flex-1)
- Button group: `[Annuler]` — `[Enregistrer comme modèle]` — `[Sauvegarder]`, gap 8px

---

### 2. TemplateNamingModal — Exact Measurements

A centered dialog that appears above the DashboardEditOverlay.

```
┌────────────────────────────────────────┐
│  Modal backdrop: rgba(0,0,0,0.40)      │
│  ┌──────────────────────────────────┐  │
│  │ TemplateNamingModal              │  │
│  │ ┌──────────────────────────────┐ │  │
│  │ │ Header (px-6 pt-6 pb-5)      │ │  │
│  │ │ "Enregistrer comme modèle"   │ │  │
│  │ │  22px/600 #1C1A17            │ │  │
│  │ │ ─────────────────────────── │ │  │
│  │ │ body text 14px/400 #6B6963  │ │  │
│  │ └──────────────────────────────┘ │  │
│  │ ┌──────────────────────────────┐ │  │
│  │ │ Content (px-6 pb-6)          │ │  │
│  │ │ <label> Nom du modèle        │ │  │
│  │ │ <input> (see specs)          │ │  │
│  │ │ [error text if any]          │ │  │
│  │ └──────────────────────────────┘ │  │
│  │ ┌──────────────────────────────┐ │  │
│  │ │ Footer (px-6 pb-6)           │ │  │
│  │ │ [Annuler]  [Enregistrer le modèle] │ │  │
│  │ └──────────────────────────────┘ │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Modal container:**

| Property | Value |
|----------|-------|
| Width | 480px (fixed) |
| Min-height | auto (content-driven) |
| Background | `#FFFFFF` |
| Border radius | 8px (radius/md) |
| Shadow | `0 8px 24px rgba(28,26,23,0.10)` |
| Position | `fixed`, centered: `top: 50%; left: 50%; transform: translate(-50%, -50%)` |
| Z-index | 50 (above DashboardEditOverlay at z-index 20) |
| Backdrop | `fixed inset-0 bg-black/40 z-40` |

**Modal header:**

| Property | Value |
|----------|-------|
| Padding | 24px horizontal, 24px top, 20px bottom |
| Title | "Enregistrer comme modèle", 22px/600 Semibold, `#1C1A17` |
| Body text | "Ce modèle sera disponible lorsque vous créerez un dashboard pour un autre athlète.", 14px/400, `#6B6963`, mt-2 |
| Bottom border | `1px solid #E2E0DA` |

**Modal content:**

| Property | Value |
|----------|-------|
| Padding | 24px horizontal, 20px top, 16px bottom |
| Input label | "Nom du modèle", 14px/600, `#1C1A17`, mb-2 |
| Input type | text |
| Input height | 40px |
| Input padding | 12px horizontal, 10px vertical |
| Input background | `#F0EFE9` (idle), `#FFFFFF` (focus) |
| Input border | `1px solid #E2E0DA` (idle), `1px solid #FF5C1A` (focus) |
| Input border radius | 8px |
| Input font | 14px/400, `#1C1A17` |
| Input placeholder | "Ex. : Programme force 4j", 14px/400, `#6B6963` |
| Max character | 60 characters (enforced via `maxLength`) |
| Character counter | Right-aligned below input, 12px/400, `#6B6963` (shows "N/60") |
| Error text | Below input, 14px/400, `#EF4444`, mt-1; visible only when validation fails |

**Modal footer:**

| Property | Value |
|----------|-------|
| Padding | 0px horizontal (inherits 24px from container), 20px vertical |
| Border top | `1px solid #E2E0DA` |
| Layout | flex, justify-end, gap 8px |

**Footer buttons:**

"Annuler" — Ghost/Outline (identical to overlay "Annuler"):
- Height: 36px, horizontal padding: 16px, border: `1px solid #E2E0DA`, radius: 8px, text: 14px/600, `#1C1A17`

"Enregistrer le modèle" — Primary Filled:
- Height: 36px, horizontal padding: 16px, background: `#FF5C1A`, border-radius: 8px, text: 14px/600, `#FFFFFF`
- Disabled when name field is empty (opacity 0.4, cursor not-allowed)
- Loading state: spinner icon (16px) replaces text, button disabled

---

### 3. TemplatePicker — Exact Measurements

Shown instead of the blank initial dashboard when a coach opens a new athlete's dashboard AND at least one saved template exists. Renders as a full-content-area overlay (replaces the DashboardGrid view, within the same page — not the edit overlay).

```
┌─────────────────────────────────────────────────────────────┐
│ CoachSidebar (240px fixed)                                  │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Content area (full height minus ClientTabStrip)        │   │
│ │                                                        │   │
│ │  TemplatePicker                                        │   │
│ │  ┌──────────────────────────────────────────────────┐ │   │
│ │  │ Header area (pb-8 = 32px)                        │ │   │
│ │  │ "Commencer depuis un modèle"  22px/600           │ │   │
│ │  │ "Sélectionnez un modèle..."   14px/400 #6B6963   │ │   │
│ │  └──────────────────────────────────────────────────┘ │   │
│ │  ┌──────────────────────────────────────────────────┐ │   │
│ │  │ Template cards grid (auto-fill, min 280px cards) │ │   │
│ │  │ ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │   │
│ │  │ │ Template │  │ Template │  │ Template │        │ │   │
│ │  │ │  Card 1  │  │  Card 2  │  │  Card 3  │        │ │   │
│ │  │ └──────────┘  └──────────┘  └──────────┘        │ │   │
│ │  └──────────────────────────────────────────────────┘ │   │
│ │  ┌──────────────────────────────────────────────────┐ │   │
│ │  │ Footer link (mt-8)                               │ │   │
│ │  │ "Créer sans modèle →"  14px/600 #FF5C1A          │ │   │
│ │  └──────────────────────────────────────────────────┘ │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**TemplatePicker container:**

| Property | Value |
|----------|-------|
| Layout | Full content area of dashboard/page.tsx (replaces DashboardGrid when hasTemplates && isNewDashboard) |
| Padding | 32px all sides (p-8) |
| Background | `#F7F6F3` |
| Max-width | 960px, centered (mx-auto) |

**Header:**

| Property | Value |
|----------|-------|
| Title | "Commencer depuis un modèle", 22px/600 Semibold, `#1C1A17` |
| Subtitle | "Sélectionnez un modèle enregistré ou créez un dashboard vide.", 14px/400, `#6B6963`, mt-2 |
| Bottom margin | 32px (mb-8) |

**Template cards grid:**

| Property | Value |
|----------|-------|
| Layout | CSS grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` |
| Gap | 16px (gap-4) |

**Individual TemplateCard:**

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Border | `1px solid #E2E0DA` |
| Border radius | 8px |
| Padding | 20px |
| Shadow | `0 4px 8px rgba(28,26,23,0.08)` |
| Hover | border-color `#FF5C1A` (orange ring), shadow `0 8px 24px rgba(28,26,23,0.10)`, background stays white |
| Selected state | border `2px solid #FF5C1A`, shadow `0 8px 24px rgba(255,92,26,0.15)` |
| Cursor | pointer |
| Min-height | 160px |
| Transition | border 150ms, shadow 150ms |

**TemplateCard internal layout:**

```
┌─────────────────────────────────────────┐
│ [Widget count badge]                    │
│                                         │
│ Template name (18px/600, 1 line)        │
│ mt-3                                    │
│ Widget list summary (14px/400 #6B6963)  │
│ (2 lines max, truncated)                │
│                                         │
│ ─────────────────────────────────────   │
│ Créé le DD/MM/YYYY (12px/400 #6B6963)  │
│                                         │
│ [Utiliser ce modèle] (full width)       │
└─────────────────────────────────────────┘
```

**Widget count badge:**

| Property | Value |
|----------|-------|
| Style | Inline pill: `bg-[#F0EFE9] text-[#1C1A17] rounded-sm px-2 py-0.5` |
| Font | 14px/600 |
| Content | "N widgets" (e.g., "5 widgets") |
| Border radius | 6px (radius/sm) |

**Widget list summary:**
- Content: comma-separated list of widget type labels, e.g., "Poids, Sommeil, Habitudes..."
- Max 2 lines, `overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical`
- mt-2 below name

**Creation date:**
- Border top: `1px solid #E2E0DA`, pt-3, mt-3
- "Créé le [date formatted as DD/MM/YYYY]", 12px/400, `#6B6963`

**"Utiliser ce modèle" button:**

| Property | Value |
|----------|-------|
| Width | 100% (w-full) |
| Height | 36px |
| Background | `#FF5C1A` |
| Border radius | 8px |
| Text | "Utiliser ce modèle", 14px/600, `#FFFFFF` |
| Margin top | 12px (mt-3) |
| Hover | opacity 0.9 |
| Loading state | spinner (16px), disabled |

**"Créer sans modèle" footer link:**

| Property | Value |
|----------|-------|
| Position | Below template grid, mt-8 |
| Style | Plain text link, no button chrome |
| Text | "Créer sans modèle →", 14px/600, `#FF5C1A` |
| Hover | underline |
| Click action | Initializes default dashboard config (3–4 widgets) and dismisses TemplatePicker |

---

### 4. Personalized Opening Message Layout

The opening message is an assistant bubble inside EditChatPanel. The visual layout is identical to Phase 03 opening message. What changes is the content: it is dynamically personalized using `coach_memory`.

There are two visual sub-states:

**Sub-state A — Memory loaded (personalized)**

The message content shows evidence of remembered preferences:
- Paragraph 1: current widget list (unchanged from Phase 03)
- Paragraph 2: personalized suggestion based on coach_memory, e.g., "J'ai appliqué vos préférences habituelles (période 30j, graphe de poids)."
- Paragraph 3: 3 concrete action examples drawn from coach's recent history

Visual rendering: same assistant bubble spec as Phase 03. No additional chrome. The personalization is content-only, not a distinct visual treatment.

**Sub-state B — First-time / no memory (generic fallback)**

Content is identical to Phase 03 opening message. No UI indication that memory is absent (no "memory not loaded" badge). Degradation is invisible.

---

## State Specifications

### Screen A: TemplateNamingModal — All States

**State A1: Empty (initial)**
- Input field empty
- "Enregistrer le modèle" button: disabled (opacity 0.4)
- No error text visible
- Character counter: "0/60"
- Focus: input receives focus on mount (autoFocus)

**State A2: Name entered (valid, save enabled)**
- Input has content, within 60 chars
- "Enregistrer le modèle" button: enabled, `#FF5C1A`
- Character counter: "N/60", color `#6B6963`
- No error text
- Enter key triggers save

**State A3: Loading (save in progress)**
- "Enregistrer le modèle" button: spinner (16px, white, CSS spin), disabled
- "Annuler" button: disabled (opacity 0.4)
- Input: `readOnly`, opacity 0.6
- Modal not dismissible (click-outside disabled during save)

**State A4: Error — Duplicate name**
- Input border: `1px solid #EF4444`
- Error text below input: "Ce nom est déjà utilisé. Choisissez un nom différent.", 14px/400, `#EF4444`
- "Enregistrer le modèle" button: enabled (coach can edit name and retry immediately)
- Focus: returns to input

**State A5: Success (modal closes)**
- Modal unmounts
- TemplateNamingModal closes instantly (no animation)
- SaveToast variant appears: "Modèle enregistré" (green border, identical spec to Phase 03 SaveToast)

---

### Screen B: TemplatePicker — All States

**State B1: Loading skeleton**
- Shown when `GET /coach/dashboards/memory` is in flight
- Grid renders 3 skeleton cards at full card dimensions
- Skeleton card: background `#FFFFFF`, border `1px solid #E2E0DA`, border-radius 8px
- Skeleton blocks: `bg-[#E2E0DA]` animated pulse (CSS animation)
  - Badge placeholder: 48px × 20px, radius 4px
  - Name placeholder: 160px × 16px, mt-3, radius 4px
  - Summary placeholder: 220px × 12px, mt-2, radius 4px; second line 180px × 12px, mt-1
  - Date placeholder: 100px × 10px, mt-3
  - Button placeholder: full width × 36px, mt-3, radius 8px
- Skeleton animation: `@keyframes skeleton-pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`, 1.5s ease-in-out infinite
- "Créer sans modèle" link: hidden during skeleton (footer not rendered)

**State B2: Populated (templates available)**
- All template cards rendered as specified in Layout Specs section 3
- Grid scrolls naturally if many templates
- "Créer sans modèle →" link visible below grid

**State B3: Empty state (no templates saved yet)**
- TemplatePicker is NOT shown when no templates exist
- Dashboard loads directly with default config (3–4 widgets), same as a returning coach
- There is no "no templates" empty state UI — the picker only renders when templates exist
- (This means State B3 is "not rendered" — the conditional is: `templates.length > 0 && isNewDashboard`)

**State B4: Card hover**
- Border color transitions to `#FF5C1A`, 150ms
- Shadow increases to `0 8px 24px rgba(28,26,23,0.10)`

**State B5: "Utiliser ce modèle" loading**
- Button shows spinner, disabled
- Card border stays orange (selected ring)
- Other cards: opacity 0.5 (visual mute — communicates one is being applied)
- "Créer sans modèle" link: hidden during load

---

### Screen C: Personalized Opening Message States

**State C1: Memory loading (< 200ms)**
- Opening message placeholder: typing indicator (3 dots, identical to Phase 03 TypingIndicator spec)
- ChatInputBar: disabled
- This state is near-invisible for returning coaches with cached memory

**State C2: Memory loaded — personalized**
- Full personalized opening message renders as assistant bubble
- Content: personalized (see Copywriting section)
- ChatInputBar: enabled
- No visual distinction from Phase 03 generic message — distinction is content only

**State C3: Memory load failed / first-time**
- Falls back to generic Phase 03 opening message
- No error indication shown to coach
- ChatInputBar: enabled after fallback renders

---

## Component Inventory

### Reused As-Is (no modifications)

| Component | Source | Usage in Phase 04 |
|-----------|--------|-------------------|
| `DashboardEditOverlay.tsx` | Phase 03 | Top bar receives new "Enregistrer comme modèle" button — see Modified section |
| `SaveToast.tsx` | Phase 03 | Reused for "Modèle enregistré" toast (different copy, same spec) |
| `TypingIndicator.tsx` | Phase 03 | Used as placeholder during memory fetch in opening message |
| `MessageBubble.tsx` | `components/coach/MessageBubble.tsx` | Personalized opening message renders in same bubble format |
| `ChatInputBar.tsx` | `components/coach/ChatInputBar.tsx` | No change needed |
| `DashboardGrid.tsx` | Phase 02 | Rendered after TemplatePicker is dismissed |

### New Components — Phase 04

| Component | Path | Responsibility |
|-----------|------|----------------|
| `TemplateNamingModal.tsx` | `components/coach/dashboard/TemplateNamingModal.tsx` | Controlled dialog: name input, validation, PUT memory call, success/error states |
| `TemplatePicker.tsx` | `components/coach/dashboard/TemplatePicker.tsx` | Grid of template cards; shown when `isNewDashboard && templates.length > 0`; handles template apply + "skip" link |
| `TemplateCard.tsx` | `components/coach/dashboard/TemplateCard.tsx` | Individual template card: badge, name, summary, date, "Utiliser" button |

### Modified Components — Phase 04

| Component | Modification |
|-----------|-------------|
| `DashboardEditOverlay.tsx` | Add "Enregistrer comme modèle" button to top bar; add `isTemplateModalOpen` state; render `<TemplateNamingModal>` conditionally; disable the button when `isStreaming` |
| `EditChatPanel.tsx` | Replace static opening message with personalized version from `useCoachMemory` hook; show TypingIndicator while memory loads; fall back to generic message on error or first use |
| `dashboard/page.tsx` | Add `isNewDashboard` detection (no stored config for this coach+athlete pair); conditionally render `<TemplatePicker>` before `<DashboardGrid>`; pass `onTemplateSelect` handler |

### Registry

No third-party registries — all components are internal codebase or Phase 03 precedents.

---

## Motion Design

### GSAP Contracts

All motion follows the Phase 03 / MOODBOARD.md motion personality: snappy entrances (150–200ms, power2.out), clean exits (150ms, power2.in), interactive feedback (100ms, power3.out).

**1. TemplateNamingModal Entrance**

```typescript
// Fires in useEffect on mount
gsap.fromTo(
  modalRef.current,
  { opacity: 0, scale: 0.97, y: 8 },
  { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'power2.out' }
);
```
- Duration: 200ms
- Scale: 0.97 → 1.0 (subtle pop)
- Y offset: 8px (settles into place)
- Easing: power2.out
- Backdrop: CSS `opacity: 0.4`, no GSAP (instant on mount)

**2. TemplateNamingModal Exit**

```typescript
// Fires on cancel or after successful save, before unmount
gsap.to(modalRef.current, {
  opacity: 0,
  scale: 0.97,
  y: 4,
  duration: 0.15,
  ease: 'power2.in',
  onComplete: () => setIsModalOpen(false),
});
```
- Duration: 150ms
- Easing: power2.in
- Unmounts via `onComplete`

**3. TemplatePicker Entrance**

```typescript
// Fires in useEffect on mount of TemplatePicker
gsap.from(headerRef.current, { opacity: 0, y: 12, duration: 0.2, ease: 'power2.out' });
gsap.from(cardRefs.current, {
  opacity: 0,
  y: 16,
  duration: 0.2,
  ease: 'power2.out',
  stagger: 0.06,
  delay: 0.05,
});
gsap.from(footerLinkRef.current, { opacity: 0, duration: 0.15, ease: 'power2.out', delay: 0.2 });
```
- Header: 200ms, y 12px
- Cards: 200ms, y 16px, stagger 60ms per card
- Footer link: 150ms opacity only, delayed 200ms

**4. TemplatePicker Exit (template selected)**

```typescript
// Before TemplatePicker unmounts (template applied)
gsap.to(pickerContainerRef.current, {
  opacity: 0,
  duration: 0.15,
  ease: 'power2.in',
  onComplete: () => setShowPicker(false),
});
```
- Duration: 150ms
- No y movement — flat fade

**5. TemplateCard Hover (CSS preferred for performance)**

```css
/* Applied via Tailwind transition utilities */
/* border-color and box-shadow transition via CSS */
transition: border-color 150ms ease, box-shadow 150ms ease;
```
- No GSAP — CSS transition only for hover state
- GSAP used only for mount/unmount of the picker container

**6. "Utiliser ce modèle" Button Press Feedback**

```typescript
gsap.to(useTemplateBtnRef.current, {
  scale: 0.96,
  duration: 0.1,
  yoyo: true,
  repeat: 1,
  ease: 'power3.out',
});
```
- Duration: 100ms
- Scale: 0.96 (same pattern as Phase 03 send button)

**7. "Enregistrer comme modèle" Button in Top Bar — Press Feedback**

```typescript
gsap.to(saveAsTemplateBtnRef.current, {
  scale: 0.97,
  duration: 0.1,
  yoyo: true,
  repeat: 1,
  ease: 'power3.out',
});
```

**8. Template Saved Toast**

Reuses Phase 03 SaveToast GSAP contracts verbatim:
- Enter: `gsap.from(toastRef, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' })`
- Auto-dismiss (3000ms): `gsap.to(toastRef, { opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: ... })`

**9. Skeleton Pulse Animation (CSS)**

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.skeleton-block {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```
- All skeleton blocks share the same keyframe
- No stagger (simultaneous pulse — single loading state)

**10. Opening Message Personalized Content Entrance**

```typescript
// When memory resolves and personalized message replaces TypingIndicator
gsap.from(openingBubbleRef.current, {
  y: 8,
  opacity: 0,
  duration: 0.15,
  ease: 'power2.out',
});
```
- Identical to Phase 03 message bubble entrance contract
- Only fires when the bubble is appended (memory loaded) — not on the typing indicator

---

## Copywriting

All UI strings in French. No English in the UI layer.

### Top Bar Addition (DashboardEditOverlay)

| Element | String |
|---------|--------|
| New button label | `Enregistrer comme modèle` |

### TemplateNamingModal

| Element | String |
|---------|--------|
| Modal title | `Enregistrer comme modèle` |
| Modal description | `Ce modèle sera disponible lorsque vous créerez un dashboard pour un autre athlète.` |
| Input label | `Nom du modèle` |
| Input placeholder | `Ex. : Programme force 4j` |
| Character counter | `N/60` |
| Error — duplicate name | `Ce nom est déjà utilisé. Choisissez un nom différent.` |
| Error — save failed | `Erreur lors de l'enregistrement. Réessayer ?` |
| Cancel button | `Annuler` |
| Save button (idle) | `Enregistrer le modèle` |
| Save button (loading) | *(spinner, no text)* |
| Toast — success | `Modèle enregistré` |

### TemplatePicker

| Element | String |
|---------|--------|
| Heading | `Commencer depuis un modèle` |
| Subtitle | `Sélectionnez un modèle enregistré ou créez un dashboard vide.` |
| Widget count badge | `N widget` / `N widgets` (pluralized) |
| Widget summary (pattern) | Comma-separated widget type labels, e.g., `Poids, Sommeil, Habitudes...` |
| Date label | `Créé le DD/MM/YYYY` |
| Apply button | `Utiliser ce modèle` |
| Apply button (loading) | *(spinner, no text)* |
| Skip link | `Créer sans modèle →` |

### Widget Type Display Names (for template card summaries)

| Internal type | Display label (FR) |
|--------------|-------------------|
| `sessions_summary` | `Séances` |
| `sleep_chart` | `Sommeil` |
| `mood_trend` | `Humeur` |
| `weight_progression` | `Poids` |
| `nutrition_macros` | `Nutrition` |
| `cardio_stats` | `Cardio` |
| `habits_streak` | `Habitudes` |

### Personalized Opening Message (EditChatPanel)

**Sub-state A — With memory (personalized):**

```
Votre dashboard affiche actuellement : [widget 1, widget 2, widget 3...].

J'ai appliqué vos préférences habituelles : [préférence 1], [préférence 2].

Dites-moi ce que vous souhaitez modifier. Exemples : '[action récente 1]', '[action récente 2]', 'Ajoutez un graphe de [widget préféré]'.
```

Where:
- `[préférence 1]` = e.g., "période 30 jours", "graphe de poids"
- `[action récente 1]` = drawn from `coach_memory.recent_actions` array (last 2 unique actions)
- `[widget préféré]` = most-used widget type from `coach_memory.preferences.preferred_widgets[0]`

**Sub-state B — No memory / first-time (generic fallback, identical to Phase 03):**

```
Votre dashboard affiche actuellement : [widget 1, widget 2, widget 3...]. Dites-moi ce que vous souhaitez modifier. Exemples : 'Mettez le score de sommeil en premier', 'Supprimez la note', 'Ajoutez un graphe de poids sur 30 jours'.
```

### "Enregistrer comme modèle" button tooltip (accessible label only)

| Element | String |
|---------|--------|
| `aria-label` | `Enregistrer ce dashboard comme modèle réutilisable` |

---

## State Machine

```
dashboard/page.tsx
│
├── [isNewDashboard = true AND templates.length > 0]
│   │
│   └── TemplatePicker
│       ├── "Utiliser ce modèle" clicked
│       │   → PUT /coach/dashboards/memory (apply template widgets)
│       │   → setIsNewDashboard(false)
│       │   → setWidgets(template.widgets)
│       │   → TemplatePicker unmounts (GSAP fade)
│       │   → DashboardGrid renders with template widgets
│       │
│       └── "Créer sans modèle" clicked
│           → setIsNewDashboard(false) (no API call)
│           → TemplatePicker unmounts (GSAP fade)
│           → DashboardGrid renders with DEFAULT_WIDGETS
│
├── [isNewDashboard = true AND templates.length = 0]
│   └── DashboardGrid renders with DEFAULT_WIDGETS (no picker shown)
│
├── [isNewDashboard = false, isEditing = false]
│   └── DashboardGrid (view mode) — see Phase 03 state machine
│
└── [isEditing = true]
    │
    └── DashboardEditOverlay
        │
        ├── Top Bar (updated)
        │   ├── "Annuler" → [Phase 03 behavior unchanged]
        │   ├── "Enregistrer comme modèle"
        │   │   → setIsTemplateModalOpen(true)
        │   │   → GSAP modal entrance (200ms, power2.out)
        │   └── "Sauvegarder" → [Phase 03 behavior unchanged]
        │
        ├── TemplateNamingModal [conditional: isTemplateModalOpen]
        │   ├── Input change → update name state
        │   ├── "Annuler" → GSAP modal exit (150ms) → setIsTemplateModalOpen(false)
        │   └── "Enregistrer le modèle" (name valid)
        │       → PUT /coach/dashboards/memory (add template)
        │       ├── [success] → GSAP modal exit → setIsTemplateModalOpen(false) → SaveToast "Modèle enregistré"
        │       └── [error: duplicate] → show error text, keep modal open
        │
        └── EditChatPanel (updated opening message)
            │
            ├── [MOUNT] → GET /coach/dashboards/memory
            │   ├── [loading < 200ms] → TypingIndicator placeholder
            │   ├── [success + memory exists] → personalized opening message
            │   └── [failure OR no memory] → generic Phase 03 opening message
            │
            └── [rest of chat behavior — unchanged from Phase 03]


coach_memory JSONB shape:
{
  "preferences": {
    "preferred_period": "30d" | "7d" | "90d",
    "preferred_widgets": ["weight_progression", "sleep_chart", ...],
    "preferred_chart_type": "line" | "bar"
  },
  "templates": [
    {
      "id": "uuid",
      "name": "string (max 60 chars)",
      "widgets": Widget[],
      "created_at": "ISO string"
    }
  ],
  "recent_actions": [
    "Mettez le score de sommeil en premier",
    "Ajoutez un graphe de poids sur 30 jours"
  ]
}
```

---

## API Contract (UI perspective)

### Existing endpoints (reused from Phase 01)

```
GET /coach/dashboards/memory
Authorization: Bearer <jwt>

Response 200: {
  preferences: {
    preferred_period: string,
    preferred_widgets: string[],
    preferred_chart_type: string
  },
  templates: Array<{
    id: string,
    name: string,
    widgets: Widget[],
    created_at: string
  }>,
  recent_actions: string[]
}

Response 404: { error: "No memory record" }  → UI falls back to generic message
```

```
PUT /coach/dashboards/memory
Authorization: Bearer <jwt>
Content-Type: application/json

Body (save new template):
{
  templates: [...existingTemplates, newTemplate]
}

Body (update preferences):
{
  preferences: { preferred_period, preferred_widgets, preferred_chart_type }
}

Response 200: { ok: true }
Response 409: { error: "Template name already exists" }  → TemplateNamingModal error state A4
```

### UI call sequence — "Enregistrer comme modèle" flow

1. Coach clicks "Enregistrer comme modèle" → modal opens (no API call)
2. Coach enters name, clicks "Enregistrer le modèle"
3. `GET /coach/dashboards/memory` (to fetch existing templates for duplicate check, or use cached)
4. Client-side duplicate check: if `templates.some(t => t.name === inputName)` → error state A4
5. `PUT /coach/dashboards/memory` with `{ templates: [...existing, newTemplate] }`
6. On success: modal closes, "Modèle enregistré" toast
7. On 5xx: error toast "Erreur lors de l'enregistrement. Réessayer ?"

### UI call sequence — TemplatePicker flow

1. `dashboard/page.tsx` mounts → `GET /coach/dashboards/:clientId` (check if new pair)
2. If no stored config → `GET /coach/dashboards/memory` → check `templates.length`
3. If templates exist → render TemplatePicker (skeleton during fetch, B1 state)
4. Coach clicks "Utiliser ce modèle":
   - `PUT /coach/dashboards/:clientId` with `{ widgets: template.widgets }` → persists immediately
   - Dismiss TemplatePicker, show DashboardGrid with applied template widgets
5. Coach clicks "Créer sans modèle": no API call, dismiss TemplatePicker, show DashboardGrid with DEFAULT_WIDGETS

### UI call sequence — Personalized opening message

1. `DashboardEditOverlay` mounts → `GET /coach/dashboards/memory` (or use cached from TemplatePicker fetch)
2. If `memory.preferences` and `memory.recent_actions` exist → build personalized opening message
3. Render as static assistant bubble (no API call to AI — same as Phase 03 pattern)

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| TemplateNamingModal role | `role="dialog" aria-modal="true" aria-labelledby="template-modal-title"` |
| Modal title | `id="template-modal-title"` on the `<h2>` element |
| Modal focus trap | Focus locked inside modal while open; returns to "Enregistrer comme modèle" button on close |
| Input label association | `<label htmlFor="template-name-input">Nom du modèle</label>` |
| Input error association | `aria-describedby="template-name-error"` on input; `id="template-name-error"` on error text; `aria-invalid="true"` when error |
| "Enregistrer le modèle" button loading | `aria-busy="true"` when loading, `aria-disabled="true"` |
| "Enregistrer comme modèle" button | `aria-label="Enregistrer ce dashboard comme modèle réutilisable"` |
| TemplatePicker heading | `<h2>Commencer depuis un modèle</h2>` (landmark) |
| TemplateCard apply button | `aria-label="Utiliser le modèle [template name]"` (unique per card) |
| Skeleton loading region | `role="status" aria-label="Chargement des modèles..."` (wraps skeleton grid) |
| "Créer sans modèle" link | `<button>` element (not `<a>`) — triggers state change, not navigation |
| Min touch/click targets | All buttons: 36px height minimum (same as Phase 03) |
| Escape key closes modal | `onKeyDown` handler on backdrop: `if (e.key === 'Escape') handleCancel()` |

---

## Acceptance Criteria

Verifiable checklist mapped to Phase 04 success criteria from ROADMAP.md.

**MEM-01 — Template save and apply**

- [ ] "Enregistrer comme modèle" button appears in DashboardEditOverlay top bar between "Annuler" and "Sauvegarder"
- [ ] Clicking "Enregistrer comme modèle" opens TemplateNamingModal without triggering a dashboard save
- [ ] Modal input is focused on open
- [ ] "Enregistrer le modèle" button is disabled when name field is empty
- [ ] "Enregistrer le modèle" button is enabled when at least 1 character is entered
- [ ] Submitting with a duplicate name shows error text below input; modal stays open
- [ ] Successful save: modal closes, "Modèle enregistré" toast appears (3s auto-dismiss)
- [ ] Template is persisted in `coach_memory.templates` via `PUT /coach/dashboards/memory`
- [ ] TemplatePicker renders when a coach opens a new athlete's dashboard and at least 1 template exists
- [ ] TemplatePicker does NOT render when no templates exist (fallback to default dashboard)
- [ ] Each TemplateCard shows: name, widget count badge, widget type summary (2 lines max), creation date, "Utiliser ce modèle" button
- [ ] Clicking "Utiliser ce modèle" applies the template widgets and persists via `PUT /coach/dashboards/:clientId`
- [ ] After applying a template, DashboardGrid renders the template widgets (TemplatePicker dismissed)
- [ ] "Créer sans modèle →" link dismisses TemplatePicker and loads DEFAULT_WIDGETS without an API call
- [ ] TemplatePicker loading state: 3 skeleton cards rendered while memory fetch is in flight

**MEM-02 — Preferences persistence and automatic application**

- [ ] When coach_memory has preferences, the EditChatPanel opening message includes personalized content (preferred period, preferred widgets, recent action examples)
- [ ] When coach_memory has no data (first use) or fetch fails, opening message falls back to generic Phase 03 text — no error shown to coach
- [ ] `coach_memory.preferences.preferred_period` is applied as the default period for new widgets added via AI tools
- [ ] After each AI edit session where the coach adds/updates widgets, `coach_memory.preferences` is updated with inferred preferences (preferred widget types from the session)
- [ ] `coach_memory.recent_actions` stores the last 2–3 coach chat messages (for opening message personalization)

**Success Criterion 3 — Blank-slate paralysis eliminated**

- [ ] EditChatPanel opening message always contains at least 3 concrete example actions
- [ ] For returning coaches: examples are drawn from `coach_memory.recent_actions` (recent real actions by this coach)
- [ ] For first-time coaches: examples are the hard-coded Phase 03 defaults
- [ ] Opening message rendering does not require an AI API call — it is assembled client-side from memory data

**Phase 03 regressions (must remain passing)**

- [ ] Phase 03 acceptance criteria all still pass (the overlay, streaming, save/cancel, scope guard)
- [ ] "Enregistrer comme modèle" button does not interfere with "Sauvegarder" — they are independent actions
- [ ] TemplateNamingModal is not shown unless explicitly triggered
- [ ] Adding the new button does not cause top bar overflow on 1280px viewport

---

## Implementation Notes for Executor

### TemplateNamingModal — duplicate name check

Perform the duplicate check client-side using the templates array from the memory cache (TanStack Query), not a server round-trip. The cache is populated by `GET /coach/dashboards/memory` which is already called on page mount.

```typescript
// In TemplateNamingModal.tsx
const { data: memory } = useCoachMemory(); // TanStack Query hook

function handleSave() {
  const isDuplicate = memory?.templates.some(t => t.name === templateName.trim());
  if (isDuplicate) {
    setError('Ce nom est déjà utilisé. Choisissez un nom différent.');
    return;
  }
  // Proceed with PUT
}
```

### useCoachMemory hook (new, shared)

Create `apps/web/src/hooks/useCoachMemory.ts`:

```typescript
export function useCoachMemory() {
  return useQuery({
    queryKey: ['coach-memory'],
    queryFn: () => fetchWithAuth('/coach/dashboards/memory'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    // On 404 (no memory record), return empty defaults — do not throw
    select: (data) => data ?? { preferences: {}, templates: [], recent_actions: [] },
  });
}
```

This hook is used by:
1. `TemplatePicker` — to list saved templates
2. `EditChatPanel` — to personalize opening message
3. `TemplateNamingModal` — to check for duplicate names

### Template ID generation

Generate on the client before the PUT request:

```typescript
const newTemplate = {
  id: crypto.randomUUID(),
  name: templateName.trim(),
  widgets: configRef.current, // current pending widgets
  created_at: new Date().toISOString(),
};
```

### isNewDashboard detection

In `dashboard/page.tsx`:

```typescript
// After fetching the current dashboard config:
const isNewDashboard = !dashboardConfig || dashboardConfig.widgets.length === 0;
```

The TemplatePicker renders when `isNewDashboard === true && (memory?.templates?.length ?? 0) > 0`.

### Route order — /memory before /:clientId (pre-locked decision from STATE.md)

This is already locked as a critical constraint. Confirm in `coach/dashboards/service.ts` that `app.get('/memory', ...)` and `app.put('/memory', ...)` are registered BEFORE `app.get('/:clientId', ...)` and `app.put('/:clientId', ...)`.

### Preferences inference (MEM-02 auto-update)

After a successful edit session save (PUT /coach/dashboards/:clientId), compute updated preferences from `configRef.current` and the conversation messages, then call `PUT /coach/dashboards/memory` with updated preferences:

```typescript
// In dashboard/page.tsx handleSave():
async function handleSave(finalWidgets: Widget[]) {
  // 1. Save dashboard config
  await fetch(`${API_URL}/coach/dashboards/${clientId}`, { method: 'PUT', ... });
  
  // 2. Infer and update preferences (fire-and-forget, non-blocking)
  const preferredTypes = inferPreferredTypes(finalWidgets);
  const recentActions = conversationHistory
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content);
  
  fetch(`${API_URL}/coach/dashboards/memory`, {
    method: 'PUT',
    body: JSON.stringify({
      preferences: { preferred_widgets: preferredTypes },
      recent_actions: recentActions,
    }),
  }).catch(() => {}); // silent fail — preferences are best-effort
}

function inferPreferredTypes(widgets: Widget[]): string[] {
  return [...new Set(widgets.map(w => w.type))];
}
```

### TypeScript GSAP note (from STATE.md)

Use `fromTo` + keyframes instead of `x: []` array to satisfy `TweenValue` type. The `shake` pattern for error states should use:

```typescript
// Shake for TemplateNamingModal input error (if desired)
gsap.fromTo(
  inputRef.current,
  { x: -6 },
  { x: 0, duration: 0.3, ease: 'elastic.out(1, 0.3)', keyframes: [
    { x: -6 }, { x: 6 }, { x: -4 }, { x: 4 }, { x: 0 }
  ]}
);
```

However, for this phase the error state is communicated via text only (no shake), so this pattern is informational only.

### "Enregistrer comme modèle" button — disabled during streaming

```typescript
// In DashboardEditOverlay.tsx top bar:
<button
  onClick={() => setIsTemplateModalOpen(true)}
  disabled={isStreaming || isSaving}
  aria-label="Enregistrer ce dashboard comme modèle réutilisable"
  className={cn(
    'h-9 px-4 text-[14px] font-semibold rounded-md border border-border',
    'flex items-center gap-1.5',
    'transition-colors',
    (isStreaming || isSaving)
      ? 'opacity-40 cursor-not-allowed'
      : 'hover:bg-surface-muted'
  )}
>
  <BookmarkIcon className="w-3.5 h-3.5" />
  Enregistrer comme modèle
</button>
```

---

## Pre-Populated From

| Source | Decisions Used |
|--------|---------------|
| Phase 03 UI-SPEC.md | All design tokens locked (colors, typography, spacing, radius, shadow, button specs, modal patterns, motion contracts, overlay architecture) |
| MOODBOARD.md | Visual direction (warm palette, Inter typography, snappy motion, subtle radius, soft shadows) |
| REQUIREMENTS.md | MEM-01, MEM-02 requirements |
| ROADMAP.md | 3 Phase 04 success criteria |
| STATE.md | Locked decisions: /memory route order, coach_memory in migration 054, credit rate, TypeScript GSAP pattern |
| research/SUMMARY.md | coach_memory JSONB shape (preferences + templates + recent_actions) |
| 03-CONTEXT.md | Stateless request pattern, configRef architecture, GSAP contracts, opening message pattern |
| Codebase reads | Components list (`apps/web/src/components/coach/`), TanStack Query patterns, Hono route patterns |
| User input | 0 (all decisions pre-answered in upstream artifacts) |
