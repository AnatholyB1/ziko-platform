---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [zustand, theme, react-native, plugin-sdk, typescript]

# Dependency graph
requires: []
provides:
  - setCustomTheme(overrides: Partial<ThemePalette>) action dans useThemeStore avec auto-dérivation de primaryLight et tabBarActive
  - clearCoachTheme() action dans useThemeStore délégant à resetTheme()
affects: [da-coach/phases/01-foundation/01-03, da-coach/phases/03-mobile-injection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coach branding via setCustomTheme({ primary }) — dérive automatiquement primaryLight = primary + '15' et tabBarActive = primary depuis DEFAULT_THEME"
    - "clearCoachTheme = alias nommé de resetTheme() pour un seul chemin de reset"

key-files:
  created: []
  modified:
    - packages/plugin-sdk/src/theme.ts

key-decisions:
  - "tabBarActive et primaryLight sont toujours auto-dérivés depuis primary — jamais lus depuis overrides directement (sécurité T-02-02)"
  - "clearCoachTheme délègue à get().resetTheme() pour maintenir un seul chemin de reset"
  - "create() signature étendue de (set) à (set, get) pour permettre clearCoachTheme d'appeler get().resetTheme()"
  - "Pas de persistance MMKV — in-memory only, conformément au périmètre Phase 1"

patterns-established:
  - "Auto-dérivation primaryLight: primary + '15' pour toute palette custom"
  - "Spread pattern: { ...DEFAULT_THEME, ...overrides, primaryLight, tabBarActive } garantit que les tokens dérivés ne peuvent pas être surchargés par l'appelant"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-05-26
---

# Phase 01-02: Add setCustomTheme and clearCoachTheme to useThemeStore — Summary

**Deux nouvelles actions Zustand dans useThemeStore : setCustomTheme auto-dérive primaryLight et tabBarActive depuis primary, clearCoachTheme est un alias nommé de resetTheme() pour le reset du branding coach.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-26T00:00:00Z
- **Completed:** 2026-05-26T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- ThemeState interface étendue avec `setCustomTheme: (overrides: Partial<ThemePalette>) => void` et `clearCoachTheme: () => void`
- `setCustomTheme` implémenté avec spread `{ ...DEFAULT_THEME, ...overrides, primaryLight, tabBarActive }` et auto-dérivation depuis `primary`
- `clearCoachTheme` délègue à `get().resetTheme()` — chemin de reset unique
- Signature `create()` mise à jour de `(set)` à `(set, get)` pour accès à `get().resetTheme()`
- Type-check monorepo : zéro erreur TypeScript dans plugin-sdk/src/theme.ts

## Task Commits

1. **Task 1: Add setCustomTheme and clearCoachTheme to useThemeStore** - `43857dd` (feat)

**Plan metadata:** (à créer dans le commit final)

## Files Created/Modified
- `packages/plugin-sdk/src/theme.ts` - Interface ThemeState et store useThemeStore étendus avec les deux nouvelles actions

## Decisions Made
- `tabBarActive` et `primaryLight` sont calculés depuis `primary` dans `setCustomTheme`, jamais lus depuis `overrides` directement — conformément à T-02-02 du threat model
- `clearCoachTheme` délègue à `get().resetTheme()` plutôt que d'appeler `set()` directement, conservant un seul chemin de reset (D-12)
- Pas de persistance MMKV dans ce plan — scope Phase 3

## Deviations from Plan

None - plan exécuté exactement comme spécifié.

## Issues Encountered

None.

## User Setup Required

None - aucune configuration de service externe requise.

## Next Phase Readiness

- `setCustomTheme` et `clearCoachTheme` sont disponibles dans `useThemeStore` du plugin-sdk
- Phase 3 (Mobile Injection) peut appeler `setCustomTheme({ primary: brandHex })` dès qu'un lien coach est activé
- `clearCoachTheme()` restore le thème Ziko par défaut quand un lien est révoqué

---

## Self-Check

- [x] `packages/plugin-sdk/src/theme.ts` modifié et existant
- [x] Commit `43857dd` vérifié dans git log
- [x] `grep -n "setCustomTheme\|clearCoachTheme"` retourne 4 lignes (interface x2, implémentation x2)
- [x] Type-check : zéro erreur dans plugin-sdk/src/theme.ts

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-05-26*
