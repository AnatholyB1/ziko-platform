# Feature Landscape: DA Coach (Direction Artistique)

**Domain:** Coach white-label branding in B2B fitness SaaS
**Researched:** 2026-05-25
**Confidence:** HIGH (industry patterns confirmed across Everfit, FITR, Gymkee; existing codebase constraints fully audited)

---

## Existing Codebase State (mandatory prerequisite reading)

Before consuming this file, understand what is already built:

| Asset | Location | Relevance |
|-------|----------|-----------|
| `ThemePalette` interface | `packages/plugin-sdk/src/theme.ts` | 17-field typed struct; `primary`, `primaryLight`, `background`, `surface`, `border`, etc. |
| `THEME_REGISTRY` | `packages/plugin-sdk/src/theme.ts` | 7 hardcoded named themes (Sport Orange, Bleu Océan, Violet Royal, Vert Forêt, Rouge Feu, Or Prestige, Noir Carbone) |
| `useThemeStore` | `packages/plugin-sdk/src/theme.ts` | Zustand store; `setTheme(id)` swaps full palette; `resetTheme()` restores default |
| `coach_profiles` table | `supabase/migrations/034_coach_role_profiles.sql` | `user_id`, `display_name`, `bio`, `specialties`, `photo_url` — no branding columns yet |
| Persona `coachingStyle` | `supabase/migrations/029_persona_coaching_style.sql` | Enum: `motivational`, `analytical`, `friendly`, `strict` — athlete-side persona, not coach-side |
| `CoachScreen.tsx` | `plugins/coach/src/screens/CoachScreen.tsx` | State A/B/C UI; fetches `CoachPreviewPayload` from `/coach/clients/links/me`; already uses `useThemeStore` |
| `CoachPreviewPayload` | `CoachScreen.tsx` L22–30 | Current fields: `coach_id`, `display_name`, `bio`, `specialties`, `photo_signed_url`, `kyc_status` — no branding fields |

**Key insight:** The athlete-side `CoachScreen` already calls a backend endpoint and renders coach data. Branding injection only requires (1) adding branding fields to the DB and preview endpoint, and (2) calling `useThemeStore.setTheme()` in `CoachScreen` when a linked coach's branding arrives.

---

## Table Stakes

Features coaches expect from any B2B fitness platform positioning itself as a "Pro" tool. Missing any of these makes the feature feel unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Primary color picker (hex input) | Every competitor (FITR, Everfit, Gymkee, Trainerize) offers this as the minimum branding setting | Low | Must accept HEX, show live swatch; no full color wheel required |
| Logo upload (PNG/SVG) | Standard across all platforms; shown in athlete "Mon coach" plugin header | Low-Medium | Signed URL upload to Supabase Storage (existing pattern from v1.3). PNG transparent + SVG recommended (per Gymkee docs). Max 2 MB |
| Real-time preview in coach settings UI | Industry standard — Gymkee shows "changes take effect immediately"; FITR shows branded checkout preview | Low | Web-side preview panel; shows logo + primary color applied to a mock coach card |
| Automatic athlete-side theming on refresh | Core promise of the feature: "athlete app displays DA automatically on next refresh" | Medium | `CoachScreen` applies branding via `useThemeStore` when `CoachPreviewPayload` includes branding fields |
| Secondary color (optional) | FITR and Everfit both expose secondary/background color — coaches expect it once they see primary color option | Low | Defaults computed from primary (e.g., `primary + 15% opacity` for `primaryLight`) if not set |
| Tone/coaching style selector | Already exists in athlete Persona plugin (`motivational`, `analytical`, `friendly`, `strict`). Coaches expect to control how their AI voice sounds to linked athletes | Low | Reuse existing enum; propagated to athlete-side system prompt when coach is linked |
| Pro tier gate | Feature is explicitly positioned as Pro 29€/month differentiator | Low | Gate behind `user_profiles.tier = 'premium'` (existing column); free coaches see the section grayed with upsell CTA |

**Confidence:** HIGH — confirmed from FITR, Everfit, Gymkee documentation and existing codebase patterns.

---

## Differentiators

