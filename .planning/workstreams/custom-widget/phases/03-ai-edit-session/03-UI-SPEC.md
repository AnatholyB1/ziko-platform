---
phase: "03"
phase_name: "AI Edit Session"
workstream: "custom-widget"
figma_file_url: "pending — Figma desktop app not connected during this session; all specs are pixel-complete below"
status: "approved"
created: "2026-05-27"
---

# UI-SPEC: Phase 03 — AI Edit Session

## Figma Designs

**Status:** Figma file creation blocked — the MCP server requires the Figma desktop app to be open with an accessible file, and the `create_new_file` planKey could not be resolved in this session. All design specifications below are pixel-complete and sufficient for implementation. No visual decisions are deferred.

### Screens

| Screen | State | Figma Link |
|--------|-------|------------|
| DashboardEditOverlay | Idle (no streaming) | pending |
| DashboardEditOverlay | Streaming / Tool Executing | pending |
| DashboardEditOverlay | Tool Result Applied | pending |
| DashboardEditOverlay | Scope Guard Response | pending |
| Dashboard View | Post-save toast | pending |
| Dashboard View | Customize button visible | pending |

---

## Design Tokens

All tokens are locked from the project design system (MOODBOARD.md + codebase).

### Colors

| Token | Hex | Usage in this phase |
|-------|-----|---------------------|
| `color/background` | `#F7F6F3` | Overlay backdrop scrim base, preview pane background, spinner overlay |
| `color/surface` | `#FFFFFF` | Chat panel background, message bubbles (assistant), top bar |
| `color/surface-muted` | `#F0EFE9` | User message bubble background, input fill, skeleton blocks |
| `color/border` | `#E2E0DA` | Top bar bottom border, panel divider, chat input border |
| `color/primary` | `#FF5C1A` | "Sauvegarder" button background, assistant avatar background, send button, active focus ring |
| `color/text` | `#1C1A17` | All primary text, message content, top bar label |
| `color/text-muted` | `#6B6963` | Caption text, hint text, keyboard shortcut labels, timestamp |
| `color/text-inverse` | `#FFFFFF` | Text on primary buttons, send icon, avatar "Z" |
| `color/success` | `#22C55E` | "Dashboard sauvegardé" toast left border accent |
| `color/destructive` | `#EF4444` | Error state (network failure on save) |

### Typography

Inter font family (system fallback: -apple-system, BlinkMacSystemFont, "Segoe UI").

| Role | Size | Weight | Line Height | Usage in this phase |
|------|------|--------|-------------|---------------------|
| Label/Top Bar | 14px | 500 Medium | 1.4 | "Dashboard • Édition" top bar label |
| Body | 14px | 400 Regular | 1.5 | Message bubble content, chat hint text |
| Label | 13px | 500 Medium | 1.4 | Button text ("Annuler", "Sauvegarder"), input hint |
| Caption | 12px | 400 Regular | 1.4 | "Entrée pour envoyer · Maj+Entrée..." sub-hint, spinner label |

### Spacing (8-point grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space/1` | 4px | Gap between avatar and bubble, badge inner padding |
| `space/2` | 8px | Button horizontal padding (compact), between message bubble elements |
| `space/3` | 12px | Chat message vertical gap (mb-3 = 12px) |
| `space/4` | 16px | Panel horizontal padding, chat list top/bottom padding |
| `space/5` | 20px | Top bar height internal padding |
| `space/6` | 24px | Section gap between messages group |
| `space/8` | 32px | Chat input bar total height |

