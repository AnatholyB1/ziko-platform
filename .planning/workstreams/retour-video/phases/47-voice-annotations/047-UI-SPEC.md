---
phase: 47
slug: voice-annotations
status: approved
reviewed_at: 2026-05-27
shadcn_initialized: false
preset: none
figma_file_url: "none"
moodboard_path: .planning/MOODBOARD.md
created: 2026-05-27
base_spec: .planning/workstreams/retour-video/phases/46-web-player-text-annotations/046-UI-SPEC.md
---

# Phase 47 — UI Design Contract: Voice Annotations

> Visual and interaction contract for frontend Phase 47.
> Figma not available in this runtime — written contract is the sole source of truth.
> All design decisions inherit from Phase 46 UI-SPEC unless explicitly overridden here.
> All design decisions reference `.planning/MOODBOARD.md` (created 2026-05-21).

**Inheritance rule:** Every spec from Phase 46 `046-UI-SPEC.md` applies verbatim to this phase EXCEPT where this document explicitly overrides it. Executors must read both documents together — this document layers on top of Phase 46.

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
| AnnotationPanel — composing (voice mode) | idle / recording / transcribing / review / error | none |
| Voice annotation list item (web) | default / hover / active / audio loading / audio ready | none |
| VideoPlayerScreen (mobile) — voice annotation row | default / active card | none |

> **Executors:** This written contract is the pixel-level reference. Follow every layout, spacing, copy, and color spec exactly. No creative deviation without an explicit override decision.

---

## Design System

**Inherited from Phase 46 — no changes.**

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

**Inherited from Phase 46 — no changes.**

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline spacing |
| sm | 8px | Padding inside chips, badge text padding, list item vertical padding |
| md | 16px | Default section padding, panel horizontal padding |
| lg | 24px | Section vertical spacing |
| xl | 32px | Page top padding, major content gaps |
| 2xl | 48px | Empty state vertical centering offset |

Phase 47 additions:
- VoiceComposer mic button: 64px diameter (fixed, not a grid multiple — chosen for thumb reachability as a large tap target)
- Mode toggle tab height: 32px (py-1.5 + text-sm = 6px top + 6px bottom + ~14px text = ~26px; rounded to 32px container)
- Recording timer text: inline below button, no extra spacing token needed

---

## Typography

**Inherited from Phase 46 — no changes.**

| Role | Size | Weight | Line Height | Usage in Phase 47 |
|------|------|--------|-------------|-------------------|
| H2 | 18px | 600 | 1.35 | Panel heading (unchanged) |
| Body | 14px | 400 | 1.5 | Transcript text in review box, mode toggle tab labels, recording timer |
| Caption | 12px | 400 | 1.4 | Subtext below mic button, error card text, "Quelques secondes..." hint, transcript box label, re-record label hint |

---

## Color

**Inherited from Phase 46 — additions only below.**

| Role | Hex | Usage |
|------|-----|--------------------|
| Background (60%) | `#F7F6F3` | Unchanged |
| Surface (30%) | `#FFFFFF` | Unchanged. Also: Ré-enregistrer button fill in review and error states |
| Surface Muted | `#F0EFE9` | Transcript read-only textarea background (review state). Inactive mode toggle tab fill. |
| Border | `#E2E0DA` | Mode toggle container border. Ré-enregistrer button border (review state). |
| Primary / Accent (10%) | `#FF5C1A` | Active voice mode toggle tab fill. Mic button (idle state). Sauvegarder button fill. Ré-enregistrer outline in error state. |
| Text Primary | `#1C1A17` | Active mode toggle tab text (text mode). Transcript text in review box. "Transcription IA en cours..." text. |
| Text Muted | `#6B6963` | Inactive mode toggle tab text. Subtext below mic button. Recording timer. Ré-enregistrer button text in review state. |
| Text Inverse | `#FFFFFF` | Text on orange mic button (idle), active voice tab, Sauvegarder button. |
| Destructive | `#EF4444` | Recording mic button fill (recording state). Error card icon + text. Pulse ring border. |
| Destructive Surface | `#FEF2F2` | Error card background |
| Destructive Border | `#FCA5A5` | Error card border |
| Accent Warm Muted | `#FFF0E8` | Mic badge background on voice annotation list item. Same token as Phase 46 timestamp chip background. |
| Accent Text Dark | `#C2410C` | Mic badge icon color. Reuses Phase 46 timestamp chip text color. |

