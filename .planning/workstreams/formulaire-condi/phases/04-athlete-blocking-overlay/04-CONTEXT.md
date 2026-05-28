# Phase 04: Athlete Blocking Overlay (Mobile) — Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A full-screen blocking overlay that intercepts app navigation when the athlete has ≥1 pending conditional form. This phase delivers:

- A `PendingFormsOverlay` component rendered at root layout level in `_layout.tsx` — covers the entire app when active
- Fetch logic: TanStack Query on mount + AppState refetch on foreground resume
- All 4 question type renderers: free text (TextInput), scale 1–10 (tap buttons), yes/no (two buttons), single choice (radio buttons)
- Submit flow: all questions required → `POST /athlete/forms/:instanceId/submit` → advance to next form → fade-out dismiss after last form
- Sequential multi-form counter ("Formulaire 1 / N") with instant replace between forms

The athlete cannot dismiss or skip the overlay under any circumstances. Normal app navigation only restores after all pending forms are submitted.

DB, API (`GET /athlete/forms/pending`, `POST /athlete/forms/:instanceId/submit`), and trigger engine are fully implemented (Phases 01 and 02).

</domain>

<decisions>
## Implementation Decisions

### Fetch Gate & App Launch
- **D-01:** **Optimistic rendering** — the normal app renders immediately on launch. If the pending-forms query returns results, the overlay snaps on top. Brief 200–400ms window where the app is visible before the overlay appears is acceptable.
- **D-02:** **Refetch on AppState `active`** — when the athlete brings the app to the foreground, `queryClient.invalidateQueries(['pending-forms'])` is called to re-check. This handles forms sent while the app is backgrounded. Mirrors the existing AppState listener pattern already in `_layout.tsx`.

### Scale (1–10) Input
- **D-03:** **10 numbered tap buttons in a single row** — no drag slider, no new library dependency. Selected button highlights in `theme.primary` (`#FF5C1A`). Button width adapts to screen width via `flexGrow: 1`.
- **D-04:** **Endpoint labels shown** — static labels below the button row: `Pas du tout` under button 1, `Totalement` under button 10. Aligned with standard survey UX.

### Answer Validation
- **D-05:** **All questions required** — the submit CTA (`[ Valider ]`) stays disabled (grey, opacity 0.4) until every question has an answer:
  - Free text: non-empty string (trimmed)
  - Scale: any button 1–10 selected
  - Yes/No: one of the two options selected
  - Single choice: one option selected
- **D-06:** **Submit error handling via `showAlert`** — if the API call fails, `showAlert('Erreur', 'La soumission a échoué. Vérifie ta connexion.', [{ text: 'Réessayer', onPress: handleSubmit }, { text: 'Annuler', style: 'cancel' }])`. "Annuler" returns the athlete to the completed form (no data loss). Submit button returns to active state.

### Between-Form Transition
- **D-07:** **Instant replace between forms** — after a successful submit, `setCurrentIndex(i + 1)` immediately. Counter updates from "Formulaire 1 / 3" to "Formulaire 2 / 3" without animation. No visual acknowledgment between forms.
- **D-08:** **Fade-out dismiss after last form** — after the final form is submitted and the API returns success, `Animated.timing` fades the overlay opacity from 1 to 0 over 300ms, then `setPendingForms([])` unmounts the modal.

### Claude's Discretion
- Exact visual styling of the Yes/No toggle buttons (two full-width buttons side by side, or a toggle switch)
- Single-choice radio button visual design (circular indicator vs. highlighted option card)
- Whether the form scrolls (for long question lists) or paginates one question per screen — standard `ScrollView` is fine
- Loading indicator style while the submit API call is in flight (spinner on Valider button or full-screen)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workstream Requirements & Roadmap
- `.planning/workstreams/formulaire-condi/REQUIREMENTS.md` — Full 17 requirements; Phase 04 covers MOBILE-01 through MOBILE-05
- `.planning/workstreams/formulaire-condi/ROADMAP.md` — Phase 04 goal, success criteria, and UI hint

### Existing Mobile App Structure
- `apps/mobile/app/(app)/_layout.tsx` — Root layout where overlay must be injected; contains AppState listener, TanStack Query usage, and `NotificationPermissionModal` pattern to mirror
- `apps/mobile/src/components/NotificationPermissionModal.tsx` — Reference pattern: `<Modal presentationStyle="fullScreen" animationType="slide">` with full-screen layout

