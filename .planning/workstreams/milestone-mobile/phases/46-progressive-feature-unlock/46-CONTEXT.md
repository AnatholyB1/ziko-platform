# Phase 46 CONTEXT - Progressive Feature Unlock (decisions locked 2026-11-07)
Reqs GATE-01..04.
- D-01 `PluginManifest.minLevel?: number` (default 1). Gating in PluginLoader: mandatory -> minLevel -> is_enabled. No DB column.
- D-02 Effective level = athlete tier (Phase 45 writes points+tier only; level derived from tier on the read side, scale 1-5, clamp). Read `ziko_athlete_state` (tier, level) in authStore; no row => 1 (fail-safe floor, never zero access).
- D-03 Level map: N1 coach(mandatory), habits, nutrition, timer, hydration, stretching, rpe; N2 journal, sleep, measurements, stats, pantry, persona; N3 gamification, cardio, community, wearables; N4 ai-programs, supplements. (N5 headroom.)
- D-04 Drawer: unlocked grid unchanged; separate "A debloquer" section below with greyed tiles + lock icon + "Niv. N" badge; tap => showAlert explaining required level. Needs static id->{name,icon,minLevel} source for locked plugins (not registered by loader).
- D-05 Already-installed plugins above level are re-locked (data kept) + shared route guard in apps/mobile/app/(app)/(plugins)/_layout.tsx against deep links.
- D-06 Level refetched at app foreground and after the weekly-review overlay (authStore field the loader subscribes to); level-up registers new plugins without restart. Unlock toast reusing CreditEarnToast pattern.
- D-07 UI rules: light theme only, inline styles, Ionicons (no emoji), showAlert, paddingBottom 100; mockup-first exact match (design contract validated before UI build).
- No migrations.
Canonical refs: packages/plugin-sdk types, apps/mobile/src/lib/PluginLoader.tsx, packages/ui/src/components/PluginsDrawer.tsx, authStore.
