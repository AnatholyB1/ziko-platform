---
name: Ziko
description: Fitness coaching platform — precise tools for coaches, clear progress for athletes.
colors:
  sprint-orange: "#FF5C1A"
  warm-training-ground: "#F7F6F3"
  charcoal-kit: "#1C1A17"
  chalk-line: "#E2E0DA"
  stadium-concrete: "#6B6963"
  alert-red: "#EF4444"
  caution-amber: "#F59E0B"
  low-signal-yellow: "#EAB308"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(3rem, 7vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  pill: "9999px"
  card: "16px"
  control: "12px"
  element: "8px"
spacing:
  tight: "8px"
  base: "16px"
  comfortable: "24px"
  section: "40px"
  page: "96px"
components:
  button-primary:
    backgroundColor: "{colors.sprint-orange}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.sprint-orange}"
    textColor: "#FFFFFF"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.sprint-orange}"
    rounded: "{rounded.control}"
    padding: "10px 24px"
  chip-filter-default:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.stadium-concrete}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  chip-filter-active:
    backgroundColor: "{colors.sprint-orange}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  card-default:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.card}"
    padding: "32px"
  input-default:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.charcoal-kit}"
    rounded: "{rounded.control}"
    padding: "0px 12px"
    height: "44px"
---

# Design System: Ziko

## 1. Overview

**Creative North Star: "The Athletic Clipboard"**

Ziko's visual system is a coach's tool: the kind of interface that earns trust through clarity, not decoration. Every surface is in service of action. Inputs are immediate. Data is legible. Sprint Orange appears when something must be done — and nowhere else. The system does not seek to be admired; it seeks to be used.

