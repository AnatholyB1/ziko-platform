# Domain Pitfalls — DA Coach (v1.12)

**Domain:** Dynamic coach branding / white-label theming added to an existing React Native fitness app
**Researched:** 2026-05-25
**Confidence:** HIGH (verified against NativeWind v4 official docs, Supabase Storage docs, existing codebase analysis)

---

## Context: What We Are Adding

v1.12 DA Coach injects runtime branding (coach primary color, logo, tone) into an athlete's existing Ziko app after coach link. The existing theme system (`packages/plugin-sdk/src/theme.ts`) is a **static THEME_REGISTRY** — all 7 palettes are hardcoded objects selected at app start. The `useThemeStore` Zustand store has no MMKV persistence and no async fetch. NativeWind v4 is used throughout the codebase with compiled class names referencing static palette tokens.

This means we are adding a **dynamic, coach-owned, per-link runtime theme** on top of a static compile-time system. That gap is the source of most pitfalls below.

---

## Critical Pitfalls

### Pitfall 1: NativeWind Classes Are Compiled — Arbitrary Hex Colors Cannot Be Class Names

**What goes wrong:** A developer stores the coach's brand color as `#3B82F6` in the DB, then tries to apply it as `className={\`text-[\${coachColor}]\`}`. NativeWind v4 compiles Tailwind utility classes at build time using the Babel/Metro transform. Only class names present in source files at build time are included in the stylesheet. An interpolated string like `text-[#3B82F6]` that was never literally written in source is not compiled and will silently produce no style.

**Why it happens:** Tailwind's JIT scanner reads source files statically. Dynamic string concatenation produces class names that are invisible to the scanner. This is not a NativeWind-specific bug — it is Tailwind's fundamental design.

**Consequences:** Coach brand color appears to do nothing. Fall-through to default Ziko orange. No error thrown. Extremely hard to debug because the component looks syntactically correct.

**Prevention:** Never use NativeWind class names for the coach's dynamic color. Use NativeWind's `vars()` function for all runtime-injected values:

```typescript
import { vars } from "nativewind";

// In CoachBrandProvider — wraps the entire app after coach link
const coachVars = vars({
  "--coach-primary": coachBranding.primaryColor,
  "--coach-surface": coachBranding.surfaceColor ?? "#FFFFFF",
});

<View style={[styles.root, coachVars]}>
  {children}
</View>
```

Then in component files, reference the variable using the literal class string (compiled at build time because the string is static):

```typescript
<Text className="text-[--coach-primary]">Coach branded text</Text>
```

The variable reference `text-[--coach-primary]` is a literal string in source, so it is compiled. The value `--coach-primary` is resolved at runtime from the `vars()` context.

**Phase:** Address in Phase 1 (architecture/provider setup). Getting this wrong at Phase 1 poisons every subsequent UI phase.

**Detection warning signs:** Coach color changes in DB but UI shows no change. `StyleSheet` inspection shows missing or `undefined` color properties.

---

### Pitfall 2: `useThemeStore` Has No Persistence — Coach Branding Reverts on App Restart

**What goes wrong:** The existing `useThemeStore` (Zustand, no persist middleware, no MMKV) resets to `DEFAULT_THEME` every time the JavaScript bundle starts. If coach branding is stored only in this store, every app restart produces a flash of the default Ziko orange followed by a delayed switch to the coach brand — or no switch at all if the fetch fails.

**Why it happens:** Zustand stores without a persist adapter are in-memory only. React Native's JS bundle restarts on every cold start. The existing store never persisted because the user's chosen theme was a preference, not data fetched from a remote source.

**Consequences:**
- Flash of wrong theme on every cold start (white/orange flash visible for 400–800ms)
- If the API is slow or offline, athletes see Ziko branding indefinitely even though linked to a coach
- State race: TanStack Query fetches coach branding while Zustand initializes, causing two re-renders

**Prevention:** Two-tier approach:
1. **MMKV cache** (synchronous, available before first render): Store the last-known coach branding object in MMKV. Initialize the Zustand store from MMKV synchronously so the correct brand is applied before the first render. Use `react-native-mmkv` which is already installed in this project.
2. **Background refresh**: After mount, trigger a TanStack Query fetch for fresh coach branding. Update MMKV + Zustand if changed.

```typescript
// Pseudo-pattern
const cachedBranding = storage.getString('coach_branding'); // synchronous
const initial = cachedBranding ? JSON.parse(cachedBranding) : null;
```

Hold the splash screen open (using the existing `expo-splash-screen` pattern) until the MMKV read completes. MMKV reads are synchronous and take <1ms — there is no perceptible delay.

**Phase:** Address in Phase 1. The MMKV persistence layer must be designed before any UI work.

---

### Pitfall 3: Theme Flash Despite MMKV — Missing Expo Splash Screen Hold