**New accent reserved-for items (additions to Phase 46 list):**
- Active voice mode toggle tab (filled orange)
- Mic button circle in idle state (filled orange)
- Ré-enregistrer button border + text in error state (orange outline)
- Sauvegarder button in review state (filled orange)

**Error-state palette (voice-specific):**
- Error card background: `#FEF2F2`
- Error card border: `#FCA5A5`
- Error icon + text: `#EF4444`
- Recording button: `#EF4444` (same destructive, communicates "stop / danger")

---

## Screen Specifications

---

### Inherited Screens (Phase 46 — unchanged)

Phase 47 does NOT modify:
- Screen 1: VideoListPage (web)
- VideoPlayer component
- AnnotatedTimeSlider component
- Annotation dot overlay specs (web + mobile)
- AnnotationPanel `list` state
- AnnotationPanel `editing` state
- AnnotationPanel `sending` state
- AnnotationPanel `sent` state

---

### Component: Mode Toggle [Text] [Mic]

**Location:** Top of the AnnotationPanel `composing` view, ABOVE the timestamp chip label.

**Applies to:** Both new annotation (`composing` state) and editing (`editing` state). The mode toggle is present in both cases. In `editing` state, switching to voice mode allows re-recording a replacement transcript.

**Container:**
```
flex rounded-md border border-[#E2E0DA] overflow-hidden
w-full mb-4
```

**Each tab (50% width):**
```
w-1/2 py-1.5 flex items-center justify-center gap-1.5
text-sm font-medium
transition-colors duration-100
```

**Text mode tab — inactive:**
```
bg-[#F0EFE9] text-[#6B6963]
hover:text-[#1C1A17]
```

**Text mode tab — active:**
```
bg-white text-[#1C1A17]
```

**Voice mode tab — inactive:**
```
bg-[#F0EFE9] text-[#6B6963]
hover:text-[#1C1A17]
```

**Voice mode tab — active (selected):**
```
bg-[#FF5C1A] text-white
```

**Icons:**
- Text tab: Lucide `type` icon, 14px, inline-left, `flex-shrink-0`
- Voice tab: Lucide `mic` icon, 14px, inline-left, `flex-shrink-0`

