---
phase: 46
slug: web-player-text-annotations
status: approved
reviewed_at: 2026-05-27
shadcn_initialized: false
preset: none
figma_file_url: "none"
moodboard_path: .planning/MOODBOARD.md
created: 2026-05-27
---

# Phase 46 — UI Design Contract: Web Player & Text Annotations

> Visual and interaction contract for frontend Phase 46.
> Figma not available in this runtime — written contract is the sole source of truth.
> All design decisions reference `.planning/MOODBOARD.md` (created 2026-05-21).

---

## Figma Designs

Figma file not available in this runtime environment.

| Asset | URL |
|-------|-----|
| Figma File | none |
| Design System Page | none |

### Screen Designs

| Screen | States Covered | Figma Frame |
|--------|----------------|-------------|
| VideoListPage (web) | empty / loading / populated / error | none |
| VideoPlayerPage (web) | loading / populated / error | none |
| VideoPlayerScreen (mobile) | loading / populated / annotation selected | none |

> **Executors:** This written contract is the pixel-level reference. Follow every layout, spacing, copy, and color spec exactly. No creative deviation without an explicit override decision.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | manual — Tailwind v4 utility classes (web), inline style objects (mobile) |
| Figma Library | none |
| Preset | not applicable |
| Component library | none (no shadcn/radix) |
| Icon library | Lucide React (web) · Ionicons from @expo/vector-icons (mobile) |
| Font | Inter — system fallback: -apple-system, BlinkMacSystemFont, "Segoe UI" |
| Mood board | `.planning/MOODBOARD.md` |

---

## Spacing Scale

All values are multiples of 4. These are the tokens used in this phase.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline spacing between annotation dot and tooltip edge |
| sm | 8px | Padding inside chips, badge text padding, list item vertical padding |
| md | 16px | Default section padding, panel horizontal padding, card padding |
| lg | 24px | Gap between player and annotation panel, section vertical spacing |
| xl | 32px | Page top padding, major content gaps |
| 2xl | 48px | Empty state vertical centering offset |
| 3xl | 64px | Full-page section breaks (not used in this phase) |

Exceptions:
- Annotation dot: 12px diameter (w-3 h-3), 3px border — chosen to be visually prominent on the scrub bar without obscuring the track
- Touch targets on mobile annotation dots: minimum 44px × 44px hit area wrapping a 10px visual dot
- Tab bar clearance (mobile): paddingBottom 100 (established platform rule)

---

## Typography

All sizes from MOODBOARD.md typography scale. Consolidated to 4 sizes and 2 weights for this phase.

| Role | Size | Weight | Line Height | Usage in Phase 46 |
|------|------|--------|-------------|-------------------|
| H1 | 22px | 600 | 1.3 | VideoListPage page title "Vidéos", VideoPlayerPage page title |
| H2 | 18px | 600 | 1.35 | Annotation panel heading "Annotations", empty state heading, section headings |
| Body | 14px | 400 | 1.5 | Video list item date, annotation text content in list and composer, status badge text, button labels, helper text, timestamp chips in composer, back link text, error body text |
| Caption | 12px | 400 | 1.4 | Timestamps in annotation list items (MM:SS), video duration, upload date, video count subtitle, char counter, delete inline confirm text |

**Size mapping from previous draft:**
- Display 28px → not used (removed)
- H3 15px → 14px (Body)
- Body Large 16px → 14px (Body)
- Label 13px → 12px (Caption)
- Weight 500 → 400 (regular)
- Weight 700 → 600 (semibold)

---

## Color

All values from MOODBOARD.md visual palette and CLAUDE.md design tokens.