**What goes wrong:** Even with MMKV, a flash can occur. The Expo splash screen auto-hides before JavaScript has finished applying the coach theme, revealing a frame of the default Ziko theme.

**Why it happens:** Expo's default behavior hides the splash screen as soon as the JS bundle is evaluated. The component tree's first paint happens after the splash hides if `SplashScreen.preventAutoHideAsync()` is not called early and `SplashScreen.hideAsync()` is deferred.

**Consequences:** Athletes see a white or Ziko-orange flash for ~200ms on every cold start, visually breaking the white-label illusion.

**Prevention:**
1. Call `SplashScreen.preventAutoHideAsync()` in the root `_layout.tsx` before any async work.
2. In `CoachBrandProvider`, read MMKV synchronously, apply `vars()`, then call `SplashScreen.hideAsync()` only after the provider's first paint.
3. Set `app.json`'s `backgroundColor` to the most neutral safe color (`#FFFFFF` or `#F7F6F3`) — it will only be visible for the splash frame, not coach-branded.

**Phase:** Phase 1 (provider setup). Test explicitly on cold-start with Metro cache cleared.

---

### Pitfall 4: Supabase Storage Signed URLs Expire — Logo Breaks After 1 Hour

**What goes wrong:** The existing Supabase Storage pattern in this project uses **signed URLs** (v1.3, private buckets). If coach logos are stored in a private bucket and served via signed URL, the `Image` component caches the URL but not the image bytes. When the signed URL expires (default: 3600s), the Image re-fetches using the same expired URL and renders a broken image — often silently, with no user-visible error.

**Why it happens:** React Native's `Image` component caches by URL string. A new signed URL for the same object is a different URL string, so cache invalidation only works if the client re-fetches the URL from the API, not the image bytes from the URL.

**Consequences:** Coach logo disappears after 1 hour for athletes who keep the app open. For athletes who reopen after a session, the MMKV-cached branding object holds the now-expired URL. Stale logo until the next background refresh.

**Prevention:** Coach logos are public-facing brand assets — not sensitive athlete data. Use a **public bucket** for coach logos specifically. The existing project already has the pattern in `PROJECT.md`: "Public buckets are more performant than private buckets since they are cached differently." A public bucket URL is permanent and CDN-cached.

If a private bucket is required for compliance reasons, store only the **storage path** in the DB (e.g., `coach-logos/abc123/logo.png`), never a pre-generated signed URL. Generate a fresh signed URL server-side each time the branding endpoint is called, with a long TTL (e.g., 86400s = 24h).

**Recommended:** Public bucket `coach-logos` with RLS disabled at the bucket level. Control write access via the Hono API — athletes never write to this bucket, only coaches do through the web CRM.

**Phase:** Phase 1 (data model + storage setup). Wrong choice here silently breaks the logo in production.

---

## Moderate Pitfalls

### Pitfall 5: Color Contrast — Coach Picks an Inaccessible Color Combination

**What goes wrong:** A coach sets their brand color to `#FFFF00` (bright yellow) as a primary on a white surface. The resulting text/button contrast ratio is ~1.07:1, well below WCAG AA (4.5:1 for normal text). Athletes with any visual impairment cannot read coach-branded UI. Worse, yellow primary on white also breaks the coach's own credibility.

**Why it happens:** The coach web interface offers a color picker with no guardrails. Coaches are fitness professionals, not designers.

**Consequences:** Broken UX for athletes, potential RGPD/accessibility liability under French law (RGAA requirement applicable to services accessible to the public), and reputational risk if athlete screenshots show broken branding.

**Prevention:**
1. **On the coach web CRM (input side):** Validate contrast at save time using the `wcag-contrast` or `color-contrast-checker` npm package. Block save if contrast ratio < 4.5:1 for text usage. Show a live preview with the computed ratio.
2. **On the mobile athlete side (display side):** Compute a safe text color automatically — if the coach primary is light (luminance > 0.5), use dark text on primary; if dark, use white text. Never trust the coach's pick to be legible against both backgrounds it will appear on.

Formula (no library needed):
```typescript
function relativeLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]
    .map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function safeTextOnColor(hex: string): '#FFFFFF' | '#1C1A17' {
  return relativeLuminance(hex) > 0.179 ? '#1C1A17' : '#FFFFFF';
}
```

**Phase:** Phase 2 (coach web branding editor). Validation on input, auto-correction on display.

---

### Pitfall 6: RLS for `coach_branding` — Over-Permissive Read Policy

**What goes wrong:** A naive RLS policy `FOR SELECT USING (auth.uid() = coach_id)` means only the coach can read their own branding row. Athletes linked to that coach cannot fetch the branding data because `auth.uid()` is the athlete's user ID, not the coach's.

