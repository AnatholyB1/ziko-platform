# Research Summary — DA Coach (v1.12)

**Project:** Ziko Platform — Coach Direction Artistique
**Domain:** Runtime white-label branding injection in a multi-tenant B2B fitness SaaS
**Researched:** 2026-05-25
**Confidence:** HIGH

---

## Executive Summary

DA Coach (v1.12) adds coach-controlled white-label branding to the athlete-facing Ziko app: a primary color, logo, and AI coaching tone that propagate automatically to every linked athlete. The feature is scoped as a Pro 29 EUR/month differentiator and maps directly onto existing infrastructure: coach_profiles, the useThemeStore Zustand store, and GET /coach/clients/links/me which drives the three-state CoachScreen UX (no link / preview / linked). This is an incremental, additive build. The codebase has every major dependency except one npm package (reanimated-color-picker) and two migration artefacts (new coach_branding table + coach-logos bucket).

The recommended approach is a strict sequential foundation followed by parallel track execution. The DB migration and branding backend module must ship first because both the web editor and the mobile injection depend on them. Once coach_branding exists and links/me returns branding data, the web editor (Next.js) and mobile CoachScreen injection can be developed independently. Total scope is 5-6 development days, constrained primarily by the web branding editor and the MMKV caching layer required to eliminate cold-start theme flash.

The primary technical risk is the NativeWind compilation constraint: arbitrary hex colors cannot be interpolated into NativeWind class names at runtime (Tailwind scans source files statically at build time). The Ziko codebase avoids this naturally by using theme.* inline style references throughout, so the existing useThemeStore extended with a new setCustomTheme(overrides) action is the correct injection mechanism. NativeWind vars() is not needed and would require a full design-system migration. The secondary risk is signed URL expiry for coach logos, avoided by using a public Supabase Storage bucket (coach-logos).

---

## Key Findings

### Recommended Stack

Only one new npm dependency is required: reanimated-color-picker@^4.2.0, a pure-JS composable color picker whose peer dependencies (react-native-reanimated ~4.1.1, react-native-gesture-handler ~2.28.0) are already installed. All image handling reuses expo-image-picker ~17.0.10 and expo-image-manipulator ^55.0.13 via the validated avatar upload pattern from apps/mobile/app/(app)/profile/avatar.tsx. Theme injection reuses the existing useThemeStore Zustand store with a new setCustomTheme(overrides: Partial<ThemePalette>) action.

**Core technologies (changes only):**

- reanimated-color-picker@^4.2.0 (mobile only): composable HEX color picker. Pure JS, no native rebuild. Use onCompleteJS callback (not onComplete) when calling setState or Zustand set.
- useThemeStore.setCustomTheme() (plugin-sdk): new action that merges coach branding into current palette reactively. Zero new dependencies.
- coach_branding table (Supabase, migration 054): new normalized table; intentionally separate from coach_profiles (different lifecycle and change rate).
- coach-logos public bucket (Supabase Storage): permanent CDN URLs, no signed URL expiry.
- HTML input[type=color] (web CRM only): native color input for coach settings page. No React Native library on web.

**What NOT to add:** NativeWind vars(), a separate coach_da table, signed URLs for logos, custom font loading, react-native-image-crop-picker.

---

### Expected Features

Industry research across FITR, Gymkee, Everfit, and Trainerize confirms the following hierarchy:

**Must have (table stakes):**
- Primary brand color picker with live swatch preview (hex input, web CRM)
- Logo upload (PNG/SVG, max 2 MB, 1:1 aspect enforced at upload)
- Real-time preview panel in coach settings (mock Mon coach card)
- Automatic athlete-side color injection on next refresh (State C CoachScreen)
- Pro tier gate with value preview before paywall (not a blind lock)

**Should have (Ziko differentiators — no competitor does these):**
- Coach-defined AI tone propagated into athlete system prompt (buildPersonaSystemPrompt override when coach is linked)
- Brand color propagates across all 17 plugins via theme.primary, not just the coach plugin shell
- State B (preview/invitation) shows coach brand color on Rejoindre CTA — branded first impression before linking
- Revocation immediately restores athlete personal gamification theme (clearCoachTheme on unlink)