The light sport theme is non-negotiable. Coaches use this dashboard at a gym, in daylight, between sets, on a laptop or tablet. The warm off-white background (#F7F6F3) is not default white — it is the colour of a training room wall, slightly lived-in. The near-black (#1C1A17) carries a warm cast so it never feels clinical. Orange lands like a whistle: sharp, purposeful, then gone.

The register is product, not brand. The coach app is a B2B productivity tool; visual exuberance belongs on the marketing page, not in the dashboard. On the dashboard, Sprint Orange does one job: it marks what is active, required, or primary. On the marketing page, it carries identity. Both registers share the same token system; the difference is frequency of use.

**Key Characteristics:**
- Warm off-white canvas, not pure white — the paper has been held
- Sprint Orange at low frequency: active state, primary CTA, alert severity dot
- System-ui typeface: no custom font, maximum legibility, no visual ceremony
- Cards are functional containers, not decorative blocks
- Shadows are responses to state, not ambient decoration
- No dark mode, no gradients, no glassmorphism in product surfaces

## 2. Colors: The Sprint Palette

A Restrained strategy on product surfaces; Committed on marketing. One accent at low frequency is the rule everywhere except the hero section.

### Primary
- **Sprint Orange** (#FF5C1A): The sole active-state colour. Used on primary CTAs, active nav items (`bg-primary/10` tint + `text-primary`), focus rings, badge dots, and the ZIKO wordmark. Never on body text. Never as a background fill except on primary buttons. Its scarcity is the point.

### Neutral
- **Warm Training Ground** (#F7F6F3): The page canvas. Not white. The warm cast (slightly ochre) prevents the clinical read of pure white. Used as the page background and as a secondary surface inside cards (table rows, input backgrounds in the chat area).
- **Charcoal Kit** (#1C1A17): Primary text. Near-black with a warm undertone — never pure black. Headings, labels, table cell content.
- **Chalk Line** (#E2E0DA): Borders and dividers. The line between things — table rows, card edges, input strokes. Present but quiet.
- **Stadium Concrete** (#6B6963): Muted text. Secondary labels, timestamps, placeholder values, disabled state copy. Warm mid-grey.

### Severity (data-status only)
- **Alert Red** (#EF4444): High-severity coach alerts. Never used for decoration.
- **Caution Amber** (#F59E0B): Medium-severity alerts.
- **Low Signal Yellow** (#EAB308): Low-severity alerts.

### Named Rules
**The One Voice Rule.** Sprint Orange is the only accent. It speaks once per screen — on the active nav item, the primary CTA, or the severity indicator. The moment it appears in two unrelated places on the same surface, its authority diminishes. Audit every new screen: if orange appears more than once without a direct semantic reason, remove all but one instance.

**The Warm Tint Rule.** No pure whites or pure blacks anywhere. Every neutral must carry the brand's ochre warmth, even at trace levels. `#FFFFFF` and `#000000` are forbidden. The warmest surfaces (#F7F6F3) and darkest text (#1C1A17) define the range.

## 3. Typography

**Display / Body Font:** system-ui, -apple-system, 'Segoe UI', sans-serif (no custom typeface loaded)

**Character:** The system uses the native OS font stack deliberately. There is no web font ceremony — no FOUT, no layout shift, no brand-font licensing overhead. What the system lacks in typographic personality, it compensates with weight contrast: 900 for display and section headings, 700 for titles, 400 for body. The scale ratio between heading steps is 1.25 or greater.

### Hierarchy
- **Display** (weight 900, `clamp(3rem, 7vw, 4.5rem)`, line-height 1, tracking -0.02em): Marketing hero headlines only. Three lines, staggered entry animation.
- **Headline** (weight 900, `clamp(1.875rem, 4vw, 2.25rem)`, line-height 1.15, tracking -0.01em): Section headings on the marketing page. Page-level headings in the coach app (`<h1>` on Dashboard, Clients, etc.).
- **Title** (weight 700, 1.25rem / 20px, line-height 1.3): Card headings, modal titles, dialog headings, the "IA Coach" header in the chat view.
- **Body** (weight 400, 0.875rem / 14px, line-height 1.6): All running text in the coach app — client names, alert summaries, program descriptions. Line length capped at 65–75ch where prose appears.
- **Label** (weight 700, 0.75rem / 12px, tracking 0.05em, uppercase): Table column headers (`text-xs font-bold tracking-wide uppercase`). The uppercase + letter-spacing combination is exclusively for table headers — not decorative labels or card metadata.

### Named Rules
**The Weight Ceiling Rule.** `font-black` (weight 900) is reserved for display and headline roles only. Using it on body copy, buttons, or UI chrome creates visual noise. Buttons are `font-bold` (700). Nav items are `font-normal` (400) at rest, `font-bold` when active. Everything else is 400 or 700, never 900.

**The Scale Gap Rule.** Adjacent type roles must differ by at least 1.25× in size. A `text-sm` body (14px) next to a `text-lg` title (18px) is a 1.28× ratio — acceptable. A `text-sm` (14px) next to a `text-base` (16px) is a 1.14× ratio — too flat; one role must step up.

## 4. Elevation

The system is **flat by default; shadow as state response**. Surfaces do not carry ambient shadows. Depth is established through colour layering: the page is Warm Training Ground (#F7F6F3), cards sit on it in pure white (#FFFFFF), table header rows drop back to the Training Ground tint inside a white card. This tonal stepping replaces shadow for structural hierarchy.

Shadows appear only as state responses:

### Shadow Vocabulary
- **Resting card** (`box-shadow: none`): The default. Cards are defined by their border (`1px solid #E2E0DA`), not their shadow.
- **Ambient low** (`box-shadow: 0 1px 3px rgba(0,0,0,0.06)`): Equivalent to Tailwind `shadow-sm`. Informational cards (WelcomeCard) that need to read as "lifted" without interactive affordance.
- **Interactive hover** (`box-shadow: 0 4px 12px rgba(0,0,0,0.10)`): Equivalent to `shadow-md`. ProgramCard on hover — signals the card is clickable.
- **Dropdown / context menu** (`box-shadow: 0 8px 24px rgba(0,0,0,0.12)`): Equivalent to `shadow-lg`. Context menus, dropdowns. Always above all other surfaces.
- **Sprint Orange glow** (`box-shadow: 0 4px 20px rgba(255,92,26,0.30)`): Primary CTA buttons only. The orange shadow reinforces the colour identity at the most important interaction point. Never on cards, never on nav items.
- **Accent card glow** (`box-shadow: 0 8px 48px rgba(255,92,26,0.12)`): Pricing/featured card on the marketing page. The diluted orange glow frames the single most important card without competing with the CTA.

### Named Rules
**The Flat-First Rule.** Every new component starts with no shadow. A shadow is added only after a specific state requires it (hover, overlay, featured). Never add a shadow "to make it feel like a card" — the border does that job.

## 5. Components

### Buttons
Solid, unambiguous. No gradient fills, no letter-spacing on button copy (that is reserved for table labels), no emoji.

- **Shape:** Gently rounded (12px radius, `rounded-xl`). Not pill-shaped; not sharp.
- **Primary** (`bg-primary text-white font-bold`, px-6 py-3, `rounded-xl`): Orange background, white copy, `font-bold`. On hover: `opacity-90` transition + Sprint Orange glow shadow (`0 4px 20px rgba(255,92,26,0.30)`). The only button that carries a shadow. On `:focus-visible`: 2px orange outline, 2px offset.
- **Ghost** (`border-2 border-primary text-primary font-bold`, `rounded-xl`): No fill at rest. On hover: fills to `bg-primary text-white`. Used as secondary CTA alongside a primary button.
- **Text / link** (`text-primary hover:underline`): Inline actions only. No padding, no background.
- **Disabled:** `opacity-50 cursor-not-allowed`. Applied to any variant. No colour change, only opacity.

### Chips / Filter Pills
Used for signal filters in the Clients table and for category tags.

- **Default:** White background, Chalk Line border (1px), Stadium Concrete text, pill radius. `border border-border bg-white text-muted`
- **Active:** Sprint Orange tint fill (`bg-primary/10`), Sprint Orange border (`border-primary`), Sprint Orange text (`text-primary font-bold`).
- **Marketing badge:** Filled Sprint Orange pill (`bg-primary text-white font-bold px-4 py-1.5 rounded-full`). Used once per section as a label ("Bientôt disponible", etc.).

### Cards / Containers
Cards are containers for data, not decorative blocks.

- **Corner style:** Gently rounded (16px, `rounded-2xl`).
- **Background:** White (#FFFFFF) on the Training Ground page canvas.
- **Shadow:** None at rest. `shadow-sm` on static informational cards (WelcomeCard). `hover:shadow-md` on clickable cards (ProgramCard).
- **Border:** 1px solid Chalk Line (`border border-border`) on all cards. The border is the definition of the card, not the shadow.
- **Internal padding:** `p-8` (32px) for content panels and dashboard cards. `p-4` (16px) for compact list items and program cards.
- **Nested cards are forbidden.** A card inside a card is always wrong. Use table rows, list items, or tonal background shifts instead.

### Inputs / Fields
- **Style:** White background, 1px Chalk Line border, 12px radius (`rounded-xl`), 44px height (touch-safe). `h-11 bg-white border border-border rounded-xl px-3`
- **Focus:** 2px Sprint Orange ring, no outline offset. `focus:ring-2 focus:ring-primary focus:outline-none`
- **Error:** Border shifts to Alert Red (`border-red-400`). An error message in Alert Red text appears immediately below — never inside the field.
- **Disabled:** `opacity-50 cursor-not-allowed`. Background stays white, not grey.
- **Label pattern:** Always `<label htmlFor="...">` linked to `<input id="...">`. Labels above inputs, `font-bold text-sm text-text`. Placeholder text is muted (`placeholder:text-muted`), never used as a substitute for a label.

### Navigation
- **Sidebar (desktop, lg+):** 240px wide, white background, 1px right border. Logo at top (ZIKO wordmark, `text-3xl font-bold text-primary`). Nav items are 44px tall, 12px gap between icon and label, 8px corner radius.
- **Nav item states:** Default: `text-text font-normal`. Active: `bg-primary/10 text-primary font-bold`. Hover (inactive): `bg-background transition-colors`. Disabled: `text-muted cursor-default` with "Bientôt" badge.
- **Focus ring:** `focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2` on all nav links.
- **Mobile bottom nav (below lg):** Fixed 64px bar, white background, top border. Five core destinations: Dashboard, Clients, Programmes, IA, Réglages. Icon 22px, label 10px below. Active state: `text-primary`. Inactive: `text-muted`.

### Alert Cards (Signature Component)
Coach alert cards surface athlete risk signals. They are the primary reason a coach opens the dashboard.

- **Container:** `border border-border rounded-lg p-4`, no shadow, no coloured left stripe (forbidden). White background.
- **Severity indicator:** An 8px circle (not a stripe) in the top-left of the header row. Colour: Alert Red (high), Caution Amber (medium), Low Signal Yellow (low). `bg-danger` / `bg-warning` / `bg-caution` from design tokens.
- **Dismiss animation:** `scaleY(0)` with `transformOrigin: top` — GPU-composited. No `height` animation.
- **Layout:** Header row (severity dot, client name, type label, timestamp). Summary line (line-clamped to 2). Footer row (open chat link, mark-read button).

### Chat Interface (Signature Component)
The AI Coach chat is the primary AI surface in the product. It behaves like a chat, not a form.

- **Message area:** Scrollable, `bg-background`, no border, no card wrapping individual messages.
- **Input bar:** Fixed bottom, white background, top border. Textarea is `bg-background border-border`, grows to `max-h-[120px]`. Send button is `bg-primary` square icon button (10px radius). Full-width on mobile, offset 240px (sidebar width) on `lg+`.
- **Suggestion chips:** Bordered, white fill, Training Ground hover — the same chip style as filter pills, default state only. They are removed once the conversation starts.
- **Streaming cursor:** A blinking `|` in Sprint Orange, positioned after the last streamed character.
- **Error state:** `bg-red-50 border border-red-200 rounded-lg` inline — not a modal, not a toast. "Réessayer" link in `text-primary`.

## 6. Do's and Don'ts

### Do:
- **Do** use Sprint Orange for exactly one semantic purpose per screen surface: the active nav item, the primary CTA, or the severity indicator. Not two.
- **Do** establish depth through tonal layering: page at #F7F6F3, cards at #FFFFFF, table headers back to #F7F6F3. Shadows only on state change.
- **Do** give every interactive element a `focus-visible:outline` in Sprint Orange. Keyboard users are coaches too.
- **Do** make the near-black (#1C1A17) and the white (#FFFFFF) always warm-tinted. Run the contrast check but also the warmth check.
- **Do** use `font-black` (900) only on display headlines and section headings. Everything else is 700 or 400.
- **Do** cap body prose at 65–75ch to prevent line-length fatigue on wide viewports.
- **Do** add `pb-16` to main content on mobile so the bottom nav never clips content.
- **Do** show empty states with a clear action. Every empty screen points somewhere.

### Don't:
- **Don't** use a dark sidebar or a blue accent. The "generic SaaS dashboard" look (dark rail, blue primary, card grids) is the explicit anti-reference. If the dashboard could pass for any B2B tool, it has failed.
- **Don't** target the "consumer social app" aesthetic: rounded-everything, pastel gradients, playful motion. This is a professional tool. A coach with 30 athletes has no patience for softness.
- **Don't** use a coloured `border-left` stripe on any card, list item, or alert. This is forbidden in the system. Severity is expressed with a dot, not a stripe.
- **Don't** use gradient text (`background-clip: text`). Never. Emphasis is weight and size.
- **Don't** use glassmorphism (`backdrop-blur` + semi-transparent fill) outside the sticky marketing header, where it is purposeful and scroll-triggered. Never on dashboard surfaces.
- **Don't** build identical card grids: same card, same size, same structure, repeated. Vary visual weight between cards or switch to a table/list.
- **Don't** animate CSS layout properties (`height`, `margin`, `padding`, `top`, `left`). All transitions use `transform` and `opacity`. The AlertCard dismiss is `scaleY`, not `height: 0`.
- **Don't** hardcode `left: 240px` or any sidebar pixel value in component CSS. Use `lg:left-60` (Tailwind) so the layout responds to breakpoints.
- **Don't** use `#000` or `#fff`. The warmth rule is non-negotiable. Charcoal Kit (#1C1A17) is the floor; Warm Training Ground (#F7F6F3) is the ceiling for backgrounds.
- **Don't** add a custom typeface without a deliberate reason. The native system font stack is a feature: instant load, zero layout shift, maximum OS legibility. A web font must justify itself against that baseline.