### Corner Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius/sm` | 6px | Small badges |
| `radius/md` | 8px | Button radius, input radius, spinner container |
| `radius/lg` | 12px | Toast notification |
| `radius/xl` | 16px | Message bubbles (rounded-2xl = 16px) |
| `radius/full` | 9999px | Assistant avatar circle (w-8 h-8 rounded-full) |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow/none` | `none` | Overlay panel (borders only, no shadow) |
| `shadow/lg` | `0 8px 24px rgba(28,26,23,0.10)` | Toast notification |
| `shadow/xl` | `0 16px 40px rgba(28,26,23,0.12)` | Overlay panel drop shadow (right edge of preview pane) |

---

## Layout Specs

### Overall Page Structure (when edit mode active)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CoachSidebar (240px fixed, z-index 10, NOT covered by overlay)              │
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │ DashboardEditOverlay (fills remaining viewport, z-index 20)           │   │
│ │ ┌─────────────────────────────────────────────────────────────────┐   │   │
│ │ │ Top Bar (56px height, bg-white, border-b border-border)         │   │   │
│ │ │ [Dashboard • Édition]  [spacer]  [Annuler]  [Sauvegarder]      │   │   │
│ │ └─────────────────────────────────────────────────────────────────┘   │   │
│ │ ┌─────────────────────────────────┬───────────────────────────────┐   │   │
│ │ │                                 │                               │   │   │
│ │ │  Preview Pane (60% width)       │  Chat Panel (40% width)       │   │   │
│ │ │  bg-background (#F7F6F3)        │  bg-white                     │   │   │
│ │ │  p-6                            │  border-l border-border       │   │   │
│ │ │                                 │                               │   │   │
│ │ │  DashboardGrid                  │  Messages list                │   │   │
│ │ │  (isResizable=false,            │  (flex-1, overflow-y-auto)    │   │   │
│ │ │   isDraggable=false)            │                               │   │   │
│ │ │                                 │  ─────────────────────────    │   │   │
│ │ │                                 │  ChatInputBar (px-6 py-4)     │   │   │
│ │ └─────────────────────────────────┴───────────────────────────────┘   │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Top Bar — Exact Measurements

| Property | Value |
|----------|-------|
| Height | 56px |
| Background | `#FFFFFF` |
| Border bottom | `1px solid #E2E0DA` |
| Horizontal padding | 24px (px-6) |
| Label | "Dashboard • Édition", 14px/600, color `#1C1A17` |
| Label left margin | 0 (flush left) |
| Button group | right-aligned flex row, gap 8px |
| "Annuler" button | Ghost/outline style (see Button Specs) |
| "Sauvegarder" button | Primary filled style (see Button Specs) |

### Preview Pane — Exact Measurements

| Property | Value |
|----------|-------|
| Width | 60% of overlay content width (flex basis 60%) |
| Background | `#F7F6F3` |
| Padding | 24px all sides (p-6) |
| DashboardGrid container | full width of pane, no extra margin |
| Grid cols | 12 (inherited from DashboardGrid) |
| Grid rowHeight | 80px (inherited from DashboardGrid) |
| Grid margin | `[16, 16]` (inherited) |
| isResizable | `false` |
| isDraggable | `false` |

### Chat Panel — Exact Measurements

| Property | Value |
|----------|-------|
| Width | 40% of overlay content width (flex basis 40%) |
| Background | `#FFFFFF` |
| Border left | `1px solid #E2E0DA` |
| Messages area | flex-1, overflow-y-auto, padding 16px horizontal / 16px top |
| Message mb spacing | 12px (mb-3) between each bubble |
| ChatInputBar area | fixed at bottom, px-6 py-4, border-top `1px solid #E2E0DA` |

### Button Specs (Top Bar)

**"Annuler" — Ghost/Outline:**
| Property | Value |
|----------|-------|
| Height | 36px |
| Horizontal padding | 16px |
| Background | transparent |
| Border | `1px solid #E2E0DA` |
| Border radius | 8px |
| Text | 13px/500, `#1C1A17` |
| Hover state | background `#F0EFE9`, border `#E2E0DA` |
| Active state | background `#E2E0DA` |

**"Sauvegarder" — Primary Filled:**
| Property | Value |
|----------|-------|
| Height | 36px |
| Horizontal padding | 16px |
| Background | `#FF5C1A` |
| Border radius | 8px |
| Text | 13px/500, `#FFFFFF` |
| Hover state | opacity 0.9 |
| Loading state | disabled + spinner icon replaces text |
| Disabled state | opacity 0.4, cursor not-allowed |