**Defer (v2+ or enterprise):**
- Secondary color picker (ship a computed default: primary at 15% opacity)
- AI tone effect on athlete system prompt (requires Persona plugin coordination — Phase 2 of workstream)
- Logo in email/push notifications (depends on v1.11 Notification System workstream)
- Custom app icons / splash screen (enterprise white-label tier only)
- Full ThemePalette builder (17 fields): one primary + logo is the right v1 scope

**Anti-features (explicitly out of scope):** Font customization, CSS/HTML injection by coaches, athlete-overridable branding, dark mode theming.

---

### Architecture Approach

A new coach/branding/ module is created in backend/api/src/ following the existing bounded-context pattern. The athlete never calls this module directly. Branding reaches the athlete through GET /coach/clients/links/me, extended with a LEFT JOIN on coach_branding. This eliminates an extra round-trip and keeps the athlete-facing API surface unchanged. The coach_branding row is optional: branding: null in the payload is a graceful no-op on mobile.

**Major components:**

1. supabase/migrations/054_coach_branding.sql: coach_branding table with hex CHECK constraints, coach-logos public bucket, RLS (coach writes own row; athletes read via is_coach_of(coach_id, auth.uid()) guard).
2. backend/api/src/coach/branding/: GET/PUT /coach/branding + POST/DELETE /coach/branding/logo (web editor facing). Pro tier check on PUT. No athlete-facing route.
3. backend/api/src/coach/clients/db.ts (modified): getActiveLink adds LEFT JOIN on coach_branding; constructs public logo URL from path (no signing).
4. packages/plugin-sdk/src/theme.ts (modified): ThemeState gets setCustomTheme(overrides: Partial<ThemePalette>) and clearCoachTheme() actions.
5. plugins/coach/src/screens/CoachScreen.tsx (modified): calls setCustomTheme on State C entry; clearCoachTheme on unlink/revoke.
6. apps/web/src/app/[locale]/(coach)/coach/branding/: new page with color picker, logo upload, tone selector, live preview, PATCH save.

**Token injection scope (partial override, not full palette replacement):**

| Branding field | ThemePalette fields overridden |
|---|---|
| primary_color | primary, tabBarActive |
| secondary_color | background, statusBarBg |
| All other tokens | Remain from user gamification theme |

**Data flow:** Coach saves in web CRM -> coach_branding upserted -> athlete opens app -> links/me returns branding object -> setCustomTheme applied -> Zustand propagates reactively to all 50+ subscribers, no restart needed. On unlink: clearCoachTheme + MMKV cache clear -> user gamification theme restored.

---

### Critical Pitfalls

1. **NativeWind dynamic class interpolation silently fails.** Never interpolate a hex value into a className string. Tailwind class names are compiled at build time; interpolated strings produce no style and throw no error. The Ziko codebase avoids this naturally (inline theme.* style objects). setCustomTheme() is the complete and correct solution. Do not introduce vars() without migrating all 70+ components to NativeWind color classes.

2. **MMKV cache required to prevent cold-start theme flash.** useThemeStore is in-memory only. Without MMKV caching the last-known coach branding, every cold start shows a flash of default Ziko orange for 400-800ms. Store branding as JSON string in MMKV, read synchronously before first render, hold splash screen with SplashScreen.preventAutoHideAsync() until hydration completes (under 1ms). TanStack Query refreshes in background.

3. **RLS is_coach_of() argument order is easily reversed.** The athlete read policy must use public.is_coach_of(coach_id, auth.uid()) with coach first and athlete second, matching migration 035 function signature. The reverse returns 0 rows for all real athletes and passes all coach-credential tests silently.

4. **Coach logos must use a public bucket, not signed URLs.** Signed URLs (300-second TTL) expire. The RN Image component caches by URL string, not bytes. An expired URL renders a broken image silently. Store storage path in coach_branding.logo_path, construct public URL at query time.