### Backend API (already implemented — Phases 01 and 02)
- `backend/api/src/routes/forms.ts` — `GET /athlete/forms/pending` (lines 231–277) and `POST /athlete/forms/:instanceId/submit` (lines 278+)
  - Pending response shape: `{ forms: [{ instance_id, form_id, form_title, question_count, questions }] }`
  - Questions shape: `[{ id, type: 'text'|'scale'|'yes_no'|'choice', label, choices?: string[] }]`
  - Submit payload: `{ answers: [{ question_id, value }] }`

### DB Schema (Phase 01 — already implemented)
- `supabase/migrations/` (migration 054 or nearby) — `coach_forms` (questions JSONB), `form_instances` (pending/submitted status), `form_responses` (answers JSONB)

### SDK & Design System
- `packages/plugin-sdk/src/index.ts` — `showAlert`, `useThemeStore`, `useTranslation` exports used in overlay
- `apps/mobile/src/stores/authStore.ts` — `useAuthStore` for `userId` and session, needed for API auth header

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`NotificationPermissionModal`** (`apps/mobile/src/components/NotificationPermissionModal.tsx`) — Full-screen modal pattern with `presentationStyle="fullScreen"`. The `PendingFormsOverlay` should follow the same structure.
- **`useAuthStore`** — Provides `user?.id` and `session.access_token` for API calls (same fetch pattern as `useBrandingBootstrap` in `_layout.tsx`)
- **`useThemeStore`** — `theme.primary`, `theme.background`, `theme.surface`, `theme.text`, `theme.muted`, `theme.border` for all colors
- **`showAlert`** from `@ziko/plugin-sdk` — use instead of RN `Alert.alert` (project-wide convention)
- **`useTranslation`** from `@ziko/plugin-sdk` — for any user-facing strings

### Established Patterns
- **TanStack Query fetch pattern**: `useQuery({ queryKey: [...], queryFn: async () => { const token = session?.access_token; fetch(API_URL + '/...', { headers: { Authorization: 'Bearer ' + token } }) }, enabled: !!userId })`
- **AppState listener**: `AppState.addEventListener('change', (state) => { if (state === 'active') { ... } })` — already in `_layout.tsx`; add `queryClient.invalidateQueries` call there
- **Modal injection in layout**: `<> <Tabs ...> ... </Tabs> <NotificationPermissionModal ... /> </>` — append `<PendingFormsOverlay />` in the same fragment
- **No StyleSheet** — inline style objects or NativeWind classes only (project-wide convention)
- **Animated.timing** — available from `react-native`; no new animation library needed for the fade-out dismiss

### Integration Points
- **`_layout.tsx` return fragment** — add `<PendingFormsOverlay />` alongside `<NotificationPermissionModal />` in the JSX fragment
- **AppState listener** — extend the existing `AppState.addEventListener` effect to also invalidate `['pending-forms']` query on `'active'`
- **`useQuery` key**: `['pending-forms', userId]` — invalidate this key on AppState resume and after each successful submit

</code_context>

<specifics>
## Specific Ideas

- **Scale row visual**:
  ```
  [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ][ 8 ][ 9 ][10]
  Pas du tout                             Totalement
  ```
  Selected button: `backgroundColor: theme.primary`, `color: '#FFF'`. Unselected: `backgroundColor: theme.surface`, `color: theme.text`.

- **Submit button states**:
  - Disabled (any unanswered): `opacity: 0.4`, `backgroundColor: theme.primary`
  - Active (all answered): `opacity: 1.0`, `backgroundColor: theme.primary`
  - Loading (API call in flight): show spinner or reduce opacity

- **Counter display**: `Formulaire {currentIndex + 1} / {totalForms}` — centered at top of the overlay, below safe area.

- **Fade-out on last dismiss**:
  ```tsx
  const fadeAnim = useRef(new Animated.Value(1)).current;
  Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    .start(() => setPendingForms([]));
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Save-and-resume draft answers** — if the athlete closes the app mid-form (force-quit), saved answer state. Not required for v1.14 — the overlay re-presents the form fresh on next launch (pending instance still exists).
- **Offline queue** — submit when back online. Out of scope for v1.14.
- **Form progress bar** per question** — a progress indicator showing "Question 2 / 5". Not in MOBILE-01–05; could be a UX improvement in a follow-on.
- **Pagination vs. scroll** — showing one question at a time (paginated) rather than a scrollable list. Deferred — scroll covers v1.14 requirements.

</deferred>

---

*Phase: 04 — Athlete Blocking Overlay (Mobile)*
*Context gathered: 2026-05-28*
