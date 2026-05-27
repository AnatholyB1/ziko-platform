---
phase: 02-web-editor
plan: 02
subsystem: ui
tags: [react, tailwind, gsap, supabase-storage, react-icons]

# Dependency graph
requires:
  - phase: 02-01
    provides: "CoachSidebar nav item + branding page route scaffold"
provides:
  - ColorPickerInput: hex input + live swatch + 5 color presets + GSAP animations
  - LogoUpload: direct upload to coach-logos public bucket (PNG/SVG, 2MB) + GSAP animations
  - ToneSelector: 4-pill radiogroup (motivant/analytique/bienveillant/exigeant) + GSAP press feedback
  - BrandingPreviewCard: purely prop-driven preview card — accent bar, logo circle, tone badge, status dot
affects: [02-03-BrandingClient]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GSAP fromTo on class selector for swatch activation (useRef tracks previous validity)"
    - "GSAP keyframes array for error shake animation"
    - "Direct Supabase Storage upload (no signed URL) for public buckets"
    - "displayUrl derived on render from currentPath prop — not stored in state"
    - "Tone pill uses role=radio + aria-checked for accessible radiogroup"

key-files:
  created:
    - apps/web/src/components/coach/ColorPickerInput.tsx
    - apps/web/src/components/coach/LogoUpload.tsx
    - apps/web/src/components/coach/ToneSelector.tsx
    - apps/web/src/components/coach/BrandingPreviewCard.tsx
  modified: []

key-decisions:
  - "GSAP shake uses keyframes array on fromTo instead of x: number[] (TypeScript TweenValue constraint)"
  - "LogoUpload displayUrl derived each render via getPublicUrl — avoids stale state when currentPath prop updates"
  - "BrandingPreviewCard creates Supabase client per render call for getPublicUrl — acceptable since no async call is made"

patterns-established:
  - "Pattern: branding-section className on all section card wrappers — enables BrandingClient page-entrance stagger animation"
  - "Pattern: GSAP animations fire on specific className selectors (.color-swatch, .logo-avatar-img, .preview-logo) — BrandingClient must not reuse these classNames elsewhere"

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-04]

# Metrics
duration: 15min
completed: 2026-05-27
---

# Phase 02 Plan 02: Branding Sub-Components Summary

**Four self-contained branding editor sub-components — ColorPickerInput (hex + swatch + presets), LogoUpload (public bucket direct upload), ToneSelector (4-pill radiogroup), BrandingPreviewCard (purely prop-driven preview) — with full GSAP motion contracts**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-27T12:12:00Z
- **Completed:** 2026-05-27T12:27:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- ColorPickerInput: validates `^#[0-9A-Fa-f]{6}$` inline, swatch activates with `back.out(1.4)` pop on transition invalid→valid, 5 preset dots with GSAP press feedback, full ARIA
- LogoUpload: direct `supabase.storage.from('coach-logos').upload()` (no signed URL), PNG+SVG, 2MB guard, upsert:true, GSAP logo appear + keyframes-based error shake
- ToneSelector: 4-pill ARIA radiogroup with `role=radiogroup` / `role=radio` / `aria-checked`, GSAP `scale:0.97` press feedback on each pill
- BrandingPreviewCard: accent bar with `transition-colors duration-150`, logo circle, tone badge with `${validColor}15` alpha tint, GSAP logo appear when `logoPath` transitions null→non-null

## Task Commits

1. **Task 1: ColorPickerInput and ToneSelector components** - `9bd4428` (feat)
2. **Task 2: LogoUpload and BrandingPreviewCard components** - `9bd4428` (feat)

Both tasks committed together in a single atomic commit per plan instructions.

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/web/src/components/coach/ColorPickerInput.tsx` — Hex input + live swatch + 5 presets + GSAP
- `apps/web/src/components/coach/ToneSelector.tsx` — 4-pill tone radiogroup + GSAP press feedback
- `apps/web/src/components/coach/LogoUpload.tsx` — Direct-upload to coach-logos bucket + GSAP
- `apps/web/src/components/coach/BrandingPreviewCard.tsx` — Purely prop-driven preview card + GSAP

## Decisions Made

- GSAP `x: [-4, 4, -3, 3, 0]` array is not typed as `TweenValue` in the GSAP v3 TypeScript definitions — switched to `keyframes` syntax on `fromTo` to satisfy TypeScript without changing the animation behaviour.
- `displayUrl` in LogoUpload is derived on every render via `getPublicUrl` (synchronous, no network call) rather than stored in state — this ensures the display URL stays in sync when `currentPath` prop changes after parent re-render.
- `BrandingPreviewCard` calls `createClientSupabase()` inline to derive `logoUrl` — since `getPublicUrl` is synchronous (constructs the URL from the known bucket config, no fetch), this is safe and keeps the component purely prop-driven.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GSAP shake animation TypeScript error**
- **Found during:** Task 2 (LogoUpload)
- **Issue:** `gsap.to('.logo-upload-error', { x: [-4, 4, -3, 3, 0], ... })` — TypeScript reports `Type 'number[]' is not assignable to type 'TweenValue | undefined'` because GSAP's type definitions do not accept raw number arrays on individual tween properties.
- **Fix:** Changed to `gsap.fromTo(..., { x: -4 }, { x: 0, keyframes: [{ x: -4 }, { x: 4 }, { x: -3 }, { x: 3 }, { x: 0 }] })` which is type-correct and produces identical motion.
- **Files modified:** `apps/web/src/components/coach/LogoUpload.tsx`
- **Verification:** `tsc --noEmit` reports zero errors on the four component files.
- **Committed in:** `9bd4428`

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** TypeScript fix only — no behavioural change. Animation result is identical.

## Issues Encountered

None beyond the GSAP TypeScript deviation above.

## User Setup Required

None — no external service configuration required. The `coach-logos` bucket was created in Phase 1 (migration 054).

## Next Phase Readiness

- All four sub-components are complete and TypeScript-clean — ready for Plan 03 (BrandingClient) to assemble them.
- BrandingClient must import from `@/components/coach/ColorPickerInput`, `@/components/coach/LogoUpload`, `@/components/coach/ToneSelector`, `@/components/coach/BrandingPreviewCard`.
- The `branding-section` className on all section card wrappers enables the page-entrance GSAP stagger (`gsap.from(".branding-section", { y: 20, opacity: 0, stagger: 0.06 })`) that BrandingClient will trigger on mount.

---
*Phase: 02-web-editor*
*Completed: 2026-05-27*