5. **MMKV branding cache must be cleared on coach unlink.** Without explicit storage.delete + clearCoachTheme() in the unlink flow, athletes see the former coach brand colors until app reinstall. Wire into the existing State C -> State A transition in CoachScreen.

---

## Implications for Roadmap

Based on combined research, a 3-phase structure is recommended. The dependency chain is strict at the top and parallel in the middle.

### Phase 1: Foundation — DB Migration + Backend Branding Module

**Rationale:** Both the web editor and mobile injection depend on the coach_branding table existing and links/me returning branding data. No UI output but unblocks everything else. Must be first.

**Delivers:**
- Migration 054: coach_branding table, hex CHECK constraints, updated_at trigger, RLS policies (coach write + is_coach_of athlete read)
- Migration 054: coach-logos public bucket + write-owner RLS
- backend/api/src/coach/branding/ bounded module (GET/PUT /coach/branding, POST/DELETE /coach/branding/logo)
- Extended CoachPreviewPayload type with branding field
- Modified getActiveLink LEFT JOIN on coach_branding + public URL construction
- setCustomTheme(overrides) + clearCoachTheme() actions in useThemeStore

**Addresses:** All 5 critical pitfalls (RLS direction, logo URL strategy, token scope, MMKV architecture decision)
**Research flag:** Standard patterns. No research phase needed.

---

### Phase 2: Web Editor — Coach Branding Settings

**Rationale:** Once DB + backend exist, web CRM can be built independently of mobile. Parallel-eligible with Phase 3 after Phase 1.

**Delivers:**
- /coach/branding settings page in apps/web Next.js
- Color sections: primary (input + hex text + live swatch), secondary (computed default shown)
- Logo upload: drag-drop zone, 2 MB and 3:1 ratio validation, direct Supabase Storage upload
- Tone selector: 4-card radio (Motivant / Analytique / Bienveillant / Exigeant)
- Live preview panel: mock State C Mon coach card with coach name, logo, colors
- WCAG contrast check at save (block if ratio below 4.5:1, show ratio live)
- Pro tier gate: configurator visible to all coaches, Save and activate button gated (value preview before paywall)
- Sidebar nav entry Identite visuelle

**Avoids:** Pitfall 5 (color contrast via WCAG check on save), Pitfall 8 (blind paywall avoided by showing preview before gate)
**Research flag:** Standard patterns. No research phase needed.

---

### Phase 3: Mobile Injection — CoachScreen + MMKV Cache

**Rationale:** Once links/me returns branding, mobile injection can be wired. Independent of web editor (branding: null is graceful no-op). Parallel-eligible with Phase 2. MMKV caching required to prevent cold-start flash.

**Delivers:**
- CoachScreen.tsx: setCustomTheme({ primary, tabBarActive, background, statusBarBg }) on State C entry when branding is not null
- State B (preview): coach primary color on Rejoindre CTA for branded first impression
- clearCoachTheme() + MMKV cache clear on unlink / State C -> State A
- MMKV persistence hook: synchronous read on cold start, SplashScreen.preventAutoHideAsync() held, background refresh via TanStack Query
- relativeLuminance() + safeTextOnColor() pure helper (6 lines, no library) for text legibility on coach primary background
- Logo displayed with resizeMode contain within fixed-height container

**Addresses:** Theme flash prevention (Pitfalls 2 and 3), revocation cascade (Pitfall 11)
**Avoids:** Pitfall 1 (inline style only, no NativeWind class interpolation), Pitfall 9 (logo aspect ratio contained)

**Research flag:** RECOMMEND --research-phase during planning. MMKV + Zustand synchronous hydration before first render + splash screen coordination is a niche pattern not established in project conventions.

---

### Phase Ordering Rationale

- Phase 1 is strictly prerequisite. No UI can be built without the DB schema and branding endpoint.
- Phases 2 and 3 are parallel-eligible after Phase 1. A single developer should complete Phase 2 before Phase 3 since the web editor puts data in DB, making Phase 3 visually testable.
- The MMKV caching architecture is decided in Phase 1 but implemented in Phase 3. Document the pattern during Phase 1 design to avoid rework.
- AI tone propagation (coach da_tone -> athlete system prompt override) is explicitly deferred post-v1.12. Requires Persona plugin coordination.