Features that make Ziko's DA Coach stand out beyond commodity branding tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Coach-defined tone propagated to AI | No competitor injects the coach's tone/style into the AI system prompt for linked athletes. Ziko already has `buildPersonaSystemPrompt()` and the Persona plugin infra | Medium | Coach sets tone in web settings → stored in `coach_profiles` → fetched via preview endpoint → overrides athlete's personal Persona `coachingStyle` when linked |
| Brand color persists across all plugins | Other platforms brand only their own app shell. Ziko can apply the coach's primary color as the `theme.primary` token, affecting buttons, chips, tabs across all 17 plugins | Medium | Requires `useThemeStore.setTheme()` call from `CoachScreen` with a synthesized `ThemePalette` derived from coach's hex color. Athlete's personal theme choice is overridden while linked |
| Revocation restores athlete's personal theme | When athlete revokes coach link, their original theme is restored | Low | On revoke success, call `useThemeStore.resetTheme()` (already exists) |
| Logo in "Mon coach" plugin header | Coach logo shown prominently in the State C view — reinforces coach brand every session | Low | Already have `photo_url` (coach profile photo) in `CoachPreviewPayload`; DA logo is distinct from profile photo |
| Coach color on invitation acceptance screen | State B (preview before linking) already styled with platform primary orange. Using coach's brand color in State B creates an immediate branded first impression | Low | Requires branding in the `/preview` endpoint, which State B already fetches |

**Confidence:** HIGH on first three (clear platform differentiators with existing infra hooks). MEDIUM on last two (no competitor doing it, but low-risk additions).

---

## Anti-Features

Explicitly do not build these. Each would add disproportionate complexity or harm the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom app icons (coach-branded splash/icon) | Requires separate App Store submission per coach — weeks of review, Apple/Google developer accounts, infeasible for a v1 feature | Stop at in-app color + logo; custom icons are full white-label (v2+, enterprise tier only) |
| Full theme builder (all 17 ThemePalette fields) | Coaches are not designers; too many fields causes paralysis. Competitors who expose full palettes get overwhelmed support tickets | Derive full `ThemePalette` from 1–2 coach colors algorithmically. `primaryLight = primary + 15` opacity; backgrounds remain platform defaults |
| Font customization | Fonts require bundling or remote loading; significant performance + licensing complexity | Keep Manrope + Geist (platform fonts); brand is communicated via color + logo, not typography |
| Dark mode theming | Platform explicitly has no dark mode (CLAUDE.md constraint) | No action needed |
| Custom notification templates per coach | Out of scope for DA — notification system (v1.11) is separate workstream | DA Coach scoped to visual identity + AI tone only |
| Athlete can override coach DA | Confusing UX — who is the primary? Creates conflict state | When linked to a coach, coach DA takes precedence. Athlete personal theme stored separately, restored on unlink |
| CSS/HTML custom injection | Security and consistency nightmare | Color + logo only — no arbitrary styling |

---

## Feature Dependencies

```
coach_profiles.branding_columns (new DB columns)
  → GET /coach/clients/preview endpoint (add branding fields to response)
      → CoachScreen.tsx State B (preview with coach colors)
      → CoachScreen.tsx State C (apply branding via useThemeStore)
          → All 17 plugins (theme.primary propagates everywhere)
          → revoke → useThemeStore.resetTheme()

coach web settings UI (Next.js /coach/settings/branding)
  → Supabase Storage signed URL upload (existing infra, v1.3)
  → PATCH /coach/identity/branding (new endpoint)
  → Preview panel (real-time in web UI)

Pro tier gate
  → user_profiles.tier check (existing column)
  → Upsell CTA for free coaches
```

**Critical path:** DB migration (add branding columns) → backend preview endpoint update → mobile `CoachScreen` branding application. These three are strictly sequential. Web editor UI can be built in parallel with mobile side once the DB is ready.

---

## MVP Recommendation

Prioritize in this order:

1. **DB migration** — Add `brand_primary_color TEXT`, `brand_secondary_color TEXT`, `brand_logo_url TEXT`, `coaching_style TEXT` to `coach_profiles` (or a new `coach_branding` table if cleaner). The `coaching_style` enum reuses the persona plugin's four values.
2. **Backend preview endpoint update** — Add branding fields to `CoachPreviewPayload` (already consumed by `CoachScreen`). Zero new endpoint, one new data shape.
3. **Mobile `CoachScreen` branding injection** — When State C loads and branding fields are present, synthesize a `ThemePalette` from `brand_primary_color` and call `useThemeStore.setTheme()` (or better: a new `setDynamicTheme(palette)` action that accepts an arbitrary `ThemePalette` object, bypassing the `THEME_REGISTRY` lookup).
4. **Web coach branding editor** — Color picker (hex input + swatch), logo upload (signed URL), coaching tone selector (4 presets), live preview card, save button.
5. **Pro gate** — Gray out the section for free coaches with upgrade CTA.

