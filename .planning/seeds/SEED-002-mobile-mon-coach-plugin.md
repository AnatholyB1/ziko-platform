---
id: SEED-002
status: dormant
planted: 2026-05-17
planted_during: v1.5 — Phase 25 (Invitations & Mobile "Mon coach" Minimal) discussion
trigger_when: v1.6 milestone planning (or any next-milestone scope touching client-side mobile coach UX)
scope: Large — a full milestone
related_phase: 25 (CONTEXT.md `<deferred>` section)
---

# SEED-002: Mobile "Mon coach" plugin — pre-installed, non-uninstallable, full UX

## Why This Matters

Phase 25 ships the **link primitive** (backend `coach/invitations` + `coach/clients` modules,
constant-time redemption, Upstash rate limiting) and a **web-only redemption loop** so the
v1.5 milestone closes end-to-end. But Ziko's primary surface for athletes is the mobile
app — every athlete-facing feature in v1.0–v1.4 lives in the 17 existing plugins. Without
a mobile "Mon coach" surface, an athlete who receives an invitation code from their coach
has to leave the app, find the share link in a browser, log in on web, and redeem there.
That's a broken funnel for a product whose mobile experience is the entire value prop.

**Strategic value:**
- Closes the coach↔athlete loop where athletes actually live (mobile)
- Unlocks Phase 27 prerequisites (mobile athlete must see "prescribed program" + coach
  card BEFORE Phase 27 can ship its full "Mon coach" view per ROADMAP §Phase 27 SC4)
- Validates the bounded-context backend design under a second consumer (web is the first)
- Establishes the pre-installed / mandatory plugin pattern that future coach-side
  mobile features (compliance widget, contact CTA, prescribed programs) will reuse

**Why deferred:**
- v1.5 scope is the coach **platform** + CRM. Mobile reshaping is a separate concern
  large enough to warrant its own milestone runway.
- Design-first rule: the user wants the plugin designed in Claude Design / Figma BEFORE
  execute, and that design contract is best produced once for the full plugin rather
  than retrofit onto a minimal Phase 25 surface.

## When to Surface

**Trigger:** v1.6 milestone planning (the milestone immediately following v1.5).

This seed should be presented during `/gsd-new-milestone` when the milestone scope
matches any of these conditions:
- Milestone theme mentions "mobile", "Mon coach", "athlete-side coach UX", "plugin",
  "client mobile surface", or any keyword tied to mobile coach-link features.
- Milestone follows v1.5 in version order (so v1.6, v1.6.0, v2.0, etc.).
- Milestone explicitly references closing the Phase 25 web-only loop on mobile.

If v1.6 is themed around something unrelated (e.g., pure backend / infra), the seed
stays dormant until the next mobile-relevant milestone.

## Scope Estimate

**Large — a full milestone.** Breakdown the planner should expect:

1. **Plugin scaffolding & registry**
   - New `plugins/coach/` (id TBD: `coach` / `mon-coach` / `coach-link`) following the
     17 existing plugin patterns.
   - Register in `apps/mobile/src/lib/PluginLoader.tsx` static map.
   - Manifest with `requiredPermissions`, `routes`, `showInTabBar: true`.

2. **Pre-installed + non-uninstallable enforcement**
   - Research / extend `user_plugins` table — add `is_mandatory BOOLEAN` (or repurpose
     `is_enabled` + a registry-level mandatory flag).
   - Auto-install on first sign-in for `role = 'client' | 'both'` users.
   - Block uninstall via plugin settings UI (gray out "Désinstaller" button).

3. **Screen UX (state-aware, mirrors Phase 25 web `/redeem`)**
   - State A — no code: code-entry input + submit CTA.
   - State B — preview: coach card (photo, display_name, specialties chips, bio, KYC
     badge) + "Lier mon compte" CTA + "Annuler" link.
   - State C — linked: coach card + link info ("depuis [date]") + "Retirer ce coach"
     action that opens typed-confirmation modal.

4. **Code entry input**
   - Single `<TextInput maxLength={6}>` with auto-uppercase + charset filter `[A-Z2-9]`.
   - Paste support. Submit enabled at 6 valid chars.
   - Inline error messaging (constant-time copy).

5. **Revoke from mobile settings**
   - New "Mon coach" section in `apps/mobile/app/(app)/settings.tsx`.
   - Typed-confirmation modal ("Tapez COACH").
   - Calls `DELETE /coach/clients/links/:id` (already shipped in Phase 25).

6. **Design contract (Claude Design / Figma)**
   - Phase 25's `/gsd-ui-phase 25` step (D-03) must produce the design prompt for THIS
     plugin too. Seed inherits the prompt — execute phase consumes the Figma file.
   - Light sport theme (#FF5C1A primary, #F7F6F3 bg, light cards with shadow).
   - Must match Ziko's existing plugin visual language (cards with shadow:
     `shadowOpacity 0.08, radius 12, elevation 3`).

