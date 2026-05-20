# Requirements — v1.6 Mobile v2

**Workstream:** milestone-mobile  
**Milestone:** v1.6 Mobile v2  
**Status:** Active  
**Last updated:** 2026-05-18

---

## Plugin "Mon coach" Mobile

### Scaffolding & Mandatory Pattern

- [x] **COACH-01**: The `plugins/coach/` directory exists with a complete manifest.ts (default export, `id: 'coach'`, `mandatory: true`, `showInTabBar: false`, Ionicons icon, fr+en metadata, `routes`, `aiTools`, `aiSkills`).
- [x] **COACH-02**: The coach plugin is registered in `apps/mobile/src/lib/PluginLoader.tsx` static `PLUGIN_LOADERS` map.
- [x] **COACH-03**: The plugin is automatically installed (`user_plugins` record with `is_enabled: true`) for any user with `role = 'client' | 'both'` on first sign-in.
- [ ] **COACH-04**: The "Désinstaller" button in the plugin settings UI is grayed out and non-interactive for the coach plugin; a tooltip explains it is mandatory.
- [ ] **COACH-05**: A spike (`/gsd-spike`) validates the mandatory enforcement approach before implementation (data-driven `user_plugins.is_mandatory` vs registry-driven `manifest.mandatory: true`).

### Screen UX — 3 States

- [ ] **COACH-06**: State A — when no coach is linked, the screen displays a single `<TextInput maxLength={6}>` with auto-uppercase, charset filter `[A-Z2-9]`, paste support, and a submit CTA enabled only when 6 valid characters are entered.
- [ ] **COACH-07**: After entering a valid code, the screen shows State B — a coach preview card (photo, display_name, specialties chips, bio, KYC badge) with "Lier mon compte" CTA and "Annuler" link; preview data comes from `GET /coach/clients/links/preview?code=XXXXXX`.
- [ ] **COACH-08**: After confirming, the screen shows State C — the coach card with link metadata ("Lié depuis [date]") and a "Retirer ce coach" action.
- [ ] **COACH-09**: Error messages in State A use constant-time copy (same message regardless of whether the code exists or not) to prevent enumeration attacks.
- [ ] **COACH-10**: A Figma design contract (via `/gsd-ui-phase`) is produced before any screen implementation; the design uses light sport theme (`#FF5C1A` primary, `#F7F6F3` bg, cards with `shadowOpacity 0.08, radius 12, elevation 3`).

### Revocation from Settings

- [ ] **COACH-11**: `apps/mobile/app/(app)/settings.tsx` includes a "Mon coach" section visible only when `role = 'client' | 'both'` and a coach is linked.
- [ ] **COACH-12**: Tapping "Retirer ce coach" opens a typed-confirmation modal requiring the user to type "COACH" before the confirm button becomes active.
- [x] **COACH-13**: On confirmation, the mobile app calls `DELETE /coach/clients/links/:id` (already shipped in Phase 25), clears local state, and returns the screen to State A.

### i18n

- [x] **COACH-14**: All user-facing strings use `useTranslation()` from `@ziko/plugin-sdk` with a new `coach.*` key namespace; both `fr` and `en` translation files are complete.

### AI Tools (Optional)

- [ ] **COACH-15**: The plugin manifest declares `aiTools: [coach_get_link, coach_revoke_link]` with JSON Schema parameters; the tools are registered in the backend AI tool registry.

---

## UI Design Catch-Up — Phase 24 Web Surfaces

- [ ] **UIDESIGN-01**: A `/gsd-ui-phase` session produces a Figma design file and `UI-SPEC.md` for `/coach/onboarding` 3-step wizard (shipped without design in Phase 24).
- [ ] **UIDESIGN-02**: A `/gsd-ui-phase` session produces a Figma design file and `UI-SPEC.md` for `/coach/dashboard` welcome card + sidebar (shipped without design in Phase 24).
- [ ] **UIDESIGN-03**: A `/gsd-ui-phase` session produces a Figma design file and `UI-SPEC.md` for `/coach/settings` profile + KYC sections (shipped without design in Phase 24).
- [ ] **UIDESIGN-04**: A `/gsd-ui-phase` session produces a Figma design file and `UI-SPEC.md` for the `/fr/login` form page (shipped without design in Phase 24).
- [ ] **UIDESIGN-05**: Each Phase 24 surface is audited against its new design contract via `/gsd-ui-review`; a rework plan is created for any deviations found.

---

## Out of Scope (v1.6)

- Mobile plugin audit (Phases 1–21) — deferred; will be its own phase in a future milestone
- `workflow.ui_phase` config gate hardening — deferred
- Real-time coach messaging — already deferred in v1.5 (MOBILE-06)
- New backend endpoints — none required; Phase 25 routes cover all plugin needs

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| COACH-01 | Phase 29 | TBD |
| COACH-02 | Phase 29 | TBD |
| COACH-03 | Phase 29 | TBD |
| COACH-04 | Phase 29 | TBD |
| COACH-05 | Phase 27 | TBD |
| COACH-06 | Phase 29 | TBD |
| COACH-07 | Phase 29 | TBD |
| COACH-08 | Phase 29 | TBD |
| COACH-09 | Phase 29 | TBD |
| COACH-10 | Phase 28 | TBD |
| COACH-11 | Phase 29 | TBD |
| COACH-12 | Phase 29 | TBD |
| COACH-13 | Phase 29 | TBD |
| COACH-14 | Phase 29 | TBD |
| COACH-15 | Phase 31 | TBD |
| UIDESIGN-01 | Phase 30 | TBD |
| UIDESIGN-02 | Phase 30 | TBD |
| UIDESIGN-03 | Phase 30 | TBD |
| UIDESIGN-04 | Phase 30 | TBD |
| UIDESIGN-05 | Phase 30 | TBD |
