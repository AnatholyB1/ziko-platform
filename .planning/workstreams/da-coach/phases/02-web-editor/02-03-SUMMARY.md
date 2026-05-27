---
phase: 02-web-editor
plan: "03"
subsystem: da-coach/branding-client
tags: [next.js, gsap, branding, pro-gate, toast, client-component]
dependency_graph:
  requires:
    - 02-01-SUMMARY.md  # page.tsx route + server data fetch
    - 02-02-SUMMARY.md  # ColorPickerInput, LogoUpload, ToneSelector, BrandingPreviewCard
  provides:
    - BrandingClient.tsx  # orchestrator making /coach/branding fully functional end-to-end
  affects:
    - apps/web/src/app/[locale]/(coach)/coach/branding/page.tsx  # imports BrandingClient
tech_stack:
  added: []
  patterns:
    - "'use client' orchestrator assembling 4 sub-components with controlled state"
    - "JWT fetched via createClientSupabase().auth.getSession() in useEffect"
    - "GSAP page entrance with stagger (.branding-section) + delayed preview (.preview-card)"
    - "Auto-dismissing toast (3s) with GSAP entrance/exit animations"
    - "Pro gate: isPro prop controls Save button vs upgrade CTA — no form lockout"
key_files:
  created:
    - apps/web/src/app/[locale]/(coach)/coach/branding/BrandingClient.tsx
  modified: []
decisions:
  - "GSAP keyframes array syntax replaced by fromTo+keyframes object to satisfy TypeScript (TweenValue constraint)"
  - "Toast entrance fires via setTimeout(0) microtask to ensure DOM is rendered before GSAP targets the className"
  - "No loading gate on JWT — page renders immediately, Save button is just disabled until JWT resolves"
metrics:
  duration: "384s"
  completed: "2026-05-27"
  tasks_completed: 1
  files_created: 1
---

# Phase 02 Plan 03: BrandingClient Orchestrator — SUMMARY

**One-liner:** `'use client'` orchestrator assembling 4 sub-components with PATCH save, Pro gate button swap, GSAP stagger entrance, and auto-dismissing success/error toasts.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | BrandingClient — state, 2-column layout, GSAP page entrance | 2ce3bb5 | BrandingClient.tsx (232 lines) |

---

## What Was Built

`apps/web/src/app/[locale]/(coach)/coach/branding/BrandingClient.tsx` — the integration layer making `/coach/branding` fully functional:

**State management:**
- `primaryColor`, `logoPath`, `tone` — controlled state wired into sub-components via callbacks + fed into `BrandingPreviewCard` for live preview
- `jwt` — fetched once on mount from `createClientSupabase().auth.getSession()`
- `saving`, `toast`, `toastVisible` — UI feedback state

**2-column grid layout** (`grid lg:grid-cols-2 gap-8`):
- Left: ColorPickerInput → LogoUpload → ToneSelector → Action row
- Right: BrandingPreviewCard (sticky top-10)

**`handleSave` — PATCH /coach/branding:**
1. Guard against double-submit
2. GSAP scale press feedback on `.save-btn`
3. `fetch(${API_URL}/coach/branding, { method: 'PATCH', Authorization: Bearer ${jwt} })`
4. Success → `showToast('success', 'Direction artistique enregistrée.')`
5. Error → `showToast('error', "Erreur lors de l'enregistrement. Réessayez.")` + GSAP shake on `.save-btn`

**Pro gate (isPro prop):**
- `isPro=true`: Save button with `aria-busy={saving}`, disabled while saving or no jwt
- `isPro=false`: "Passer en Pro" CTA with `IoSparklesOutline` icon, redirects to `/coach/settings?tab=subscription` — all form controls remain interactive

**GSAP animations:**
- Page mount: `.branding-section` stagger (y:20, 0.25s, stagger:0.06, delay:0.05)
- Page mount: `.preview-card` delayed entrance (y:16, 0.3s, delay:0.2)
- Save press: scale 0.97 yoyo on `.save-btn`
- Error shake: `fromTo` + keyframes on `.save-btn`
- Toast entrance: `from({y:20, opacity:0})` via setTimeout(0) after state set
- Toast exit: `to({y:10, opacity:0})` after 3s auto-dismiss

**Toast:** fixed bottom-right overlay, `role="status" aria-live="polite"`, green check for success, red for error, auto-dismisses after 3s.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error on GSAP x array syntax**
- **Found during:** Task 1 — TypeScript compilation
- **Issue:** `gsap.to('.save-btn', { x: [-4, 4, -3, 3, 0] })` produces TS2322 — `number[]` not assignable to `TweenValue`
- **Fix:** Replaced with `gsap.fromTo('.save-btn', { x: -4 }, { x: 0, keyframes: [...] })` matching the pattern used in `LogoUpload.tsx`
- **Files modified:** BrandingClient.tsx
- **Commit:** 2ce3bb5

---

## Verification

TypeScript: 0 errors across all Phase 2 branding files (`rtk tsc --noEmit` passed).

All acceptance criteria confirmed present in file:
- `'use client'` directive ✓
- `handleSave` function ✓
- `PATCH` method in fetch ✓
- `Authorization: \`Bearer ${jwt}\`` ✓
- `${API_URL}/coach/branding` URL ✓
- `isPro` in prop interface ✓
- Conditional Save button (`isPro=true`) ✓
- Conditional "Passer en Pro" CTA (`isPro=false`) ✓
- "Enregistrer" / "Enregistrement…" copy ✓
- "Passer en Pro" copy ✓
- "Passez en Pro pour sauvegarder votre direction artistique." copy ✓
- "Direction artistique enregistrée." success toast ✓
- "Erreur lors de l'enregistrement. Réessayez." error toast ✓
- `success-toast` / `error-toast` classNames ✓
- `role="status" aria-live="polite"` on toast ✓
- `aria-busy={saving}` on save button ✓
- GSAP `.branding-section` stagger ✓
- GSAP `.preview-card` entrance ✓
- GSAP `save-btn` scale press ✓
- GSAP `save-btn` error shake ✓
- Imports: ColorPickerInput, LogoUpload, ToneSelector, BrandingPreviewCard ✓
- `grid lg:grid-cols-2 gap-8` layout ✓
- `fixed bottom-6 right-6 z-50` toast position ✓

---

## Known Stubs

None — all sub-components are real implementations wired to live state.

---

## Threat Flags

No new threat surface beyond what was assessed in the plan's threat model. The `isPro` gate is cosmetic UI only — the backend 403 is the real enforcement gate (T-02-06 documented in plan).

---

## Self-Check: PASSED

- File exists: `apps/web/src/app/[locale]/(coach)/coach/branding/BrandingClient.tsx` ✓
- Commit exists: `2ce3bb5` (includes BrandingClient.tsx as new file, 232 lines) ✓
- TypeScript: 0 errors ✓