7. **Zero new backend work**
   - Reuses Phase 25 routes verbatim: `/coach/clients/links/preview`,
     `/coach/clients/links/redeem`, `/coach/clients/links/me`, `/coach/clients/links/:id`
     (DELETE). Rate limiting already in place.

8. **i18n**
   - `useTranslation()` from `@ziko/plugin-sdk` (mobile pattern). New keys under
     `coach.*` namespace. fr + en.

9. **AI integration (optional, scope decision)**
   - `aiSkills` + `aiTools` for the new plugin — possibly `coach_get_link`,
     `coach_revoke_link`. Or defer to a later phase.

## Related Deferred Work (NOT a separate seed yet — user may promote later)

### Retroactive UI design catch-up (Phase 24 surfaces + earlier mobile UI)

Phase 24 shipped these surfaces WITHOUT a `/gsd-ui-phase` step:
- `/coach/onboarding` 3-step wizard
- `/coach/dashboard` welcome card + sidebar
- `/coach/settings` profile + KYC sections
- `/fr/login` form

Earlier mobile UI surfaces (Phases 1–21) likely have the same gap — audit during v1.6
planning. Action: open a v1.6 phase "UI Design Catch-Up" that produces a Figma file +
retroactive UI-SPEC.md for each shipped surface, plus design QA pass and rework where
needed.

### Make UI-design-first automatic

Verify `.planning/config.json` `workflow.ui_phase: true` + `workflow.ui_safety_gate: true`
actually block `/gsd-plan-phase {N}` when ROADMAP says `UI hint: yes` AND no
`{N}-UI-SPEC.md` exists. If not enforced, harden in GSD workflow files (likely
`plan-phase.md` precondition check).

## Breadcrumbs

### Backend that will power this seed (already shipped after Phase 25)
- `backend/api/src/coach/clients/service.ts` — link primitive routes (Phase 25)
- `backend/api/src/coach/invitations/service.ts` — invitation routes (Phase 25, mostly
  coach-side but redemption-related types live here)
- `backend/api/src/middleware/rateLimit.ts` — Upstash rate-limit middleware (Phase 25)
- `packages/coach-sdk/src/schemas/coach-client-link.ts` — `CoachClientLinkSchema` +
  `isLinkActive(link)` helper
- `packages/coach-sdk/src/schemas/coach-profile.ts` — `CoachProfileSchema` for preview
- `supabase/migrations/035_coach_invitations_links_rls.sql` — DB tables + RPC
- `.planning/phases/25-invitations-mobile-mon-coach-minimal/25-CONTEXT.md` — full
  Phase 25 decisions; D-14..D-18 describe the web flow this plugin mirrors

### Mobile plugin patterns to follow
- `apps/mobile/src/lib/PluginLoader.tsx` — static `PLUGIN_LOADERS` map; plugin
  registration pattern
- `apps/mobile/app/(app)/(plugins)/` — file-based route registration for plugin screens
- `plugins/habits/`, `plugins/nutrition/`, `plugins/cardio/` — exemplary plugin shapes
  (manifest + screens + store + i18n)
- `packages/plugin-sdk/` — shared hooks, theme, alert, i18n primitives
- `apps/mobile/src/components/CustomAlert.tsx` + `showAlert` from `@ziko/plugin-sdk` —
  alert pattern (must NOT use `Alert` from `react-native`)

### Design system references
- `CLAUDE.md` §Design System — tokens (Background `#F7F6F3`, Primary `#FF5C1A`, etc.)
- `index.html` at repo root — design prototype mockup, source of truth for visual
  language (cards with shadow `shadowOpacity 0.08, radius 12, elevation 3`)
- Memory: `reference_mockup.md` — confirms the design system tokens

### Workflow / process references
- Memory: `feedback_ui_design_first.md` — UI design via Claude Design must run BEFORE
  `/gsd-execute-phase` for any phase with a visual deliverable
- Memory: `feedback_recommend_lead.md` — discuss-phase pattern (lead with recommended
  option + scope-pivot alternatives)

## Notes

- The plugin id and display name are intentionally left TBD — defer to the milestone
  planning step where the user picks among `coach`, `mon-coach`, `coach-link`. All three
  options were surfaced during Phase 25 discussion and none was locked.
- "Pre-installed and non-uninstallable" is an architectural change to the plugin
  registry. Spike (or `/gsd-spike`) recommended early in v1.6 to decide between
  `user_plugins.is_mandatory` (data-driven) vs a `manifest.mandatory: true` field
  (registry-driven).
- This seed assumes the v1.6 milestone follows immediately after v1.5 closes. If a
  different milestone slides in between (e.g., v1.6 becomes pure infra), the seed
  trigger should re-evaluate.