Defer:
- Secondary color picker: ship with a computed default (`primary` at 15% opacity). Coach can override later.
- Coaching tone effect on AI: requires Persona plugin system prompt awareness of linked coach — ship as Phase 2 of this workstream.
- Logo in email notifications: depends on v1.11 Notification System workstream.

---

## Coach Branding Editor UX (Web)

Based on industry patterns (FITR, Gymkee, Everfit) and Ziko's existing design system:

**Layout:** Single settings page under `/coach/settings` → "Direction Artistique" tab or sub-section.

**Sections (in order):**
1. **Couleurs** — Primary hex input + color swatch (128px circle preview). Secondary hex input (optional, shows computed default if empty). Live preview card refreshes on each change.
2. **Logo** — Drag-drop upload zone (PNG/SVG, max 2 MB). Shows current logo with delete button. Uses existing signed URL upload pattern.
3. **Ton de coaching** — 4-card selector matching existing persona plugin styles: Motivant (fire icon), Analytique (chart icon), Bienveillant (heart icon), Exigeant (lightning icon). Single selection with radio-style highlight.
4. **Apercu** — Read-only preview panel showing a mock "Mon coach" State C card with coach's name, photo, logo, and colors applied.
5. **Save button** — Saves all fields in one PATCH. Shows success toast.

**Confidence:** MEDIUM — pattern confirmed from competitor research; specific layout is a design decision.

---

## Athlete-Side Experience

**Subtle theming, not full skin.** The platform skeleton (navigation structure, component layout, fonts) stays identical. Only brand tokens change:

- `theme.primary` → coach's `brand_primary_color`
- `theme.primaryLight` → computed (primary at 15% opacity)
- `theme.tabBarActive` → coach's primary color
- All other fields → keep platform defaults (background `#F7F6F3`, surface `#FFFFFF`, etc.)

**Expected behavior:**
- State A (no coach linked): athlete's personal theme applies normally
- State B (preview): preview card uses coach's primary color for the "Rejoindre" CTA button
- State C (linked): coach branding applies globally on app launch/refresh. Athlete sees a colored banner/logo in "Mon coach" plugin. All plugin primary-colored elements (buttons, progress rings, chips) show coach brand color.
- After revoke: `resetTheme()` restores athlete's personal theme immediately

**Not expected by athletes:** The coach's logo appearing on every screen, the app icon changing, push notifications being rebranded. These would feel invasive rather than helpful.

**Confidence:** HIGH — this matches the "subtle theming" industry pattern observed across Gymkee, FITR, Everfit; confirmed appropriate for a shared-platform model (not a standalone white-label app).

---

## Complexity Assessment (for roadmap sizing)

| Phase | Work | Complexity | Estimate |
|-------|------|------------|----------|
| DB migration (branding columns on `coach_profiles`) | SQL migration, RLS update | Low | 0.5 day |
| Backend: extend preview endpoint + PATCH branding endpoint | Add fields to existing route, new PATCH handler with Zod validation | Low-Medium | 1 day |
| Mobile: branding injection in `CoachScreen` | `setDynamicTheme()` in useThemeStore, apply in State B + C, reset on revoke | Medium | 1–1.5 days |
| Web: branding editor UI | Hex input + swatch, logo upload (reuse signed URL), tone selector, preview card | Medium | 2 days |
| Pro tier gate | Check `tier` in web UI + backend | Low | 0.5 day |
| **Total** | | | **5–6 days** |

---

## Sources

- FITR white-label customization: https://www.coachwithfitr.com/white-label (HIGH confidence — official product docs)
- Gymkee custom branding: https://gymkee.com/coach/branding/custom-branding/ (HIGH confidence — official product docs)
- Everfit standard custom branding: https://help.everfit.io/en/articles/4292647-standard-custom-branding-personalize-your-client-app-experience (HIGH confidence — official help center)
- NativeWind dynamic theming: https://www.nativewind.dev/v5/guides/themes (MEDIUM confidence — official docs, version compatibility TBC)
- Trainerize branding overview: https://www.trainerize.com/blog/best-white-label-coaching-apps-2026/ (MEDIUM confidence — blog, not feature docs)
- Existing codebase: `packages/plugin-sdk/src/theme.ts`, `plugins/coach/src/screens/CoachScreen.tsx`, `supabase/migrations/029_persona_coaching_style.sql`, `supabase/migrations/034_coach_role_profiles.sql` (HIGH confidence — direct code audit)