**Distribution: 60% background (#F7F6F3) / 30% surface (#FFFFFF) / 10% accent (#FF5C1A)**

| Role | Hex | Usage in Phase 46 |
|------|-----|--------------------|
| Background (60%) | `#F7F6F3` | Page canvas, VideoListPage background |
| Surface (30%) | `#FFFFFF` | Annotation panel, video list card, video player container, mobile annotation card |
| Surface Muted | `#F0EFE9` | Skeleton fill color, textarea background in composer, annotation list item hover |
| Border | `#E2E0DA` | Panel border, list item dividers, composer textarea border, scrub bar track color |
| Primary / Accent (10%) | `#FF5C1A` | Annotation dots on timeline (web + mobile), active timestamp chip, "Annoter à ce moment" button border, "Envoyer le retour" button fill, scrub bar fill progress, active panel send button |
| Text Primary | `#1C1A17` | All headings, annotation text body, video title |
| Text Muted | `#6B6963` | Timestamps in list items, upload date, helper text, placeholder in textarea, "Envoyer le retour" disabled label |
| Text Inverse | `#FFFFFF` | Text on primary (orange) buttons |
| Success | `#22C55E` | `ready` status badge background (10% opacity) + text — video ready to annotate |
| Warning | `#F59E0B` | `uploading` status badge — video still uploading |
| Destructive | `#EF4444` | Delete annotation confirmation, error toast |

**Accent reserved for:**
- Annotation dot markers on the scrub bar (web: orange `#FF5C1A` 12px dots; mobile: orange 10px dots)
- "Annoter à ce moment" button (outline variant: orange border + orange text when active)
- "Envoyer le retour" primary CTA button (filled orange)
- Scrub bar fill (played progress bar)
- Timestamp chip in composer (border and text color when capturing)
- Active annotation item left border accent strip (4px left border, color `#FF5C1A`)

**Status badge palette:**
- `uploading` → amber background `#FEF3C7`, text `#92400E`, icon `clock` (Lucide)
- `ready` → green background `#DCFCE7`, text `#166534`, icon `check-circle` (Lucide)
- `annotated` → orange background `#FFF0E8`, text `#C2410C`, icon `message-square` (Lucide)

---

## Screen Specifications

---

### Screen 1 — VideoListPage (Web)

**Route:** `/coach/clients/[id]/videos`
**File:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/page.tsx`
**Client component:** `apps/web/src/components/coach/videos/VideoListClient.tsx`
**Layout constraints:** ClientTabStrip visible above. Notes panel hidden (detected via pathname in `ClientNotesPanelConditional`). Full content area width.

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│  ClientTabStrip (existing, "Vidéos" tab active)          │
├─────────────────────────────────────────────────────────┤
│  px-6 pt-6 pb-6                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  H1: "Vidéos de [Client Name]"   22px/600         │   │
│  │  Caption: "[N] vidéo(s)"   12px/400 text-muted    │   │
│  └───────────────────────────────────────────────────┘   │
│  mt-6                                                     │
│  ┌─ Video List Card ────────────────────────────────┐    │
│  │  [list items — see below]                         │    │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### Video List Card

Container: `bg-white rounded-lg border border-[#E2E0DA] shadow-sm overflow-hidden`

Each list item (row):
```
┌─────────────────────────────────────────────────────────┐
│  px-4 py-3   flex items-center gap-4   min-h-[56px]     │
│                                                           │
│  [Video Icon]   [Title + Date]           [Status Badge]  │
│  24×24px        flex-1                   flex-shrink-0   │
│  film icon      Body: title 14px/600                     │
│  text-muted     Caption: date 12px/400 text-muted        │
│                                                           │
│  [Chevron right 16px text-muted]  (when status=annotated │
│   or ready — navigable)                                  │
└─────────────────────────────────────────────────────────┘
```

Row separators: `border-b border-[#E2E0DA]` on all but last.

Row click behavior:
- `ready` → navigates to `/videos/[videoId]`
- `annotated` → navigates to `/videos/[videoId]`
- `uploading` → not clickable; cursor-default; no chevron

Hover state (clickable rows): `hover:bg-[#F0EFE9] transition-colors duration-100`

#### State: Loading

Render 3 skeleton rows. Each row:
- Video icon placeholder: `w-6 h-6 rounded bg-[#E2E0DA] animate-pulse`
- Title line: `w-48 h-[14px] rounded bg-[#E2E0DA] animate-pulse`
- Date line: `w-24 h-[12px] rounded bg-[#E2E0DA] animate-pulse mt-1`
- Badge placeholder: `w-20 h-6 rounded bg-[#E2E0DA] animate-pulse`

No skeleton should use orange (`#FF5C1A`). Skeleton fill is always `#E2E0DA` (anti-pattern rule from MOODBOARD.md).

#### State: Empty

```
┌─────────────────────────────────────────────────────────┐
│  py-16 flex flex-col items-center gap-3 text-center     │
│                                                           │
│  [video icon 40×40px text-muted opacity-40]              │
│                                                           │
│  H2: "Aucune vidéo pour l'instant"                       │
│  18px/600 text-[#1C1A17]                                 │
│                                                           │
│  Body: "L'athlète peut envoyer ses vidéos depuis        │
│  l'application mobile — elles apparaîtront ici."        │
│  14px/400 text-muted max-w-[320px]                       │
└─────────────────────────────────────────────────────────┘
```

#### State: Error

```
┌─────────────────────────────────────────────────────────┐
│  py-8 px-6 text-center                                   │
│                                                           │
│  [alert-circle icon 24px text-[#EF4444]]                 │
│  mt-3: "Impossible de charger les vidéos"  14px/600      │
│  mt-1: "Vérifiez votre connexion et réessayez."          │
│  12px/400 text-muted                                     │
│  mt-4: [Réessayer button — outline sm]                   │
└─────────────────────────────────────────────────────────┘
```

---

### Screen 2 — VideoPlayerPage (Web)

**Route:** `/coach/clients/[id]/videos/[videoId]`
**File:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/videos/[videoId]/page.tsx`
**Client component:** `apps/web/src/components/coach/videos/VideoPlayerClient.tsx`
**Layout constraints:** ClientTabStrip visible (Vidéos tab highlighted via `pathname.includes('/videos')`). Notes panel HIDDEN. Full content width available for 2/3 / 1/3 split.

#### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  ClientTabStrip (Vidéos tab active)                      │
├─────────────────────────────────────────────────────────┤
│  px-6 pt-6 pb-6                                          │
│                                                           │
│  ← Retour aux vidéos   [BackLink — 12px/400 text-muted] │
│  mt-2                                                     │
│  H1: "[Video Title]"  22px/600                           │
│  Caption: "[date] · [duration MM:SS]"  12px/400 muted    │
│                                                           │
│  mt-6                                                     │
│  ┌────────────────────────────┐  ┌──────────────────┐   │
│  │  VideoPlayer (flex-[2])    │  │ AnnotationPanel  │   │
│  │  2/3 of available width    │  │ (flex-1 max-w-sm)│   │
│  │                            │  │ 1/3 of width     │   │
│  └────────────────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

Container class: `flex gap-6 items-start`

Both columns use `min-w-0` to prevent flex overflow. The annotation panel has `max-w-sm` (384px) and `min-w-[280px]`.

#### Back Navigation

`← Retour aux vidéos` link:
- Lucide `arrow-left` icon 14px inline
- Text: 12px/400 `text-[#6B6963]`
- `hover:text-[#1C1A17] transition-colors duration-100`
- `href`: `/coach/clients/[id]/videos`

---

### Component 2a — VideoPlayer

**File:** `apps/web/src/components/coach/videos/VideoPlayer.tsx`
**Must be 'use client'.** Wraps `@vidstack/react@next` (1.15.1).

#### VideoPlayer Component Structure

```
<MediaPlayer src={signedUrl} className="w-full rounded-lg overflow-hidden">
  <div className="relative">
    <MediaProvider className="aspect-video w-full bg-black" />
    <DefaultVideoLayout icons={defaultLayoutIcons} />
    <AnnotatedTimeSlider annotations={annotations} />
  </div>
</MediaPlayer>
```

Note from RESEARCH.md (Risk 2): `AnnotationPanel` must be inside `<MediaPlayer>` tree to access `useMediaRemote`. Wrap player + panel together in a shared `<MediaPlayer>` root in `VideoPlayerClient.tsx`. The `DefaultVideoLayout` and `AnnotatedTimeSlider` are children of `MediaPlayer`.

Player container:
- `bg-black rounded-lg overflow-hidden shadow-md`
- Aspect ratio: 16/9 via `aspect-video` class on `MediaProvider`
- Vidstack default theme CSS imported in globals.css

#### CSS imports (globals.css additions):

```css
@import '@vidstack/react/player/styles/default/theme.css';
@import '@vidstack/react/player/styles/default/layouts/video.css';
@plugin '@vidstack/react/tailwind.cjs';
```

#### AnnotatedTimeSlider Component

**File:** `apps/web/src/components/coach/videos/AnnotatedTimeSlider.tsx`

Wraps the Vidstack `TimeSlider` in a `relative` container and absolutely positions orange dot overlays.

```
<div className="relative w-full" data-testid="annotated-slider">
  <TimeSlider.Root className="group flex items-center w-full h-5 cursor-pointer">
    <TimeSlider.Track className="relative z-0 h-[3px] w-full bg-[#E2E0DA] rounded-full">
      <TimeSlider.TrackFill className="absolute h-full bg-[#FF5C1A] rounded-full" />
      <TimeSlider.Progress className="absolute h-full bg-[#E2E0DA] opacity-50 rounded-full" />
    </TimeSlider.Track>
    <TimeSlider.Thumb className="absolute w-4 h-4 rounded-full bg-[#FF5C1A] border-2 border-white
                                 shadow opacity-0 group-hocus:opacity-100 transition-opacity" />
    <TimeSlider.Preview className="flex flex-col items-center gap-1">
      <TimeSlider.Value className="rounded bg-[#1C1A17] text-white text-xs px-1.5 py-0.5" />
    </TimeSlider.Preview>
  </TimeSlider.Root>

  {/* Annotation dots overlay — gated on duration > 0 */}
  {duration > 0 && annotations.map((a) => (
    <AnnotationDot key={a.id} annotation={a} duration={duration} onSeek={remote.seek} />
  ))}
</div>
```

#### Annotation Dot Spec (Web)

Visual dot:
- Diameter: 12px (w-3 h-3)
- Shape: `rounded-full`
- Fill: `#FF5C1A`
- Border: `2px solid #FFFFFF`
- Shadow: `0 1px 3px rgba(28,26,23,0.20)`
- Z-index: `z-10` (above TimeSlider.Track, below Vidstack controls overlay)

Positioning formula:
```
left: `${(annotation.timestamp_s / duration) * 100}%`
top: `50%`
transform: `translate(-50%, -50%)`
```

Interactive behavior:
- On hover: `scale(1.4)` via `hover:scale-[1.4] transition-transform duration-100`
- Cursor: pointer
- On click: `remote.seek(annotation.timestamp_s)` + scroll annotation panel to that item

Tooltip:
- HTML `title` attribute for basic tooltip (Phase 46 scope)
- Content: first 60 characters of annotation text + `...` if longer
- Format: `[MM:SS] — [text preview]`

Tooltip example: `title="01:23 — Très bien la descente, mais garde le dos droit..."`

Duration gate: Do NOT render dots until `useMediaState('duration')` returns a value `> 0`. Gate with `{duration > 0 && ...}`.

#### Player State: Loading (Signed URL Pending)

While signed URL is being fetched server-side (page is a server component, URL is obtained before render):
- Display: skeleton player area `aspect-video bg-[#E2E0DA] animate-pulse rounded-lg`
- Duration: resolves quickly (SSR fetch); client hydrates with real player

If signed URL fetch fails (non-200 from Hono):
- Show error state in player area:
  ```
  bg-[#F7F6F3] border border-[#E2E0DA] rounded-lg aspect-video
  flex flex-col items-center justify-center gap-2
  ```
  - Icon: `video-off` (Lucide) 32px `text-[#6B6963]`
  - Text: "Impossible de charger la vidéo" 14px/600
  - Subtext: "L'URL a peut-être expiré. Rechargez la page." 12px/400 muted

---

### Component 2b — AnnotationPanel

**File:** `apps/web/src/components/coach/videos/AnnotationPanel.tsx`
**Must be 'use client'.** Uses `useReducer` state machine pattern (identical to `VocalRetourPanel.tsx`).
**Must be inside `<MediaPlayer>` tree** to access `useMediaRemote()`.

#### Panel Container

```
bg-white rounded-lg border border-[#E2E0DA] shadow-sm
flex flex-col
h-[calc(100vh-220px)]   ← fills available height minus header + tab bar
min-h-[400px]
overflow-hidden
```

Panel is sticky on scroll: `sticky top-6` within the flex parent.

GSAP entrance: replicates VocalRetourPanel pattern exactly:
```js
gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
```

#### Panel Header (all states)

```
px-4 py-3 border-b border-[#E2E0DA] flex items-center justify-between flex-shrink-0
```
- Left: H2 "Annotations" 18px/600 `text-[#1C1A17]`
- Right (when annotations exist): count badge `bg-[#F0EFE9] text-[#C2410C] text-xs font-medium px-2 py-0.5 rounded`
  - Text: `[N]` (number of annotations)

---

#### AnnotationPanel State: `list`

```
┌─ Panel ──────────────────────────────────────────┐
│  Header: "Annotations"  [N] badge                │
├──────────────────────────────────────────────────┤
│  Scrollable list (flex-1 overflow-y-auto)         │
│                                                   │
│  [annotation items — sorted by timestamp_s asc]  │
│                                                   │
│  Each item: see Annotation List Item spec below  │
├──────────────────────────────────────────────────┤
│  Footer (flex-shrink-0) px-4 py-3                │
│  border-t border-[#E2E0DA]                        │
│                                                   │
│  [Annoter à ce moment]  ←  primary outline btn   │
│  [Envoyer le retour]    ←  filled orange btn      │
│                            (only when ≥1 annot.)  │
└──────────────────────────────────────────────────┘
```

Footer layout: `flex flex-col gap-2`

"Annoter à ce moment" button:
- Variant: outline
- Class: `w-full border border-[#FF5C1A] text-[#FF5C1A] bg-white text-sm font-medium py-2 rounded-md`
- Hover: `hover:bg-[#FFF0E8] transition-colors duration-100`
- Disabled state (video is playing — not paused): `opacity-40 cursor-not-allowed border-[#E2E0DA] text-[#6B6963]`
- Disabled text: same "Annoter à ce moment" + tooltip "Mettez la vidéo en pause d'abord" (HTML title attribute)
- Icon: `plus` (Lucide) 14px inline-left
- Disabled detection: `const paused = useMediaState('paused')` → button enabled only when `paused === true`

"Envoyer le retour" button:
- Variant: filled
- Class: `w-full bg-[#FF5C1A] text-white text-sm font-medium py-2 rounded-md`
- Hover: `hover:bg-[#E04E14] transition-colors duration-100`
- Visibility: `annotations.length >= 1` — hidden (`hidden`) when no annotations
- Icon: `send` (Lucide) 14px inline-left
- Loading state (sending): spinner replaces icon, text "Envoi en cours..."

#### Annotation List Item

```
px-4 py-3 border-b border-[#E2E0DA] last:border-0
flex items-start gap-3
cursor-pointer
hover:bg-[#F0EFE9] transition-colors duration-100
relative
```

Left accent strip (active item only): `absolute left-0 top-0 bottom-0 w-1 bg-[#FF5C1A] rounded-r`

Structure:
```
┌─────────────────────────────────────────────────────┐
│  [timestamp chip]  [annotation text]  [actions]     │
│                                                      │
│  chip:             flex-1             flex-shrink-0  │
│  MM:SS chip        14px/400           edit + delete  │
│  12px caption      text-[#1C1A17]     icons 14px     │
│  bg-[#FFF0E8]      leading-1.5        text-muted     │
│  text-[#C2410C]                       hover:text-    │
│  px-1.5 py-0.5                        [#1C1A17]      │
│  rounded font-mono                                    │
└─────────────────────────────────────────────────────┘
```

Timestamp chip:
- Font: monospace `font-mono` for fixed-width alignment
- Color: `bg-[#FFF0E8] text-[#C2410C]`
- Size: 12px / caption weight 400
- Format: `MM:SS` (zero-padded, e.g. `01:23`)
- `flex-shrink-0`

Annotation text:
- 14px/400 `text-[#1C1A17]`
- `line-clamp-3 overflow-hidden` — show max 3 lines; full text on expand (Phase 46: no expand interaction)
- `flex-1`

Action icons (visible on row hover via group-hover):
- `pencil` icon: `w-4 h-4` → triggers compose view pre-filled with existing content
  - `aria-label="Modifier l'annotation"`
- `trash-2` icon: `w-4 h-4 text-[#EF4444]` → shows inline delete confirmation
  - `aria-label="Supprimer l'annotation"`
- Both icons: `opacity-0 group-hover:opacity-100 transition-opacity duration-100`
- Wrapper: `flex items-center gap-1 flex-shrink-0`

Click on row (not on icons): `remote.seek(annotation.timestamp_s)` + activate left accent strip

Delete confirmation (inline, replaces action buttons):
```
[Supprimer ?]  [Annuler]
12px text-[#EF4444]  12px text-muted
```
No modal, no confirm dialog — inline confirmation in the row.

#### AnnotationPanel State: `composing`

Replaces list view entirely. Compositor appears with slide-in animation.

```
┌─ Panel ──────────────────────────────────────────┐
│  Header: "Nouvelle annotation"  ← H2 18px/600    │
│  (note: header title changes)                    │
├──────────────────────────────────────────────────┤
│  flex-1 overflow-y-auto px-4 py-4               │
│                                                   │
│  Timestamp chip (read-only):                     │
│  Label: "Moment" 12px/400 text-muted             │
│  Chip: [MM:SS] → bg-[#FFF0E8] text-[#C2410C]   │
│  border border-[#FF5C1A] rounded px-2 py-1       │
│  font-mono 12px/400                              │
│                                                   │
│  mt-4                                            │
│  Textarea:                                       │
│  Label: "Commentaire" 12px/400 text-muted mb-1  │
│  rows=6, max 2000 chars                          │
│  bg-[#F0EFE9] border border-[#E2E0DA]            │
│  rounded-md px-3 py-2 text-[14px]               │
│  placeholder: "Décrivez ce que vous observez..." │
│  focus: border-[#FF5C1A] outline-none            │
│  resize-none w-full                              │
│                                                   │
│  mt-2 text-right: char counter                   │
│  [N]/2000  12px/400 text-muted                  │
├──────────────────────────────────────────────────┤
│  Footer px-4 py-3 border-t                       │
│  flex gap-2                                      │
│                                                   │
│  [Annuler]        [Enregistrer]                  │
│  w-1/2 outline   w-1/2 filled orange             │
│  text-sm          text-sm                        │
│                   disabled when textarea empty   │
└──────────────────────────────────────────────────┘
```

"Enregistrer" button:
- Disabled when textarea is empty or whitespace-only
- Loading state (saving): spinner, text "Enregistrement..."
- On success: panel transitions back to `list` state with new item staggered in

"Annuler" button:
- `border border-[#E2E0DA] text-[#6B6963] bg-white`
- On click: transition back to `list` state, no save

#### AnnotationPanel State: `sending`

"Envoyer le retour" button in loading state:
- Class unchanged (orange fill), but icon replaced by spinner:
  ```
  animate-spin text-white w-4 h-4
  ```
- Text: "Envoi en cours..."
- `pointer-events-none opacity-80`

List and "Annoter" button remain visible but are `pointer-events-none opacity-50` during send.

#### AnnotationPanel State: `sent`

"Envoyer le retour" button replaced by permanent confirmation:
```
w-full flex items-center justify-center gap-2 py-2
bg-[#DCFCE7] text-[#166534] rounded-md text-sm font-medium cursor-not-allowed
```
- Icon: `check-circle` (Lucide) 14px
- Text: "Retour envoyé"
- `pointer-events-none` — no resend in Phase 46

"Annoter à ce moment" remains visible and functional — coach can still add annotations after sending (annotations are saved immediately; the send action only triggers the push notification + status update once).

#### AnnotationPanel State: Empty List

When `annotations.length === 0` and state is `list`:
```
flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8
```
- Icon: `message-square` (Lucide) 32px `text-[#E2E0DA]`
- Text: "Aucune annotation" 14px/600 `text-[#1C1A17]`
- Subtext: "Mettez la vidéo en pause, puis cliquez sur 'Annoter à ce moment' pour ajouter votre premier commentaire." 12px/400 muted `text-center`

"Envoyer le retour" is hidden in empty state.

---

### Screen 3 — VideoPlayerScreen (Mobile)

**Platform:** React Native + Expo SDK 54
**File:** `apps/mobile/app/(app)/(plugins)/coach/video-player.tsx`
**Plugin:** Mon coach (`plugins/mon-coach`)
**Navigation:** `router.push('/(plugins)/coach/video-player?videoId=[id]')` from VideoListScreen
**Props via query params:** `videoId` (string)

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  SafeAreaView + StatusBar                            │
├─────────────────────────────────────────────────────┤
│  Header (height: 48px)                              │
│  paddingHorizontal: 16                              │
│  flex-row items-center gap: 12                      │
│  ← (Ionicons chevron-back 24px #1C1A17)             │
│  Title: video.title  18px/600 #1C1A17 flex-1        │
│  truncate numberOfLines: 1                          │
├─────────────────────────────────────────────────────┤
│  VideoView                                           │
│  width: '100%'                                      │
│  aspectRatio: 16/9                                  │
│  backgroundColor: '#000000'                          │
│  nativeControls: true                               │
│  contentFit: 'contain'                              │
├─────────────────────────────────────────────────────┤
│  Annotation Timeline Strip                           │
│  (see spec below)                                   │
├─────────────────────────────────────────────────────┤
│  ScrollView (flex: 1)                               │
│  paddingHorizontal: 16                              │
│  paddingBottom: 100  ← tab bar clearance            │
│                                                     │
│  [Active annotation card — if selected]             │
│  [Annotation list below]                            │
└─────────────────────────────────────────────────────┘
```

#### Signed URL Loading State

While `GET /coach/videos/:videoId/signed-url` is pending (screen mount):
```
width: '100%', aspectRatio: 16/9, backgroundColor: '#000000'
flex items-center justify-center
```
- ActivityIndicator color `#FF5C1A` size `large`
- Text below: "Chargement de la vidéo..." 12px/400 `#FFFFFF`

If fetch fails (network error or 401/403/404):
```
backgroundColor: '#1C1A17', aspectRatio: 16/9
flex items-center justify-center gap: 8
```
- Ionicons `alert-circle-outline` 32px `#EF4444`
- Text: "Impossible de charger la vidéo" 14px/600 `#FFFFFF`
- Subtext: "Revenez plus tard ou contactez votre coach." 12px/400 `#6B6963`

#### Annotation Timeline Strip

Positioned between the VideoView and the scrollable content. This is a custom View component.

```
Container:
  height: 36px
  paddingHorizontal: 16
  paddingVertical: 10
  backgroundColor: '#FFFFFF'
  borderTopWidth: 1, borderTopColor: '#E2E0DA'
  borderBottomWidth: 1, borderBottomColor: '#E2E0DA'
  position: 'relative'
```

Inner track bar (full width, centered vertically):
```
position: 'absolute'
left: 16, right: 16
top: 50% (transform: translateY(-50%))
height: 3
backgroundColor: '#E2E0DA'
borderRadius: 2
```

Each annotation dot:
```
position: 'absolute'
top: 50%
transform: [{ translateY: -6 }, { translateX: -6 }]  ← center on track
width: 12, height: 12
borderRadius: 6
backgroundColor: '#FF5C1A'
borderWidth: 2, borderColor: '#FFFFFF'
shadowColor: '#1C1A17', shadowOpacity: 0.2, shadowRadius: 3, elevation: 3
```

Dot position formula (horizontal):
```ts
const trackWidth = screenWidth - 32; // 16px padding each side
const leftOffset = (annotation.timestamp_s / duration) * trackWidth + 16;
```

Touch target (TouchableOpacity wrapper):
```
width: 44, height: 44
position: 'absolute'
top: 50%
transform: [{ translateY: -22 }, { translateX: -22 }]
justifyContent: 'center', alignItems: 'center'
```

Dot tap behavior:
1. `player.currentTime = annotation.timestamp_s` (seek)
2. Set `activeAnnotationId` state → show annotation card below

Duration gate: Do not render dots until `player.status === 'readyForDisplay'` and `duration > 0`.

If `annotations.length === 0`:
- Track bar still renders (visual consistency)
- No dots
- Track bar color: `#E2E0DA` (flat, no orange)

#### Active Annotation Card

Shown when a dot is tapped. Positioned in the ScrollView immediately below the timeline strip.

```
marginHorizontal: 16
marginTop: 12
padding: 12
backgroundColor: '#FFFFFF'
borderRadius: 8
borderWidth: 1, borderColor: '#FF5C1A'
shadowColor: '#1C1A17', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3
```

Structure:
```
Row:
  Timestamp chip: [MM:SS] — same style as web
  backgroundColor: '#FFF0E8', color: '#C2410C'
  paddingHorizontal: 8, paddingVertical: 4
  borderRadius: 4, fontFamily: monospace, fontSize: 12

mt-2:
  Annotation text: 14px/400 #1C1A17, lineHeight: 21

Close (dismiss) button:
  position: 'absolute', top: 8, right: 8
  Ionicons: close 18px #6B6963
```

Tapping outside the card or tapping the same dot again dismisses the card.

#### Annotation List (below card)

When card is dismissed or no dot is selected, the full annotation list is shown.

Section header:
```
paddingVertical: 12
fontSize: 14, fontWeight: '600', color: '#1C1A17'
Text: "Tous les commentaires ([N])"
```

Each annotation row:
```
paddingVertical: 10
borderBottomWidth: 1, borderBottomColor: '#E2E0DA'
flexDirection: 'row', alignItems: 'flex-start', gap: 10

Timestamp chip (same style)
Text: annotation.content — 14px/400, #1C1A17, flex: 1, lineHeight: 21
```

Tap on row: seeks to timestamp + activates card for that annotation.

Empty list state (no annotations):
```
paddingVertical: 32, alignItems: 'center', gap: 8

Ionicons: chatbubble-ellipses-outline 28px #E2E0DA
Text: "Aucun commentaire" 14px/600 #1C1A17
Text: "Votre coach n'a pas encore ajouté d'annotations." 12px/400 #6B6963 textAlign: center
```

---

## Annotation Dot Overlay — Full Spec

### Web (AnnotatedTimeSlider)

| Property | Value |
|----------|-------|
| Diameter | 12px (w-3 h-3) |
| Shape | `rounded-full` |
| Fill color | `#FF5C1A` |
| Border | 2px solid `#FFFFFF` |
| Shadow | `0 1px 3px rgba(28,26,23,0.20)` |
| Z-index | `z-10` |
| Position | `absolute`, left: `(timestamp_s / duration) * 100%`, top: 50%, transform: translate(-50%, -50%) |
| Duration gate | Render only when `useMediaState('duration') > 0` |
| Hover | `scale(1.4)` via `hover:scale-[1.4] transition-transform duration-100` |
| Tooltip | HTML `title`: `"MM:SS — [first 60 chars]..."` |
| Click | `remote.seek(timestamp_s)` + scroll annotation panel list to matching item |
| Cursor | `cursor-pointer` |

### Mobile (Annotation Timeline Strip)

| Property | Value |
|----------|-------|
| Diameter | 12px visual dot (10px inner, 2px border) |
| Shape | `borderRadius: 6` |
| Fill color | `#FF5C1A` |
| Border | 2px solid `#FFFFFF` |
| Shadow | shadowOpacity: 0.20, shadowRadius: 3, elevation: 3 |
| Position formula | `left = (timestamp_s / duration) * (screenWidth - 32) + 16` |
| Duration gate | Render only after `status === 'readyForDisplay'` and `duration > 0` |
| Touch target | 44×44px `TouchableOpacity` wrapper centered on dot |
| Tap | `player.currentTime = timestamp_s` + set `activeAnnotationId` |
| Active state | dot scales to 16px via `withSpring` (react-native-reanimated) |

---

## AnnotationPanel State Machine

Full state machine reference for `AnnotationPanel.tsx`. Use `useReducer` pattern identical to `VocalRetourPanel.tsx`.

### States

| State | Description | Visual |
|-------|-------------|--------|
| `list` | Showing annotation list + footer buttons | List of annotations, "Annoter" + "Envoyer" buttons |
| `composing` | Timestamp captured, textarea focused | Composer view replaces list; timestamp chip + textarea + Save/Cancel |
| `editing` | Editing an existing annotation | Composer pre-filled with existing text; Save relabeled "Mettre à jour" |
| `sending` | POST /send-feedback in flight | Footer buttons disabled+dimmed, spinner on "Envoyer" |
| `sent` | POST succeeded, push sent | "Retour envoyé" confirmation chip, "Annoter" still available |

### Transitions

```
list
  → composing     when: "Annoter à ce moment" clicked AND paused === true
  → editing       when: pencil icon on list item clicked
  → sending       when: "Envoyer le retour" clicked AND annotations.length >= 1
  → list          (initial state)

composing
  → list          when: "Annuler" clicked OR save succeeds
  → list          when: save error (show inline error toast, remain in composing? → return to list)

editing
  → list          when: "Annuler" or "Mettre à jour" succeeds

sending
  → sent          when: POST /send-feedback returns 200
  → list          when: POST /send-feedback returns error (show toast, re-enable button)

sent
  → (terminal in Phase 46 — no resend)
  → composing     when: "Annoter à ce moment" clicked (can still add annotations after sending)
```

### Visual Diff per State

| State | Header Title | Footer |
|-------|-------------|--------|
| `list` (empty) | "Annotations" | "Annoter à ce moment" (outline, enabled if paused) |
| `list` (with items) | "Annotations [N]" | "Annoter" + "Envoyer le retour" |
| `composing` | "Nouvelle annotation" | "Annuler" + "Enregistrer" |
| `editing` | "Modifier l'annotation" | "Annuler" + "Mettre à jour" |
| `sending` | "Annotations [N]" | Buttons dimmed, "Envoi en cours..." spinner |
| `sent` | "Annotations [N]" | "Retour envoyé" (green chip, disabled) + "Annoter" still available |

### Reducer Actions

```ts
type AnnotationAction =
  | { type: 'START_COMPOSE'; timestamp_s: number }
  | { type: 'START_EDIT'; annotationId: string; content: string; timestamp_s: number }
  | { type: 'CANCEL_COMPOSE' }
  | { type: 'SAVE_SUCCESS'; annotation: Annotation }
  | { type: 'UPDATE_SUCCESS'; annotation: Annotation }
  | { type: 'DELETE_ANNOTATION'; annotationId: string }
  | { type: 'START_SEND' }
  | { type: 'SEND_SUCCESS' }
  | { type: 'SEND_ERROR'; message: string }
  | { type: 'SET_ANNOTATIONS'; annotations: Annotation[] };
```

---

## Motion Design

**Personality:** Snappy + Fluid hybrid (from MOODBOARD.md) — 200ms entrances, `power2.out`.

### Web — GSAP Contracts

All GSAP calls require `import gsap from 'gsap'` — already a project dependency.

| Screen | Animation | Duration | Easing | GSAP Pattern |
|--------|-----------|----------|--------|--------------|
| VideoListPage | Page entrance | 200ms | power2.out | `gsap.from(listRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' })` |
| VideoListPage | List item stagger | 200ms | power2.out | `gsap.from('.video-list-item', { y: 8, opacity: 0, duration: 0.15, stagger: 0.04, ease: 'power2.out' })` |
| VideoPlayerPage | Panel entrance | 200ms | power2.out | `gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' })` — exact copy of VocalRetourPanel pattern |
| AnnotationPanel | Composer transition (list → composing) | 200ms | power2.inOut | `gsap.from(composerRef.current, { x: 16, opacity: 0, duration: 0.2, ease: 'power2.out' })` — composer slides in from right |
| AnnotationPanel | Composer exit (composing → list) | 150ms | power2.in | `gsap.to(composerRef.current, { x: -16, opacity: 0, duration: 0.15, ease: 'power2.in' })` |
| AnnotationPanel | New annotation enters list | 250ms | power2.out | `gsap.from(newItemRef.current, { height: 0, opacity: 0, duration: 0.25, ease: 'power2.out' })` — expand from top |
| AnnotationPanel | Annotation dot appears on timeline | 200ms | back.out(1.4) | `gsap.from(dotRef, { scale: 0, opacity: 0, duration: 0.2, ease: 'back.out(1.4)' })` — spring bounce in |
| AnnotationPanel | Annotation dot remove | 150ms | power2.in | `gsap.to(dotRef, { scale: 0, opacity: 0, duration: 0.15, ease: 'power2.in' })` |
| AnnotationPanel | "Envoyer" button → spinner | 100ms | power2.out | `gsap.from(spinnerRef, { scale: 0, opacity: 0, duration: 0.1, ease: 'power3.out' })` |
| AnnotationPanel | "Retour envoyé" confirmation | 250ms | back.out(1.4) | `gsap.from(sentRef.current, { scale: 0.95, opacity: 0, duration: 0.25, ease: 'back.out(1.4)' })` |
| "Annoter" button | Press feedback | 100ms | power2.in | `gsap.to(btnRef.current, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.in' })` |
| "Envoyer" button | Press feedback | 100ms | power2.in | `gsap.to(btnRef.current, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.in' })` |
| VideoListPage | Row hover (CSS, not GSAP) | 100ms | — | `transition-colors duration-100` Tailwind class |
| VideoListPage | Skeleton → content | 200ms | power2.out | `gsap.from('.video-list-item', { opacity: 0, duration: 0.2, stagger: 0.04 })` after data loads |

### Mobile — react-native-reanimated v3 Contracts

| Screen | Animation | Pattern |
|--------|-----------|---------|
| VideoPlayerScreen | Entrance | `FadeInDown.duration(200).easing(Easing.out(Easing.quad))` on the main ScrollView |
| VideoPlayerScreen | Signed URL loading → player ready | Opacity crossfade: `FadeIn.duration(300)` on VideoView after URL is set |
| Annotation dot | Tap feedback (scale) | `withSpring(1.4, { damping: 12, stiffness: 180 })` on dot scale → then `withSpring(1.0)` |
| Active annotation card | Slide up + fade in | `FadeInUp.duration(200)` or `SlideInDown.duration(200)` |
| Active annotation card | Dismiss | `FadeOutDown.duration(150)` |
| Annotation list | Staggered mount | `FadeInUp.delay(index * 40).duration(200)` on each row (max 5 delays, cap at 200ms) |
| Timeline strip | Dot appear | `ZoomIn.duration(200).springify()` on `Animated.View` wrapper for each dot |

All mobile animations use `useAnimatedStyle` + `withTiming`/`withSpring` from `react-native-reanimated` v3. No GSAP on mobile.

---

## Copywriting Contract

All copy in French unless noted. Tone: professional, direct, sports coaching register.

### Web — VideoListPage

| Element | Copy |
|---------|------|
| Page heading | `Vidéos de [Prénom Athlète]` |
| Video count | `1 vidéo` / `[N] vidéos` (pluralize) |
| Empty state heading | `Aucune vidéo pour l'instant` |
| Empty state body | `L'athlète peut envoyer ses vidéos depuis l'application mobile — elles apparaîtront ici.` |
| Loading state (a11y) | `Chargement des vidéos...` (aria-label) |
| Error heading | `Impossible de charger les vidéos` |
| Error body | `Vérifiez votre connexion et réessayez.` |
| Error retry button | `Réessayer` |
| Status badge: uploading | `En cours d'envoi` |
| Status badge: ready | `Prête à annoter` |
| Status badge: annotated | `Annotée` |

### Web — VideoPlayerPage (Header Area)

| Element | Copy |
|---------|------|
| Back link | `← Retour aux vidéos` |
| Player URL error heading | `Impossible de charger la vidéo` |
| Player URL error body | `L'URL a peut-être expiré. Rechargez la page.` |
| Player loading a11y | `Chargement du lecteur vidéo...` |

### Web — AnnotationPanel

| Element | Copy |
|---------|------|
| Panel heading (empty) | `Annotations` |
| Panel heading (with items) | `Annotations` + badge `[N]` |
| Empty panel body | `Aucune annotation` |
| Empty panel subtext | `Mettez la vidéo en pause, puis cliquez sur 'Annoter à ce moment' pour ajouter votre premier commentaire.` |
| "Annoter" button (enabled) | `Annoter à ce moment` |
| "Annoter" button (disabled, playing) | `Annoter à ce moment` |
| "Annoter" disabled tooltip | `Mettez la vidéo en pause d'abord` |
| "Envoyer" button | `Envoyer le retour` |
| "Envoyer" button (sending) | `Envoi en cours...` |
| "Sent" confirmation | `Retour envoyé` |
| Composer heading (new) | `Nouvelle annotation` |
| Composer heading (edit) | `Modifier l'annotation` |
| Timestamp chip label | `Moment` |
| Textarea label | `Commentaire` |
| Textarea placeholder | `Décrivez ce que vous observez...` |
| Character counter | `[N]/2000` |
| Save button (new) | `Enregistrer` |
| Save button (edit) | `Mettre à jour` |
| Save button (saving) | `Enregistrement...` |
| Cancel button | `Annuler` |
| Delete inline confirm | `Supprimer ?` |
| Delete cancel | `Annuler` |
| Send error toast | `Échec de l'envoi. Veuillez réessayer.` |
| Save error toast | `Impossible de sauvegarder. Réessayez.` |
| Delete error toast | `Impossible de supprimer. Réessayez.` |

### Mobile — VideoPlayerScreen

| Element | Copy |
|---------|------|
| Loading text (URL pending) | `Chargement de la vidéo...` |
| Error heading | `Impossible de charger la vidéo` |
| Error body | `Revenez plus tard ou contactez votre coach.` |
| Annotation card close a11y | `Fermer le commentaire` |
| Annotation list section header | `Tous les commentaires ([N])` |
| Empty annotation list | `Aucun commentaire` |
| Empty annotation subtext | `Votre coach n'a pas encore ajouté d'annotations.` |
| No annotations on timeline | (no text — empty strip is self-explanatory) |

### Push Notification (sent by Hono backend)

| Field | Value |
|-------|-------|
| Title | `Retour vidéo disponible` |
| Body | `📹 [coach.display_name] a analysé votre vidéo : [video.title]` |
| Data | `{ type: 'video_feedback', videoId: '[uuid]' }` |

(Push body format per D-08, locked decision.)

### VideoListScreen (Mobile — Phase 45, extended in Phase 46)

| Element | Copy |
|---------|------|
| Tap on annotated video (no existing onPress) | Now navigates to VideoPlayerScreen |
| Status badge extension | `Annotée` with orange dot (reuses Phase 45 status display) |

---

## Generated Assets

No Higgsfield-generated assets in this phase. All visuals are UI chrome (player controls, list rows, annotation dots, status badges). No hero images, illustrations, or lifestyle photography required.

| Asset | Screen | Generator | URL |
|-------|--------|-----------|-----|
| — | — | none | — |

---

## Registry Safety

| Registry | Packages / Blocks Used | Safety Gate |
|----------|------------------------|-------------|
| npm official | `@vidstack/react@next` (1.15.1) — 3+ years old, official vidstack org, verified via npm registry + github.com/vidstack/player | Approved — no flags. Install with `@next` tag (NOT `latest` — peer dep mismatch with React 19). |
| npm official (Expo) | `expo-video` (~2.0.6) — official Expo package, SDK 54 compatible, replaces deprecated `expo-av` | Approved — official Expo package. Install via `npx expo install expo-video`. |

No third-party registries used. No shadcn registry in scope (not a web-component library phase). No vetting gate required.

---

## Technical Notes for Executors

These are design-contract-level constraints that must be respected during implementation.

### Web Player Architecture Constraint

Both `<VideoPlayer>` and `<AnnotationPanel>` must be wrapped inside a single `<MediaPlayer>` root to allow `useMediaRemote()` and `useMediaState()` hooks to work in the annotation panel. This is not optional — it is required by the Vidstack API. Wrap in `VideoPlayerClient.tsx`:

```tsx
<MediaPlayer src={signedUrl}>
  <div className="flex gap-6 items-start">
    <div className="flex-[2] min-w-0">
      <MediaProvider className="aspect-video bg-black rounded-lg" />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
      <AnnotatedTimeSlider annotations={annotations} />
    </div>
    <div className="flex-1 min-w-0 max-w-sm min-w-[280px] sticky top-6">
      <AnnotationPanel videoId={videoId} annotations={annotations} onAnnotationsChange={...} />
    </div>
  </div>
</MediaPlayer>
```

### Notes Panel Hide Mechanism

`ClientNotesPanelConditional.tsx` wraps the notes panel and calls `usePathname()`. Returns `null` when `pathname.includes('/videos')`. This is a client component. The layout.tsx remains a server component.

### ClientTabStrip Active State Fix

The "Vidéos" tab must remain highlighted on both `/videos` (list) and `/videos/[videoId]` (player). Update active detection for the videos tab only:
```ts
const isActive = tab.key === 'videos'
  ? pathname.includes('/videos')
  : pathname.endsWith(`/${tab.key}`);
```

### Vidstack CSS Installation

Add to `apps/web/src/app/globals.css`:
```css
@import '@vidstack/react/player/styles/default/theme.css';
@import '@vidstack/react/player/styles/default/layouts/video.css';
@plugin '@vidstack/react/tailwind.cjs';
```

### expo-video Install

```bash
cd apps/mobile && npx expo install expo-video
```

Requires Dev Build (EAS). Does NOT work in Expo Go.

### Annotation Dot Duration Gate

Never render annotation dots before `duration > 0` (web) or `player.status === 'readyForDisplay'` (mobile). Dots at `left: 0%` are a silent bug caused by a zero duration denominator.

### Signed URL Fetch

Web: fetch signed URL server-side in `VideoPlayerPage` (server component). Pass `signedUrl` as prop to `VideoPlayerClient`. This avoids an extra client-side round-trip and aligns with the SSR-first coach web patterns.

Mobile: fetch signed URL on screen mount in `VideoPlayerScreen`. Show loading state (ActivityIndicator) during fetch.

### Text Annotation Character Limit

Enforce 2000-character maximum on both client (textarea `maxLength` / counter) and backend (`content.length > 2000 → 400 Bad Request`).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS — all copy in French, all states defined (empty/loading/error/success)
- [ ] Dimension 2 Visuals: PASS — all screen states fully specified, layout described at component-tree level
- [ ] Dimension 3 Color: PASS — hex values for every usage, accent reserved-for list explicit, no orange on skeletons
- [ ] Dimension 4 Typography: PASS — all sizes from MOODBOARD.md scale, usage per element specified
- [ ] Dimension 5 Spacing: PASS — all spacing from 4px-grid scale, exceptions documented
- [ ] Dimension 6 Registry Safety: PASS — two packages, both official npm, no third-party registries

**Approval:** pending