**Why it happens:** Standard "own your row" pattern is correct for private data but wrong for branding data that must be consumed by others.

**Consequences:** `GET /coach/branding` returns 0 rows for the athlete. Branding falls back silently to defaults. Bug appears to work in testing (coach testing their own app with coach credentials) but breaks for real athletes.

**Prevention:** Model the read policy symmetrically with the existing `is_coach_of()` pattern, but inverted — athletes read the coach's branding, not their own:

```sql
CREATE POLICY "coach_branding_coach_write" ON public.coach_branding
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "coach_branding_athlete_read" ON public.coach_branding
  FOR SELECT
  USING (
    -- Coach reads own
    auth.uid() = coach_id
    OR
    -- Athlete reads their linked coach's branding
    public.is_coach_of(coach_id, auth.uid())
  );
```

The second clause calls `is_coach_of(coach_id, auth.uid())` — note the argument order: coach is first, athlete is second, matching the function signature from migration 035.

**Important:** Do NOT use `is_coach_of(auth.uid(), coach_id)` — that checks if the authenticated user is a coach of `coach_id`, which is backwards.

**Phase:** Phase 1 (DB migration). This is a security-correctness issue, not a feature issue.

---

### Pitfall 7: Overriding the Existing `useThemeStore` Without Coordination