---

## State Specifications

### State 1: Idle (No Streaming)

**Preview Pane:**
- DashboardGrid renders normally with `pendingWidgets` (initialized = saved config)
- No overlay, no spinner — live widget cards with real data
- WidgetCard chrome: `bg-white rounded-2xl border border-border p-5`

**Chat Panel — Message List:**
- Opening message visible as an assistant bubble (static, no API call)
- Opening message content (exact copy):
  > "Votre dashboard affiche actuellement : [widget 1, widget 2, widget 3...]. Dites-moi ce que vous souhaitez modifier. Exemples : 'Mettez le score de sommeil en premier', 'Supprimez la note', 'Ajoutez un graphe de poids sur 30 jours'."
- Message bubble: assistant style — `w-8 h-8 bg-primary rounded-full` avatar ("Z" label, white), then `bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-2 max-w-[640px]`
- No user messages in initial state

**Chat Panel — Input:**
- ChatInputBar fully enabled
- Placeholder: "Décrivez ce que vous souhaitez modifier..."
- Send button: active orange `#FF5C1A`

---

### State 2: Streaming / Tool Executing

**Preview Pane:**
- Spinner overlay displayed on top of DashboardGrid
- Overlay: `absolute inset-0 bg-[#F7F6F3]/80 flex items-center justify-center rounded-md`
- Spinner: 24px animated spinner circle, border-color `#FF5C1A`, border-width 2px, border-top transparent (CSS spin animation 0.8s linear infinite)
- Label below spinner: "Mise à jour du dashboard...", 12px/400, color `#6B6963`, margin-top 8px
- DashboardGrid still rendered beneath (blurred through the backdrop)

**Chat Panel — Messages:**
- User message bubble: right-aligned, `bg-[#F0EFE9] rounded-2xl rounded-tr-sm px-4 py-2 max-w-[640px] ml-auto`
- Typing indicator (assistant): left-aligned, `bg-white border border-border rounded-2xl rounded-tl-sm px-4 py-2`
- Typing indicator content: three animated dots
  - Three circles, 6px diameter each, `bg-[#6B6963]`, gap 4px
  - Each dot: `opacity 0.3 → 1 → 0.3`, staggered 200ms apart, 900ms cycle (sinusoidal)

**Chat Panel — Input:**
- ChatInputBar: `disabled={true}`
- Send button: opacity 0.4, cursor not-allowed
- Textarea: opacity 0.4, cursor not-allowed
- Sub-hint text: "Claude réfléchit..." replacing the keyboard shortcut hint

---

### State 3: Tool Result Applied

**Preview Pane:**
- Spinner overlay removed instantly (no animation — snap removal per D-09)
- DashboardGrid re-renders with updated `pendingWidgets` (new widget array from `tool_result` event)
- Widget change is immediate — no transition animation on the grid itself
- Grid scrolls to show newly added/moved widget if it's below the fold (smooth scroll)

**Chat Panel — Messages:**
- Typing indicator removed
- Assistant confirmation message appears as a new bubble (streamed, `chunk` events)
- Example confirmation: "C'est fait. J'ai déplacé le score de sommeil en première position."
- ChatInputBar re-enabled (disabled → enabled transition: instant)

---

### State 4: Scope Guard Response

**Preview Pane:**
- No change from previous state (no tool call was made)
- No spinner, no reload

**Chat Panel — Messages:**
- User message bubble visible (coaching question, e.g., "Comment va Mathieu ?")
- Assistant message: "Cette session est réservée à la configuration du dashboard. Pour vos questions coaching, fermez l'éditeur."
- This assistant bubble has no avatar distinction — same styling as a normal assistant bubble
- No visual warning or destructive styling — neutral, informational

---

### State 5: Dashboard View — Post-Save Toast

