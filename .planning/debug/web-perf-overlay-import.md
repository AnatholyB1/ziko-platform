---
slug: web-perf-overlay-import
status: resolved
trigger: manual
created: 2026-05-22
goal: find_and_fix
---

# Debug Session: web-perf-overlay-import

## Symptoms

1. **Semi-opaque overlay bug** (PRIMARY — most critical):
   - On the import page (`/coach/imports/[id]`), a semi-transparent layer appears over components
   - User cannot click on components underneath (pointer-events blocked)
   - Happens specifically on the import page

2. **Slow page loading** (SECONDARY):
   - Affects most pages of the web app
   - Not a regression — has always been like this

3. **Slow navigation** (SECONDARY):
   - Between most screens in the web app
   - Not a regression — has always been like this

## Root Causes Found

### Bug 1 — Sticky CTA footer overlaps sidebar and blocks bottom content (PRIMARY)

**File:** `apps/web/src/app/[locale]/(coach)/coach/imports/[id]/PreviewClient.tsx` line 1401

The sticky footer CTA uses `position: fixed; left: 0; right: 0; bottom: 0; zIndex: 50`.
`left: 0` means the white footer bar spans the FULL viewport width including the 240px
sidebar area. The `zIndex: 50` is higher than the sidebar's default stacking context,
so the footer visually sits on top of sidebar items in the lower portion of the screen,
blocking all clicks in that area. On smaller viewports, this footer covers a significant
portion of the content area.

**Fix:** Change `left: 0` → `left: 240` (matches `w-60` = 240px sidebar width).

### Bug 2 — Redundant page wrapper adding double padding (SECONDARY OVERLAY CAUSE)

**File:** `apps/web/src/app/[locale]/(coach)/coach/imports/[id]/page.tsx` line 74 (before fix)

The page rendered:
```tsx
<div className="flex-1 p-8 bg-background min-h-screen">
  <PreviewClient ... />
</div>
```

This wrapper is inside the layout's already-padded `<div class="mx-auto max-w-3xl px-8 py-10">`.
The extra `p-8` (32px) adds 32px of same-colored padding on all sides, making the actual
content appear inset and creating a visual "raised layer" effect over the page. The `min-h-screen`
forces this div to 100vh minimum, which combined with `bg-background` creates a full-screen
opaque block that shifts the perceived clickable areas.

**Fix:** Remove the wrapper entirely — render `<PreviewClient>` directly from the page.

### Perf — Aggressive force-dynamic on every route disables all caching

**Scope:** 45+ instances of `export const dynamic = 'force-dynamic'; export const revalidate = 0`
across all coach routes INCLUDING the shared layout (`(coach)/coach/layout.tsx`).

Since the layout is force-dynamic, every page navigation triggers a full server round-trip:
- Re-authenticates the Supabase session
- Re-queries `user_profiles` for role check
- Re-queries `coach_alerts` for unread count
- Blocks the HTML response until all these complete

This is the primary cause of slow loading and slow navigation. Next.js App Router does
do client-side navigation for Server Components by default, but `force-dynamic` forces
re-execution of the entire layout tree on each navigation.

**Not fixed in this session** (scope too broad, needs a separate plan).
Recommendation: remove `force-dynamic`/`revalidate = 0` from the shared layout and use
`revalidate = 30` (30s ISR) for the unread alert count, keeping `force-dynamic` only on
pages that require fresh user-specific data.

## Evidence

- `git diff HEAD -- PreviewClient.tsx` shows two recent changes:
  1. GSAP accordion animation changed from `height: 0` to `opacity: 0, y: 6, clearProps: 'all'`
  2. Week accordion div gained `style={{ position: 'relative', zIndex: isExpanded ? 1 : 0 }}`
  Neither of these directly cause the overlay, but the `position: relative; zIndex: 0` on all
  week items creates stacking contexts that could affect how the footer is perceived visually.
- `(coach)/coach/layout.tsx`: `force-dynamic` + `revalidate = 0` — confirmed cause of slow navigation
- 45 total `force-dynamic` declarations across all coach pages

## Resolution

- root_cause: Sticky CTA footer `left: 0` covers the sidebar; redundant `p-8 min-h-screen` page wrapper adds double padding and creates a full-viewport opaque block
- fix: PreviewClient sticky footer changed to `left: 240` (sidebar width); page.tsx wrapper div removed
- status: fixed (overlay); perf deferred to separate planning phase