**Separator between tabs:** The border-[#E2E0DA] container provides the separation — no explicit divider element needed. The overflow-hidden + border renders a clean segmented line between tabs.

**Interaction:**
- Click fires `dispatch({ type: 'SET_MODE', mode: 'text' | 'voice' })`
- Switching from voice → text while VoiceComposer has a transcript in `review` state: composer resets to `idle` (transcript is discarded). The user is re-entering text mode. No confirmation needed — they have not saved yet.
- Switching from voice → text while recording is active (`recording` state): stops the recording silently, resets to `idle`, then switches to text mode.

**Updated composing state layout (full panel):**

```
┌─ Panel ──────────────────────────────────────────────┐
│  Header: "Nouvelle annotation"  H2 18px/600          │
├──────────────────────────────────────────────────────┤
│  flex-1 overflow-y-auto px-4 py-4                    │
│                                                       │
│  [Text] [Mic]  ← mode toggle, full width, mb-4       │
│                                                       │
│  Label: "Moment"  12px/400 text-muted                │
│  Chip: [MM:SS]  bg-[#FFF0E8] text-[#C2410C]          │
│  border border-[#FF5C1A] rounded px-2 py-1            │
│  font-mono 12px/400                                   │
│                                                       │
│  mt-4                                                 │
│  [Text composer area]   ← mode = 'text'               │
│     OR                                                │
│  [VoiceComposer]        ← mode = 'voice'              │
│                                                       │
├──────────────────────────────────────────────────────┤
│  Footer (changes depending on mode + voice state)    │
└──────────────────────────────────────────────────────┘
```

---

### Component: VoiceComposer

**File:** `apps/web/src/components/coach/videos/VoiceComposer.tsx`
**Pattern:** Mirrors `VocalRetourPanel.tsx` — `useReducer` + `useVocalRecorder` + GSAP entrance.
**Internal states:** `idle | recording | transcribing | review | error`
**Props:**
```ts
interface VoiceComposerProps {
  timestampSeconds: number;          // read-only, inherited from composing state
  onVoiceReady: (result: { transcript: string; audioPath: string }) => void;
  onCancel: () => void;              // resets VoiceComposer to idle (used by mode toggle)
}
```

**Mounting:** VoiceComposer mounts when `mode === 'voice'` in the composing state. It unmounts when mode switches back to 'text'. GSAP entrance fires on mount.

---

#### VoiceComposer State: `idle`

**Layout:**
```
flex flex-col items-center justify-center
flex-1 pt-8 pb-4
gap-0
```

**Mic button (tap target):**
```
w-16 h-16 rounded-full
bg-[#FF5C1A]
flex items-center justify-center
shadow-md           ← 0 4px 8px rgba(28,26,23,0.08)
cursor-pointer
hover:bg-[#E04E14] transition-colors duration-100
active:scale-95 transition-transform duration-75
```

**Mic icon inside button:**
- Lucide `mic`, 28px, `text-white`

**Subtext below button:**
```
mt-3
text-xs text-[#6B6963] text-center
max-w-[180px]
```
- Copy: "Appuyez pour commencer l'enregistrement"

**Footer (when idle):**
```
px-4 py-3 border-t border-[#E2E0DA] flex gap-2
```
- [Annuler] button: `border border-[#E2E0DA] text-[#6B6963] bg-white text-sm py-2 rounded-md w-full`
  - Clicking returns to text mode (dispatches `SET_MODE: 'text'`)
- No Sauvegarder button in idle — not saveable yet

---

#### VoiceComposer State: `recording`

**Layout:** Same centered column as idle.

**Mic button transforms to stop button:**
```
w-16 h-16 rounded-full
bg-[#EF4444]
flex items-center justify-center
cursor-pointer
relative   ← needed for pulse ring positioning
```

**Pulse ring (absolutely positioned, animated):**
```
absolute inset-0
rounded-full
border-2 border-[#EF4444]
animate-ping
opacity-75
pointer-events-none
```

The `animate-ping` class (Tailwind) produces the expanding + fading ring. No GSAP needed — pure CSS. One ring is sufficient; do not stack multiple rings.

**Stop icon inside button:**
- Lucide `square` (filled square shape), 24px, `text-white`
- Replaces the `mic` icon while recording

**Timer text (below button):**
```
mt-2
text-sm text-[#6B6963] font-mono
```
- Format: `0:03` (elapsed seconds, M:SS format, no zero-pad on minutes)
- Updates every second via `setInterval` in VoiceComposer

**Subtext below timer:**
```
mt-1
text-xs text-[#6B6963] text-center
max-w-[200px]
```
- Copy: "Enregistrement en cours... Appuyez pour arrêter"

**Footer (when recording):**
- Identical to idle footer: [Annuler] only
- Clicking [Annuler] while recording: stops recording, discards blob, resets to idle, keeps mode = 'voice'

---

#### VoiceComposer State: `transcribing`

**Layout:** Same centered column.

**Mic button replaced by spinner:**
```
w-16 h-16 flex items-center justify-center
```
- Lucide `loader-2`, 28px, `text-[#FF5C1A]`, `animate-spin`
- No button background — spinner floats in the space

**Primary text (below spinner):**
```
mt-3
text-sm text-[#1C1A17] text-center font-medium
```
- Copy: "Transcription IA en cours..."

**Subtext:**
```
mt-1
text-xs text-[#6B6963] text-center
```
- Copy: "Quelques secondes..."

**Footer (when transcribing):**
- No buttons — `transcribing` is a locked state. The user cannot cancel mid-transcription (the Hono route is in flight). Footer is empty (`px-4 py-3 border-t border-[#E2E0DA]`) — reserved space, no interactive elements.

**GSAP entrance on entering transcribing state:**
```js
gsap.from(spinnerContainerRef.current, { scale: 0, opacity: 0, duration: 0.2, ease: 'back.out(1.4)' })
```

---

#### VoiceComposer State: `review`

**Layout:** Fills the composing body (replaces centered idle/recording/transcribing layout).

```
flex flex-col gap-2 pt-4
```

**Transcript label:**
```
text-xs text-[#6B6963]
```
- Copy: "Transcription IA"

**Transcript box (read-only textarea):**
```html
<textarea
  readOnly
  rows={3}
  className="w-full bg-[#F0EFE9] border border-[#E2E0DA] rounded-md px-3 py-2
             text-sm text-[#1C1A17] resize-none leading-relaxed
             cursor-default focus:outline-none"
  value={transcript}
/>
```
- `readOnly` attribute — not editable (per D-05: coach sees and approves, does not edit)
- `rows={3}` — visible height; overflow scrolls if transcript is very long (rare)
- No focus ring visible (focus:outline-none) since it is read-only
- Background `#F0EFE9` distinguishes it from editable inputs (which are also `#F0EFE9` in Phase 46 — this is intentional, consistent with the surface muted pattern)

**Hint text below box:**
```
text-xs text-[#6B6963] mt-1
```
- Copy: "Relisez avant de sauvegarder. Si ce n'est pas correct, ré-enregistrez."

**Footer (when review — replaces standard composing footer):**
```
px-4 py-3 border-t border-[#E2E0DA] flex gap-2
```

Ré-enregistrer button:
```
border border-[#E2E0DA] text-[#6B6963] bg-white
text-sm py-2 rounded-md w-1/2
hover:border-[#1C1A17] hover:text-[#1C1A17] transition-colors duration-100
```
- Resets VoiceComposer internal state to `idle`
- Does NOT dispatch to parent — stays in voice mode

Sauvegarder button:
```
bg-[#FF5C1A] text-white
text-sm font-medium py-2 rounded-md w-1/2
hover:bg-[#E04E14] transition-colors duration-100
```
- Never disabled in review state — transcript is always present
- Calls `onVoiceReady({ transcript, audioPath })`
- Parent then dispatches `SAVE_SUCCESS` and transitions back to `list`

**GSAP entrance on entering review state:**
```js
gsap.from(transcriptBoxRef.current, { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' })
```

---

#### VoiceComposer State: `error`

**Layout:** Centered column layout (same as idle), but error card replaces mic button area.

**Error card:**
```
bg-[#FEF2F2] border border-[#FCA5A5] rounded-md px-3 py-2 mt-4
flex items-start gap-2
```

Error icon:
- Lucide `alert-circle`, 14px, `text-[#EF4444]`, `flex-shrink-0 mt-0.5`

Error text:
```
text-xs text-[#EF4444]
```
- Copy: "La transcription a échoué. Vérifiez votre connexion et réessayez."

**Ré-enregistrer button (below error card):**
```
border border-[#FF5C1A] text-[#FF5C1A] bg-white
text-sm py-2 rounded-md w-full mt-3
hover:bg-[#FFF0E8] transition-colors duration-100
```
- Resets internal VoiceComposer state to `idle`

**Footer (when error):**
- [Annuler] only — `border border-[#E2E0DA] text-[#6B6963] bg-white text-sm py-2 rounded-md w-full`

**GSAP entrance on entering error state:**
```js
gsap.from(errorCardRef.current, { y: 4, opacity: 0, duration: 0.2, ease: 'power2.out' })
```

---

### Component: Voice Annotation List Item (Web — AnnotationPanel `list` state)

Voice annotation items are visually distinguished from text annotation items by a mic badge prefix and an inline audio player. All other list item styles inherit from Phase 46.

**Container (same as Phase 46 text annotation item):**
```
px-4 py-3 border-b border-[#E2E0DA] last:border-0
flex flex-col gap-2
cursor-pointer
hover:bg-[#F0EFE9] transition-colors duration-100
relative
group
```

**Left accent strip (active item — same as Phase 46):**
```
absolute left-0 top-0 bottom-0 w-1 bg-[#FF5C1A] rounded-r
```

**Line 1 — header row:**
```
flex items-center gap-2
```

Mic badge:
```
flex-shrink-0 w-5 h-5 rounded-full bg-[#FFF0E8]
flex items-center justify-center
```
- Lucide `mic`, 10px, `text-[#FF5C1A]`
- `flex-shrink-0`

Timestamp chip (same as Phase 46 text annotation):
```
bg-[#FFF0E8] text-[#C2410C]
px-1.5 py-0.5 rounded font-mono
text-xs   ← 12px/400
flex-shrink-0
```
- Format: `MM:SS` (zero-padded)

Transcript text:
```
flex-1 text-sm text-[#1C1A17] line-clamp-2
```

Action icons (edit + delete — same as Phase 46):
```
flex-shrink-0 flex items-center gap-1
opacity-0 group-hover:opacity-100 transition-opacity duration-100
```
- `pencil` icon (Lucide, 14px): triggers editing state (for voice annotations, editing replaces transcript text via voice re-record — outside Phase 47 scope, so clicking pencil on a voice annotation shows a disabled tooltip "Ré-enregistrement disponible dans une prochaine version" for Phase 47)
- `trash-2` icon (Lucide, 14px, `text-[#EF4444]`): same inline delete confirmation as text annotations

**Line 2 — audio player:**
```
mt-1
```

Loading state (signed URL not yet fetched — skeleton):
```
w-full h-8 rounded bg-[#E2E0DA] animate-pulse
```
- Matches Phase 46 skeleton token rule: skeleton is always `#E2E0DA`, never orange

Ready state (signed URL fetched):
```html
<audio
  controls
  preload="none"
  src={signedAudioUrl}
  className="w-full h-8 rounded"
/>
```
- Native browser `<audio controls>` — no custom player styling
- `preload="none"` — does not load audio until play is pressed (bandwidth-conscious)
- `w-full` — spans full item width
- `h-8` (32px) — browser native controls height; exact rendering varies by browser (Chrome/Firefox) but this class prevents layout shift

**Click on row (not on icons, not on audio player):**
- `remote.seek(annotation.timestamp_s)` + activate left accent strip (same as text annotations)
- Audio player clicks are handled by the browser natively; do NOT intercept `onClick` on the audio element

**Complete visual structure:**
```
┌─────────────────────────────────────────────────────────┐
│  [mic badge] [01:23] [transcript text line 1…]  [✎ 🗑]  │  ← Line 1
│                [transcript text line 2…]                 │
│  ─────────────────────────────────────────────────────  │
│  [▶ ──────────────────────────────────── 0:00 / 0:05]   │  ← Line 2 (audio player)
└─────────────────────────────────────────────────────────┘
```

---

### AnnotationPanel State Machine — Extensions

**The 5 top-level states are unchanged:** `list | composing | editing | sending | sent`

**Extension to `composing` state type:**
```ts
type ComposingState = {
  state: 'composing';
  timestamp_s: number;
  mode: 'text' | 'voice';  // NEW — default 'text'
};
```

**New reducer actions (added to Phase 46 `AnnotationAction` union):**
```ts
| { type: 'SET_MODE'; mode: 'text' | 'voice' }
| { type: 'VOICE_READY'; transcript: string; audioPath: string }
```

**`SET_MODE` behavior:**
- Only valid when `state.state === 'composing'` or `state.state === 'editing'`
- If switching from `voice` to `text`: VoiceComposer unmounts (its internal state is discarded)
- `timestamp_s` is preserved through mode switches — the composer was opened at a specific moment, switching mode does not change that moment

**`VOICE_READY` behavior:**
- Fired by VoiceComposer via `onVoiceReady` callback, which then dispatches this action to the parent
- Parent has: `timestamp_s` (from composing state) + `transcript` + `audioPath` (from VOICE_READY)
- Parent calls annotation save API with `{ type: 'voice', content: transcript, audio_path: audioPath, timestamp_s }`
- On save success: dispatches existing `SAVE_SUCCESS` action → panel returns to `list` state

**Reducer state transitions (additions):**
```
composing (mode: 'text')
  → composing (mode: 'voice')   when: SET_MODE 'voice'

composing (mode: 'voice')
  → composing (mode: 'text')   when: SET_MODE 'text'
  → saving (internal)          when: VOICE_READY (parent fires save API, then SAVE_SUCCESS)
```

**Panel header title (unchanged — Phase 46 spec applies):**
- No new header titles for voice mode — panel remains "Nouvelle annotation" or "Modifier l'annotation" regardless of mode

---

### Screen: VideoPlayerScreen (Mobile) — Voice Annotation Extensions

**Platform:** React Native + Expo SDK 54

Phase 47 extends the mobile annotation list to visually distinguish voice annotations. Audio player is NOT rendered on mobile in Phase 47.

**Annotation row (voice type) — diff from Phase 46 text row:**

Phase 46 text row structure:
```
flexDirection: 'row', alignItems: 'flex-start', gap: 10
[timestamp chip]  [annotation text]
```

Phase 47 voice row structure:
```
flexDirection: 'row', alignItems: 'flex-start', gap: 10
[mic badge]  [timestamp chip]  [annotation text]
```

**Mic badge (new element):**
```js
{
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: '#FFF0E8',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginTop: 1,   // optical alignment with chip
}
```
- Ionicons `mic-outline`, 10px, `#FF5C1A`

**Timestamp chip:** unchanged from Phase 46

**Annotation text:** `annotation.content` (the cleaned transcript) — unchanged from Phase 46, `flex: 1`

**No audio player element on mobile.** The `annotation.audio_path` field exists but is not rendered in Phase 47 on mobile.

**Active Annotation Card (voice type) — diff from Phase 46:**

When a voice annotation dot is tapped, the card renders with the mic badge prefix in the header row.

Card header row:
```
flexDirection: 'row', alignItems: 'center', gap: 8
```
- Mic badge (same 20×20 style as list row)
- Timestamp chip (unchanged)
- Close button at absolute top-right (unchanged)

Card body text: cleaned transcript — same as text annotations.

No audio player in the card on mobile.

**Empty annotation list state:** unchanged from Phase 46.

**Timeline strip dots:** no visual change — voice and text annotations share the same `#FF5C1A` dot appearance. No mic icon on the dot (dots are too small at 12px). The type distinction is conveyed in the card and list, not on the scrub bar.

---

## Motion Design

**Personality:** Snappy + Fluid hybrid (from MOODBOARD.md) — inherited from Phase 46. All Phase 46 GSAP contracts remain in effect. Phase 47 adds the following contracts.

### Web — GSAP Contracts (Phase 47 additions)

All GSAP calls require `import gsap from 'gsap'` — already a project dependency.

| Component | Animation | Duration | Easing | GSAP Pattern |
|-----------|-----------|----------|--------|--------------|
| VoiceComposer mount | Enters when mode switches to 'voice' | 200ms | power2.out | `gsap.from(voiceComposerRef.current, { x: 16, opacity: 0, duration: 0.2, ease: 'power2.out' })` |
| VoiceComposer unmount | Exits when mode switches to 'text' | 150ms | power2.in | `gsap.to(voiceComposerRef.current, { x: -16, opacity: 0, duration: 0.15, ease: 'power2.in' })` — animate out before unmounting |
| Transcribing spinner entrance | `idle/recording → transcribing` | 200ms | back.out(1.4) | `gsap.from(spinnerContainerRef.current, { scale: 0, opacity: 0, duration: 0.2, ease: 'back.out(1.4)' })` |
| Transcript preview entrance | `transcribing → review` | 250ms | power2.out | `gsap.from(transcriptBoxRef.current, { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' })` |
| Error state entrance | `transcribing → error` | 200ms | power2.out | `gsap.from(errorCardRef.current, { y: 4, opacity: 0, duration: 0.2, ease: 'power2.out' })` |
| Mic button press (idle) | Scale-down feedback on tap | 100ms | back.out(1.7) | `gsap.from(micBtnRef.current, { scale: 0.9, duration: 0.1, ease: 'back.out(1.7)' })` |
| Voice annotation enters list | After save completes | 250ms | power2.out | `gsap.from(newVoiceItemRef.current, { height: 0, opacity: 0, duration: 0.25, ease: 'power2.out' })` — same as text annotation entrance |
| Audio player reveal | Skeleton → `<audio>` (signed URL ready) | 200ms | power2.out | `gsap.from(audioPlayerRef.current, { opacity: 0, duration: 0.2, ease: 'power2.out' })` |
| Mode toggle switch | Tab color change | CSS only | — | `transition-colors duration-100` Tailwind class — no GSAP needed |

**VoiceComposer exit note:** GSAP `to()` must complete before the component unmounts. Use GSAP `onComplete` callback to trigger unmount:
```js
gsap.to(voiceComposerRef.current, {
  x: -16, opacity: 0, duration: 0.15, ease: 'power2.in',
  onComplete: () => dispatch({ type: 'SET_MODE', mode: 'text' })
})
```

**Recording pulse ring:** `animate-ping` CSS class (Tailwind) — no GSAP. Pure CSS animation is sufficient for a continuous loop. `animate-ping` produces the correct expanding + fading behavior.

### Mobile — react-native-reanimated v3 (Phase 47 additions)

Phase 47 does not introduce new mobile animation contracts. The mic badge is a static View — no entrance animation. Voice annotation rows use the same staggered `FadeInUp.delay(index * 40).duration(200)` from Phase 46.

---

## Copywriting Contract

All copy in French. Tone: professional, direct, sports coaching register. Phase 47 additions below.

### Web — VoiceComposer

| Element | Copy |
|---------|------|
| Mode toggle — Text tab | `Texte` |
| Mode toggle — Voice tab | `Voix` |
| Idle subtext | `Appuyez pour commencer l'enregistrement` |
| Idle cancel button | `Annuler` |
| Recording timer format | `0:03` (M:SS, no leading zero on minutes) |
| Recording subtext | `Enregistrement en cours... Appuyez pour arrêter` |
| Recording cancel button | `Annuler` |
| Transcribing primary text | `Transcription IA en cours...` |
| Transcribing subtext | `Quelques secondes...` |
| Review — label above transcript | `Transcription IA` |
| Review — hint below transcript | `Relisez avant de sauvegarder. Si ce n'est pas correct, ré-enregistrez.` |
| Review — re-record button | `Ré-enregistrer` |
| Review — save button | `Sauvegarder` |
| Error — card text | `La transcription a échoué. Vérifiez votre connexion et réessayez.` |
| Error — re-record button | `Ré-enregistrer` |
| Error — cancel button | `Annuler` |
| Edit pencil — disabled tooltip (Phase 47 scope limit) | `Ré-enregistrement disponible dans une prochaine version` |

### Web — AnnotationPanel (composing header, updated)

| Element | Copy |
|---------|------|
| Panel heading (new, voice mode) | `Nouvelle annotation` (unchanged — same heading for both modes) |
| Panel heading (edit, voice mode) | `Modifier l'annotation` (unchanged) |

### Mobile — VideoPlayerScreen (voice annotation additions)

| Element | Copy |
|---------|------|
| Voice annotation row a11y label | `Annotation vocale à [MM:SS] : [transcript text]` |
| Active card a11y label (voice) | `Commentaire vocal : [transcript text]` |

### Push Notification (voice annotation variant)

Voice annotations use the same push notification as text annotations (Phase 46 D-08). No copy change.

---

## Generated Assets

No Higgsfield-generated assets in this phase. All new visuals are UI chrome (mic button, pulse ring, transcript box, audio player element).

| Asset | Screen | Generator | URL |
|-------|--------|-----------|-----|
| — | — | none | — |

---

## Registry Safety

| Registry | Packages / Blocks Used | Safety Gate |
|----------|------------------------|-------------|
| Browser native | `MediaRecorder` API — no npm package | N/A — browser built-in, no install |
| Existing codebase | `useVocalRecorder.ts` — already in `apps/web/src/components/coach/vocal/` | N/A — already in repo, no new install |
| npm (existing) | `gsap` — already a project dependency | Already approved in Phase 46 |
| HTML5 native | `<audio controls>` — native HTML5 element | N/A — no npm package |

No new npm packages. No shadcn registry. No third-party registries. No vetting gate required.

---

## Technical Notes for Executors

### VoiceComposer as a Child Component

VoiceComposer is a separate file from AnnotationPanel. It is mounted/unmounted by AnnotationPanel when `state.mode === 'voice'` in the composing view. It does NOT have access to `useMediaRemote()` or `useMediaState()` — those are only needed in the parent AnnotationPanel. VoiceComposer only needs `timestampSeconds`, `onVoiceReady`, and `onCancel` props.

### VoiceComposer Exit Animation Timing

Because VoiceComposer unmounts when mode switches back to text, the GSAP exit animation must complete before `unmount`. Pattern:
```tsx
// In AnnotationPanel, when SET_MODE 'text' is dispatched from the toggle:
// 1. Animate VoiceComposer out
// 2. In onComplete: actually dispatch SET_MODE to reducer
// This prevents the component disappearing before the animation completes.
```

### Audio URL Fetch Strategy

Signed audio URLs are fetched when the annotation panel mounts (or when the `list` state is entered). Fetch all signed URLs for voice annotations in a single pass at panel mount time. Store as a local `Map<annotationId, signedUrl>` in the AnnotationPanel component state. Refetch on panel re-mount (the panel is sticky, so this happens once per page load in practice).

The fetch endpoint is `GET /coach/videos/annotations/:annotationId/audio-url` (see D-09 in 47-CONTEXT.md).

If a signed URL fetch fails for one annotation, show the skeleton `animate-pulse` placeholder permanently for that item. Do not show an error state inside the audio player row — the list item remains functional (click still seeks, text is readable). Log the error to the console.

### Storage Path Convention

Audio blobs are stored at: `{athleteId}/annotations/{annotationId}.webm` (or `.mp4` based on MIME type returned by `useVocalRecorder`).

This path lives inside the `coach-videos` Supabase storage bucket, consistent with the video file path `{athleteId}/{videoId}.mp4`.

### Annotation Type Field

The annotation data model gains a `type` field: `'text' | 'voice'`. The frontend must pass `type: 'voice'` when saving a voice annotation, and `type: 'text'` (or omit, defaulting to `'text'`) for text annotations. The list item component switches its rendering based on `annotation.type === 'voice'`.

### Phase 46 Annotation List Item Refactor

The existing text annotation list item rendering should be refactored to a shared `<AnnotationListItem>` component that accepts `annotation: Annotation` and branches on `annotation.type`. This avoids duplicating hover, accent strip, action icon, and click-seek logic.

### Existing v1.9 Voice Route Isolation

`POST /coach/voice/transcribe` and `POST /coach/voice/structure` (v1.9 routes) MUST NOT be modified. The new route is `POST /coach/videos/annotations/transcribe`. The `lib/whisper.ts` extraction is a DRY refactor of the internals of `voice/service.ts` — the public API of v1.9 remains byte-identical.

### Mobile — No Audio Player Rendering

The mobile `VideoPlayerScreen` must not attempt to render `<audio>` elements (they are not valid React Native components). The `annotation.audio_path` field will be present on voice annotations but must be ignored on mobile in Phase 47. Add a comment in code: `// TODO: audio player on mobile — post-v1.13`.

### `useVocalRecorder` Drop-In

`useVocalRecorder.ts` is already fully functional and requires no changes. The VoiceComposer uses it exactly as `VocalRetourPanel.tsx` does. Call `start()` on mic button click; call `stop()` (which returns `Promise<{ blob, mimeType }>`) on stop button click. Upload the returned blob directly to the new Hono route as multipart.

### Character Limit for Voice Annotations

Cleaned transcripts from Claude are 1-2 sentences (D-05). Expected length: 60-200 characters. The existing 2000-character limit (from Phase 46 text annotations) applies to voice annotation content as well. In practice this limit will never be reached for Phase 47 voice transcripts.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: all new copy in French, all VoiceComposer states defined (idle/recording/transcribing/review/error), mode toggle labels, mobile a11y labels
- [ ] Dimension 2 Visuals: all new component states fully specified at component-tree level, voice annotation list item structure explicit, mobile voice row diff explicit
- [ ] Dimension 3 Color: hex values for all new usages (error surface, error border, pulse ring), accent reserved-for additions explicit, no orange on skeletons
- [ ] Dimension 4 Typography: all sizes consistent with Phase 46 scale, no new sizes introduced, usage per element specified
- [ ] Dimension 5 Spacing: mic button diameter documented as exception (64px, non-grid), all other spacing from 4px-grid scale
- [ ] Dimension 6 Registry Safety: no new packages, browser-native MediaRecorder, existing useVocalRecorder hook, no third-party registries

**Approval:** pending