### Research Flags

Phases needing --research-phase during planning:
- **Phase 3 (Mobile Injection):** MMKV + Zustand synchronous hydration + splash screen hold sequence. Niche pattern not established in project conventions.

Phases with standard patterns (skip research-phase):
- **Phase 1 (DB + Backend):** Follows established migration + Hono bounded module patterns. is_coach_of() already exists in migration 035.
- **Phase 2 (Web Editor):** Standard Next.js page + Supabase Storage upload + Zod validation + WCAG inline formula.

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | One new dependency confirmed against npm + official docs. All others verified directly in codebase. |
| Features | HIGH | Competitor patterns confirmed across 4 platforms. Codebase constraints fully audited. |
| Architecture | HIGH | All decisions drawn from existing codebase files. Zero speculation. Every file path verified. |
| Pitfalls | HIGH | NativeWind compilation behavior verified against v4 docs. Signed URL expiry is documented Supabase behavior. RLS direction is a specific verifiable code risk. |

**Overall confidence: HIGH**

### Gaps to Address

- **AI tone -> system prompt propagation:** Deferred to post-v1.12. buildPersonaSystemPrompt() will need a coach override parameter. Plan as separate workstream task.
- **Secondary color derivation algorithm:** Design decision (HSL shift vs opacity overlay vs tint). Resolve during Phase 2 UI design.
- **Pro tier column source:** Confirm user_profiles.tier is the current Pro gate before wiring Phase 1 backend guard. The credit system creditCheck middleware may already abstract this.
- **reanimated-color-picker placement:** Confirm whether any athlete-facing color preview widget is needed in Phase 3. If not, skip the mobile install for v1.12.

---

## Sources

### Primary (HIGH confidence)
- Codebase: packages/plugin-sdk/src/theme.ts — ThemePalette, THEME_REGISTRY, useThemeStore
- Codebase: plugins/coach/src/screens/CoachScreen.tsx — CoachPreviewPayload, three-state UX
- Codebase: backend/api/src/coach/clients/db.ts — getActiveLink, signCoachPhoto pattern
- Codebase: supabase/migrations/034_coach_role_profiles.sql — coach_profiles schema
- Codebase: supabase/migrations/035_coach_invitations_links_rls.sql — is_coach_of() function
- Codebase: apps/mobile/app/(app)/profile/avatar.tsx — validated FormData upload pattern (physical Android)
- reanimated-color-picker npm (https://www.npmjs.com/package/reanimated-color-picker) — v4.2.0 + onCompleteJS API
- NativeWind v4 vars() API (https://www.nativewind.dev/docs/api/vars)
- Supabase Storage public vs private (https://github.com/orgs/supabase/discussions/6458)

### Secondary (MEDIUM confidence)
- FITR white-label customization (https://www.coachwithfitr.com/white-label)
- Gymkee custom branding (https://gymkee.com/coach/branding/custom-branding/)
- Everfit standard custom branding (https://help.everfit.io/en/articles/4292647-standard-custom-branding-personalize-your-client-app-experience)
- Zustand + MMKV hydration pattern (https://dev.to/mehdifaraji/zustand-mmkv-storage-blazing-fast-persistence-for-zustand-in-react-native-3ef1)
- React Native theme flash / splash screen hold (https://medium.com/@ripenapps-technologies/the-white-flash-of-death-solving-theme-flickering-in-react-native-production-apps-d732af3b4cae)

### Tertiary (MEDIUM-LOW confidence)
- Trainerize branding overview (https://www.trainerize.com/blog/best-white-label-coaching-apps-2026/) — blog, feature scope inference only
- Mobile paywall UX best practices (https://apphud.com/blog/design-high-converting-subscription-app-paywalls)

---
*Research completed: 2026-05-25*
*Ready for roadmap: yes*