**What goes wrong:** DA Coach adds a parallel theming layer. If both `useThemeStore` (user's chosen theme) and the coach branding provider are active simultaneously, they fight over the same visual tokens. The user has chosen "Bleu Océan" theme; the coach injects orange primary. One of them silently wins depending on render order, producing unpredictable results.

**Why it happens:** The existing `useThemeStore` theme system uses direct JavaScript object access (`theme.primary`), while the new coach system injects CSS vars. If components mix the two approaches, the precedence is undefined.

**Prevention:** Define a clear override contract:
- When a coach link is active, the **coach branding overrides only specific tokens** (primary, logo, tone adjective for AI) — not the full palette.
- Background, surface, text, semantic colors (success, danger, etc.) remain from the user's chosen theme.
- Coach provides: `primaryColor`, `logoUrl`, `accentColor` (optional). Not a full palette.
- The `vars()` wrapper wraps only those tokens, layered on top of the existing theme. This preserves the user's chosen theme while surfacing coach branding.

This scope decision must be made in Phase 1 design. Letting coaches override the full palette is a UX pitfall — a coach with "Bleu Océan" preference fighting an athlete's "Noir Carbone" theme is chaotic.

**Phase:** Phase 1 (scope decision + architecture). Document which tokens the coach controls.

---

### Pitfall 8: Pro Gate UX — Showing Lock Icons Without Value Preview

**What goes wrong:** Athletes see the "Coach DA" feature locked behind "Pro — 29€/mois" with no preview of what it looks like. Without value preview, the paywall converts poorly and coaches don't upgrade.

**Why it happens:** The simplest implementation is a lock icon with a price. But this puts the conversion burden entirely on the label "DA Coach" which is meaningless to a user who has never seen it in action.

**Consequences:** Low upgrade rate. Coaches never see the feature. v1.12 fails as a revenue differentiator.

**Prevention:** Show the value before the gate:
1. **Athlete-side preview:** Show a subtle watermark "with [CoachName] DA" on a greyed-out version of what the app would look like branded. Or show a sample branded state in the coach plugin screen with a CTA.
2. **Coach-side preview:** On the web CRM, allow the coach to configure the DA (colors, logo) and see a mobile preview mockup even before upgrading. The "save & activate" button is gated, not the configurator itself.
3. **Clear value statement:** "Your athletes' app shows your brand colors and logo automatically" — concrete, visible, coach-ego-aligned.

Anti-patterns to avoid:
- Hard paywall with no trial or preview (blind gate)
- Paywall shown during athlete onboarding before coach link is established (wrong timing — athlete doesn't control this)
- Hiding the feature entirely until Pro — athletes should see the coach branding even if the coach hasn't configured it yet (fall back gracefully)

**Phase:** Phase on pro gate UX (likely a dedicated phase for the upgrade flow on the web CRM side).

---

## Minor Pitfalls

### Pitfall 9: Logo Aspect Ratio Assumptions

**What goes wrong:** Coach uploads a 2000x200px horizontal banner. The mobile `Image` component with `width: 120, height: 40` crops or squashes it. Coach complains the logo looks broken.

**Prevention:** Enforce constraints at upload time: square or near-square (max 3:1 ratio), minimum 200x200px, maximum 2MB. Store `width` and `height` metadata alongside the logo URL. On mobile, use `resizeMode="contain"` within a fixed-height container. Provide visual guidance in the coach web uploader.

**Phase:** Phase 2 (coach web branding editor + mobile display).

---

### Pitfall 10: Branding Fetch on Every App Start Adds Latency

**What goes wrong:** The app fetches coach branding on every cold start from the Hono API (`GET /coach/branding`). With Vercel cold starts, this adds 200–800ms to the app's time-to-interactive. If the athlete is linked to a coach in a different timezone with slow connectivity, the fetch degrades the experience.

**Prevention:**
1. Use MMKV cache (as per Pitfall 2) to serve the last-known branding instantly.
2. Fetch in the background after the cached branding is applied. Update only if changed (compare a `updated_at` timestamp or `version` field).
3. Add a `Cache-Control: public, max-age=3600` header to the branding endpoint — the Supabase CDN will serve it from edge on repeated fetches.

**Phase:** Phase 1 (caching strategy). Not a blocker but degrades perceived performance if ignored.

---

### Pitfall 11: Missing Revocation Cascade — Coach Branding Persists After Unlink

**What goes wrong:** Athlete revokes coach link. The MMKV cache still contains the coach branding. The athlete continues to see the coach's brand colors for up to 24h (cache TTL) or until the app is reinstalled.

**Why it happens:** Revocation invalidates the `coach_client_links` row but does not actively push a "clear branding" signal to the mobile client.

**Prevention:**
1. On revocation (either side), call `storage.delete('coach_branding')` from the MMKV store and reset `useThemeStore` to `DEFAULT_THEME`.
2. The existing revocation flow (`coach_revoke_link` AI tool + `mon-coach` plugin State C → State A transition) already handles state reset in the UI. Add the MMKV clear step to that same transition.

**Phase:** Phase on revocation / link lifecycle (whichever phase handles State C → State A reset for the mon-coach plugin).

---

### Pitfall 12: `useUnstableNativeVariable()` Is Marked Unstable — Don't Use for Business Logic

**What goes wrong:** A developer uses `useUnstableNativeVariable('--coach-primary')` to read the current coach color in JavaScript for computed logic (e.g., deciding which icon variant to render). The `unstable_` prefix indicates this API is not production-stable and may be removed or renamed in NativeWind patch releases.

**Prevention:** Use `vars()` for setting values and NativeWind className references for consuming them in JSX. For JavaScript business logic that needs the coach color value, read it from the Zustand store / MMKV cache directly (source of truth), not from the CSS variable context. Keep CSS variables as a styling concern only.

**Phase:** Ongoing coding convention — document in a short ADR at Phase 1.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DB migration + RLS | Over-permissive or under-permissive `coach_branding` read | Use `is_coach_of(coach_id, auth.uid())` for athlete read policy (note argument order) |
| Provider architecture | Dynamic hex color as NativeWind class name | Use `vars()` exclusively; never interpolate colors into className strings |
| MMKV + splash screen | Theme flash on cold start | `SplashScreen.preventAutoHideAsync()` + MMKV synchronous read before first render |
| Supabase Storage bucket choice | Signed URL expiry breaks logo | Use public bucket for coach logos; store path not URL in DB |
| Coach web branding editor | Inaccessible color pick | WCAG contrast check at save; auto-compute safe text color on mobile |
| Pro gate / paywall | Blind gate with no value preview | Show configurator before gate; mobile preview in athlete coach plugin screen |
| Revocation flow | Stale MMKV branding after coach unlink | Clear MMKV + reset Zustand on revocation event |
| Token/color scope | Coach palette fighting athlete theme | Coach controls only primary + logo tokens; never full palette override |

---

## Sources

- NativeWind v4 `vars()` API: https://www.nativewind.dev/docs/api/vars
- NativeWind v4 Themes guide: https://www.nativewind.dev/docs/guides/themes
- Supabase Storage: public vs private buckets: https://github.com/orgs/supabase/discussions/6458
- Supabase Smart CDN + signed URL caching: https://supabase.com/docs/guides/storage/cdn/smart-cdn
- Supabase RLS best practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- React Native theme flash (splash screen sync): https://medium.com/@ripenapps-technologies/the-white-flash-of-death-solving-theme-flickering-in-react-native-production-apps-d732af3b4cae
- Zustand + MMKV hydration: https://dev.to/mehdifaraji/zustand-mmkv-storage-blazing-fast-persistence-for-zustand-in-react-native-3ef1
- WCAG color contrast for dynamic user inputs: https://medium.com/@pavlogolovatyy/ensuring-accessibility-compliance-with-wcag-contrast-utils-a-developers-guide-bc7f08a364ab
- Mobile paywall UX best practices: https://apphud.com/blog/design-high-converting-subscription-app-paywalls
- Existing codebase: `packages/plugin-sdk/src/theme.ts` (ThemePalette, THEME_REGISTRY, useThemeStore)
- Existing codebase: `supabase/migrations/035_coach_invitations_links_rls.sql` (is_coach_of pattern)