**Layout:**
- DashboardEditOverlay unmounted entirely (isEditing = false)
- Full DashboardGrid visible in view mode (isResizable=false, isDraggable=false)
- Top bar from the normal dashboard/page.tsx (not the edit overlay's bar)

**Toast Notification:**
| Property | Value |
|----------|-------|
| Position | Fixed, bottom-right: `fixed bottom-6 right-6` |
| Width | 320px |
| Background | `#FFFFFF` |
| Border radius | 12px (rounded-xl) |
| Left border | `4px solid #22C55E` (success green) |
| Shadow | `0 8px 24px rgba(28,26,23,0.10)` |
| Padding | 16px |
| Z-index | 50 |
| Auto-dismiss | 3000ms after appearing |

**Toast content layout (row):**
- Left icon area: 20px × 20px checkmark circle, fill `#22C55E`
- Content area (flex-1): "Dashboard sauvegardé" in 14px/600, color `#1C1A17`; below it "Annuler" link-style button in 13px/500, color `#FF5C1A`, cursor pointer
- Right: optional dismiss "×" button, 16px, color `#6B6963`

**Toast animations:**
- Enter: slide in from bottom-right (`y: 16 → 0`, `opacity: 0 → 1`, 200ms, power2.out)
- Auto-dismiss: fade out (`opacity: 1 → 0`, 200ms, power2.in) after 3s

---

### State 6: Dashboard View — Customize Button Visible

**"Personnaliser" Button — exact spec:**
| Property | Value |
|----------|-------|
| Position | Top-right of the dashboard content area (inside page header row) |
| Style | Ghost/outline (secondary) — same as "Annuler" in the overlay |
| Height | 36px |
| Horizontal padding | 16px |
| Border | `1px solid #E2E0DA` |
| Background | transparent |
| Hover | background `#F0EFE9` |
| Border radius | 8px |
| Icon | `pencil-outline` (Ionicons, 14px, color `#1C1A17`) |
| Text | "Personnaliser", 13px/500, `#1C1A17` |
| Icon-text gap | 8px |
| Click action | Sets `isEditing = true`, triggers GSAP overlay entrance |

**Button placement in page.tsx header row:**
```
[Client Name / Dashboard heading]    [spacer]    [Personnaliser button]
```
The button is always visible when `isEditing === false`. Single tap = instant edit mode entry.

---

## Component Inventory

### Reused As-Is (no modifications)

| Component | Source | Usage in Phase 03 |
|-----------|--------|-------------------|
| `ChatInputBar.tsx` | `components/coach/ChatInputBar.tsx` | Bottom of chat panel; `disabled` prop wired to `isStreaming` state |
| `MessageBubble.tsx` | `components/coach/MessageBubble.tsx` | All chat messages (user + assistant); typing indicator is a new inline component |
| `DashboardGrid.tsx` | `components/coach/dashboard/DashboardGrid.tsx` | Preview pane with `isEditMode={false}` (view-only) |
| `WidgetRenderer.tsx` | `components/coach/dashboard/WidgetRenderer.tsx` | Renders each widget inside preview grid |
| All 7 `*Widget.tsx` | `components/coach/dashboard/widgets/` | Rendered by WidgetRenderer in the preview pane |
| `WidgetCard.tsx` | `components/coach/dashboard/widgets/WidgetCard.tsx` | Widget chrome in preview pane |

### New Components — Phase 03

| Component | Path | Responsibility |
|-----------|------|----------------|
| `DashboardEditOverlay.tsx` | `components/coach/dashboard/DashboardEditOverlay.tsx` | Full-viewport overlay shell; GSAP fade entrance; top bar; 60/40 split layout |
| `EditChatPanel.tsx` | `components/coach/dashboard/EditChatPanel.tsx` | Chat panel: message list + opening message + ChatInputBar; SSE stream consumer |
| `TypingIndicator.tsx` | `components/coach/dashboard/TypingIndicator.tsx` | Animated 3-dot typing indicator for assistant streaming state |
| `PreviewLoadingOverlay.tsx` | `components/coach/dashboard/PreviewLoadingOverlay.tsx` | Semi-transparent backdrop + spinner + "Mise à jour..." label on preview pane |
| `SaveToast.tsx` | `components/coach/dashboard/SaveToast.tsx` | Fixed-position success toast with Undo link; GSAP slide-in/fade-out |

### Modified Components — Phase 03

| Component | Modification |
|-----------|-------------|
| `dashboard/page.tsx` | Add `isEditing` state, `previousConfig` ref; render `<DashboardEditOverlay>` conditionally; add "Personnaliser" button to header; pass `onSave`/`onCancel` handlers |

---

## Motion Design

### GSAP Contracts

**1. Overlay Entrance (DashboardEditOverlay mount)**

```typescript
// Fires in useEffect on mount
gsap.from(overlayRef.current, {
  opacity: 0,
  duration: 0.15,
  ease: 'power2.out',
});
```
- Duration: 150ms
- Easing: power2.out
- No y-offset (flat fade only — per D-09: "opacity 0→1, 150ms, power2.out")
- No exit animation — overlay unmounts instantly on Save/Cancel (D-09: "Exits instantly")

**2. Toast Enter (SaveToast mount)**

```typescript
gsap.from(toastRef.current, {
  y: 16,
  opacity: 0,
  duration: 0.2,
  ease: 'power2.out',
});
```
- Duration: 200ms
- Easing: power2.out
- Y offset: 16px (slides up from below)

**3. Toast Auto-Dismiss (after 3000ms)**

```typescript
gsap.to(toastRef.current, {
  opacity: 0,
  duration: 0.2,
  ease: 'power2.in',
  onComplete: () => setToastVisible(false),
});
```
- Duration: 200ms
- Easing: power2.in
- Triggers unmount via `onComplete`

**4. Send Button Press Feedback (ChatInputBar — already implemented)**

```typescript
// Already in ChatInputBar.tsx — no change needed
gsap.to(sendBtnRef.current, {
  scale: 0.94,
  duration: 0.1,
  yoyo: true,
  repeat: 1,
  ease: 'power3.out',
});
```

**5. Typing Indicator Dots (TypingIndicator component)**

```typescript
// CSS animation preferred for the dots (simpler, no GSAP dependency needed)
// Each dot: animation: 'typing-dot 0.9s ease-in-out infinite'
// Dot 1: animation-delay: 0ms
// Dot 2: animation-delay: 200ms
// Dot 3: animation-delay: 400ms

// CSS keyframes:
// @keyframes typing-dot {
//   0%, 100% { opacity: 0.3; transform: translateY(0); }
//   50% { opacity: 1; transform: translateY(-3px); }
// }
```
- Cycle: 900ms sinusoidal
- Stagger: 200ms per dot

**6. "Sauvegarder" Button Loading State**

```typescript
// No GSAP — inline spinner replaces text via React state
// isLoading: true → show 16px spin animation (CSS), disabled
// isLoading: false → show "Sauvegarder" text
```

**7. Preview Spinner Entrance / Exit**

```typescript
// Spinner overlay: no GSAP — CSS opacity transition on mount/unmount
// appear: opacity 0 → 1 in 100ms
// disappear: instant (snap) — no fade out on tool result arrival
// RATIONALE: Per D-09, the "Exits instantly" philosophy extends to the spinner
// to give a crisp "result is ready" moment
```

**8. Message Bubble Entrance (new messages)**

```typescript
// Each new MessageBubble appended to list gets a brief entrance
gsap.from(newBubbleRef.current, {
  y: 8,
  opacity: 0,
  duration: 0.15,
  ease: 'power2.out',
});
```
- Duration: 150ms
- Y offset: 8px up
- Applied to every new bubble (user message after send, assistant confirmation)

---

## Copywriting

All UI strings in French. No English strings in the UI layer.

### Top Bar

| Element | String |
|---------|--------|
| Title label | `Dashboard • Édition` |
| Cancel button | `Annuler` |
| Save button (idle) | `Sauvegarder` |
| Save button (loading) | *(spinner, no text)* |

### Chat Panel

| Element | String |
|---------|--------|
| ChatInputBar placeholder | `Décrivez ce que vous souhaitez modifier...` |
| Keyboard hint (idle) | `Entrée pour envoyer · Maj+Entrée pour nouvelle ligne` |
| Keyboard hint (streaming) | `Claude réfléchit...` |
| Opening message (exact) | `Votre dashboard affiche actuellement : [widget 1, widget 2, widget 3...]. Dites-moi ce que vous souhaitez modifier. Exemples : 'Mettez le score de sommeil en premier', 'Supprimez la note', 'Ajoutez un graphe de poids sur 30 jours'.` |

### Preview Pane

| Element | String |
|---------|--------|
| Spinner label | `Mise à jour du dashboard...` |

### Toast Notification

| Element | String |
|---------|--------|
| Success message | `Dashboard sauvegardé` |
| Undo link | `Annuler` |
| Error message (save failed) | `Erreur lors de la sauvegarde. Réessayer ?` |

### Scope Guard Message (assistant bubble)

| Context | Exact string |
|---------|-------------|
| Off-topic question detected | `Cette session est réservée à la configuration du dashboard. Pour vos questions coaching, fermez l'éditeur.` |

### Customize Button

| Element | String |
|---------|--------|
| Button label | `Personnaliser` |

---

## State Machine

```
dashboard/page.tsx
│
├── [isEditing = false] ──────────────────────────────────────────────────
│   │
│   ├── DashboardGrid (view mode)
│   │   isResizable=false, isDraggable=false
│   │
│   └── "Personnaliser" button (top-right)
│       onClick → setIsEditing(true), store previousConfig in ref
│                 GSAP overlay entrance fires
│
└── [isEditing = true] ───────────────────────────────────────────────────
    │
    └── DashboardEditOverlay
        │
        ├── Top Bar
        │   ├── "Annuler" → setIsEditing(false) [INSTANT, no animation]
        │   │               pendingWidgets discarded (component unmounts)
        │   └── "Sauvegarder" → PUT /coach/dashboards/:clientId
        │                        → setIsEditing(false)
        │                        → show SaveToast (3s)
        │                        → update useDashboardConfig cache
        │
        ├── Preview Pane (left 60%)
        │   ├── [isStreaming=false] → DashboardGrid (view mode)
        │   │                          renders pendingWidgets
        │   └── [isStreaming=true]  → DashboardGrid + PreviewLoadingOverlay
        │
        └── EditChatPanel (right 40%)
            │
            ├── [INITIAL] → Opening message (static system bubble)
            │
            ├── User types → send → POST /coach/dashboards/:clientId/ai-edit
            │                       { messages, currentWidgets: configRef.current }
            │               → setIsStreaming(true)
            │               → ChatInputBar disabled
            │
            ├── [SSE: chunk] → stream assistant text into TypingIndicator/bubble
            │
            ├── [SSE: tool_result] → configRef.current = event.widgets
            │                        setPendingWidgets(event.widgets)
            │                        setIsStreaming(false)
            │                        → PreviewLoadingOverlay removed (instant)
            │                        → ChatInputBar re-enabled
            │
            └── [SSE: DONE] → conversation history appended
                              appendMessages(conversationId, response.messages)
                              isStreaming = false (idempotent)
```

---

## API Contract (UI perspective)

### SSE Endpoint

```
POST /coach/dashboards/:clientId/ai-edit
Authorization: Bearer <jwt>
Content-Type: application/json

Body: {
  messages: Message[],        // full conversation history
  currentWidgets: Widget[]    // configRef.current (pending state, not DB state)
}
```

### SSE Event Types (frontend handler)

| Event `type` | Payload | Frontend action |
|-------------|---------|----------------|
| `meta` | `{ conversation_id: string }` | Store conversationId in ref |
| `chunk` | `{ content: string }` | Append to current assistant message buffer |
| `tool_result` | `{ widgets: Widget[] }` | Update `configRef.current` + `setPendingWidgets` + `setIsStreaming(false)` |
| `error` | `{ message: string }` | Show error state in chat panel; re-enable input |
| `[DONE]` | — | Call `appendMessages`; final `setIsStreaming(false)` |

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|---------------|
| Chat input label | `<label htmlFor="chat-input" className="sr-only">Message de configuration du dashboard</label>` |
| "Annuler" button | `aria-label="Annuler et fermer l'éditeur"` |
| "Sauvegarder" button | `aria-label="Sauvegarder la configuration du dashboard"` (loading: add `aria-busy="true"`) |
| Send button | `aria-label="Envoyer le message"` (already in ChatInputBar) |
| Overlay role | `role="dialog" aria-modal="true" aria-label="Éditeur de dashboard"` |
| Focus trap | Focus locked inside overlay when isEditing=true; returns to "Personnaliser" button on close |
| Spinner | `role="status" aria-label="Mise à jour du dashboard en cours"` |
| Toast | `role="status" aria-live="polite"` |
| Min touch targets | All buttons: min 36px height (36px × min-content width), satisfies 36px practical minimum for web |

---

## Acceptance Criteria

Verifiable checklist matching Phase 03 success criteria from ROADMAP.md:

**EDIT-01 — Split-screen overlay**
- [ ] Clicking "Personnaliser" renders the split-screen overlay with preview left (60%) + chat right (40%)
- [ ] CoachSidebar remains visible outside the overlay (not covered)
- [ ] Top bar shows "Dashboard • Édition" label + "Annuler" + "Sauvegarder" buttons
- [ ] Overlay enters with GSAP opacity 0→1, 150ms, power2.out
- [ ] No intermediate states visible during entrance

**EDIT-02 — Live preview via Claude tool calls**
- [ ] Typing "Add a weight progression chart for the last 30 days" causes Claude to call `add_widget`
- [ ] Widget appears in the preview pane within 5 seconds
- [ ] No broken JSON states visible during streaming (atomic update from `tool_result` event only)
- [ ] Spinner overlay ("Mise à jour du dashboard...") is visible during tool execution
- [ ] ChatInputBar is disabled during streaming

**EDIT-03 — Preview reflects pending changes**
- [ ] All add/update/remove/reorder changes visible in preview before Save
- [ ] Original dashboard config unmodified until Save is clicked
- [ ] Cancel discards all pending changes (no confirmation dialog)

**EDIT-04 — Save and Cancel**
- [ ] Save: PUT /coach/dashboards/:clientId succeeds → overlay closes instantly → SaveToast appears
- [ ] SaveToast dismisses after 3 seconds
- [ ] SaveToast "Annuler" link reverts to previousConfig (one-tap undo)
- [ ] Cancel: overlay unmounts instantly, no animation, no confirmation dialog
- [ ] No auto-save during edit session (changes only persist on explicit Save)

**EDIT-05 — Scope guard**
- [ ] Off-topic coaching question returns scope guard message in French
- [ ] No tool call made for off-topic questions
- [ ] Preview pane unchanged after scope guard response

**INFRA-02b — Multi-turn integration test (D-18)**
- [ ] Turn 1: `add_widget` called, widget appears in preview, `response.messages` appended
- [ ] Turn 2: `update_widget` on widget from turn 1, history correctly referenced
- [ ] `configRef.current` matches `pendingWidgets` state after every `tool_result` event
- [ ] Tool handler reads from `configRef.current`, never from React state variable

**PITFALLS checklist (all 15 items from PITFALLS.md)**
- [ ] Widget schema has `additionalProperties: false` — no `any` types
- [ ] No 8th widget type discussed or implemented
- [ ] Tool call uses `streamText` + `onStepFinish` (atomic result) — NOT raw streamed JSON to preview
- [ ] Preview pane shows live widget data, never JSON/IDs/position numbers
- [ ] No confirmation dialog before any dashboard change
- [ ] Chat refuses non-dashboard questions (scope guard active)
- [ ] No undo stack / history feature (single `previousConfig` ref only)
- [ ] `schema_version: 1` present in all stored configs
- [ ] `response.messages` appended after every turn (including tool-call turns)
- [ ] Tool handler reads `configRef.current`, not React state
- [ ] "Personnaliser" entry point is 1 tap from dashboard view (always visible)
- [ ] Opening message is concrete (lists current widgets + 3 examples)
- [ ] `stopWhen: stepCountIs(2)` used (not 5)
- [ ] No auto-save during editing
- [ ] Widget set not marked as "extensible later" in any code comment

---

## Implementation Notes for Executor

### Critical: stale closure prevention

```typescript
// DashboardEditOverlay.tsx — BOTH must be updated together on every tool_result
const [pendingWidgets, setPendingWidgets] = useState<Widget[]>(initialWidgets);
const configRef = useRef<Widget[]>(initialWidgets);

// In SSE handler:
case 'tool_result': {
  configRef.current = event.widgets;   // sync update (no closure issue)
  setPendingWidgets(event.widgets);    // triggers re-render
  setIsStreaming(false);
  break;
}
```

### Critical: request body construction

```typescript
// Each POST must include configRef.current (not pendingWidgets state)
// because the SSE callback may close over a stale state value
const body = {
  messages: conversationHistory,
  currentWidgets: configRef.current, // always current, never stale
};
```

### DashboardGrid in preview mode

```typescript
// In DashboardEditOverlay preview pane:
<DashboardGrid
  widgets={pendingWidgets}
  clientId={clientId}
  isEditMode={false}      // disable drag/resize
  onLayoutSaved={undefined} // no auto-save in preview
/>
```

### Opening message rendering

The opening message is rendered as a static `Message` object pre-populated in the messages array on component mount — no API call needed:

```typescript
const OPENING_MESSAGE: Message = {
  id: 'system-opening',
  role: 'assistant',
  content: `Votre dashboard affiche actuellement : ${currentWidgetNames.join(', ')}. Dites-moi ce que vous souhaitez modifier. Exemples : 'Mettez le score de sommeil en premier', 'Supprimez la note', 'Ajoutez un graphe de poids sur 30 jours'.`,
};
const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
```

`currentWidgetNames` is derived from `initialWidgets.map(w => w.config.title ?? w.type)`.

### Save handler

```typescript
async function handleSave() {
  setIsSaving(true);
  try {
    await fetch(`${API_URL}/coach/dashboards/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      credentials: 'include',
      body: JSON.stringify({ widgets: configRef.current }),
    });
    onSave(configRef.current);   // updates parent useDashboardConfig cache
    setIsEditing(false);         // unmounts overlay instantly
    setToastVisible(true);       // triggers SaveToast GSAP entrance
  } catch {
    // show error toast (same position, destructive border color)
  } finally {
    setIsSaving(false);
  }
}
```

---

## Pre-Populated From

| Source | Decisions Used |
|--------|---------------|
| CONTEXT.md (03-CONTEXT.md) | D-01 through D-18 — all implementation decisions locked |
| MOODBOARD.md | Visual palette, typography scale, motion personality (snappy+fluid), shadow philosophy, corner radius |
| REQUIREMENTS.md | EDIT-01 through EDIT-05, INFRA-02b |
| PITFALLS.md | 15-item checklist integrated into acceptance criteria |
| 02-CONTEXT.md | DashboardGrid props (isEditMode, onLayoutSaved), WidgetCard chrome pattern, data fetch patterns |
| Codebase reads | ChatInputBar.tsx, MessageBubble.tsx, DashboardGrid.tsx exact props and styling |
| User input | 0 (all decisions pre-answered in upstream artifacts) |
