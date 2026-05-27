---
phase: 40
plan: "40-05"
subsystem: packages/ui + mobile screens
tags: [ui-components, empty-state, error-screen, phase-40]
dependency_graph:
  requires: [40-01, 40-02, 40-03, 40-04]
  provides: [EmptyState, ErrorScreen]
  affects: [notifications, calendar, SearchOverlay, ai/chat, store/index]
tech_stack:
  added: []
  patterns: [variant-config-object, guard-return-pattern, inline-style-objects]
key_files:
  created:
    - packages/ui/src/components/EmptyState.tsx
    - packages/ui/src/components/ErrorScreen.tsx
  modified:
    - packages/ui/src/index.ts
    - apps/mobile/app/(app)/notifications.tsx
    - apps/mobile/app/(app)/calendar.tsx
    - apps/mobile/src/components/SearchOverlay.tsx
    - apps/mobile/app/(app)/ai/chat.tsx
    - apps/mobile/app/(app)/store/index.tsx
decisions:
  - "EmptyState icon container uses borderWidth: 1 borderColor #E2E0DA pour contraste sur fond #F7F6F3"
  - "store/index.tsx utilise useCallback/useEffect (pas useQuery) donc loadError via useState local"
  - "calendar.tsx EmptyState affiché sous la grille quand 0 séances, remplace le texte résumé"
  - "ai/chat.tsx ErrorScreen déclenché sur creditsError (query TanStack) avec onGoBack vers router.back()"
metrics:
  duration: "8 min"
  completed: "2026-05-27"
  tasks_completed: 2
  files_modified: 8
---

# Phase 40 Plan 05: EmptyState + ErrorScreen Components Summary

**One-liner:** Composants EmptyState (4 variants) et ErrorScreen (4 variants) créés dans `@ziko/ui` et intégrés dans 5 écrans Phase 40.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Créer EmptyState.tsx + ErrorScreen.tsx + update index.ts | 7f3dbba |
| 2 | Intégrer dans notifications, calendar, SearchOverlay, chat, store | 0946129 |

## What Was Built

### EmptyState (`packages/ui/src/components/EmptyState.tsx`)
Composant centré `flex:1` avec 4 variants :
- `no-data` → `file-tray-outline` (#E2E0DA)
- `error` → `warning-outline` (#F59E0B)
- `offline` → `wifi-outline` (#6B6963)
- `no-results` → `search-outline` (#E2E0DA)

Props : `variant`, `title` (requis), `message?`, `ctaLabel?`, `onCta?`. CTA bouton primary (#FF5C1A) si `ctaLabel` + `onCta` fournis.

### ErrorScreen (`packages/ui/src/components/ErrorScreen.tsx`)
Écran plein écran `SafeAreaView` avec 4 variants :
- `generic` → `alert-circle-outline` + "Une erreur est survenue"
- `network` → `cloud-offline-outline` + "Pas de connexion"
- `auth` → `lock-closed-outline` + "Session expirée"
- `not-found` → `compass-outline` + "Page introuvable"

Props : `variant`, `onRetry?`, `onGoBack?`. Titre/message par défaut intégrés dans VARIANT_CONFIG.

### Intégrations écrans
- **notifications.tsx** : EmptyState `no-data` (état vide) + `error` avec retry `queryClient.invalidateQueries`
- **calendar.tsx** : EmptyState `error` (remplace texte inline) + `no-data` sous grille quand 0 séances avec CTA "Démarrer une séance"
- **SearchOverlay.tsx** : EmptyState `no-results` (height:80) dans les 3 sections résultats (exercices, programmes, utilisateurs)
- **ai/chat.tsx** : ErrorScreen `network` sur `creditsError` avec `onGoBack={() => router.back()}`
- **store/index.tsx** : ErrorScreen `network` via `loadError` state local sur `plugins_registry` query failure

## Deviations from Plan

### Auto-added improvements

**1. [Rule 2 - Missing functionality] EmptyState error dans notifications.tsx**
- Notifications avait déjà `isError` dans sa query — le plan le mentionnait mais l'écran existant ne l'utilisait pas
- Ajout du cas `if (isError)` dans `renderEmpty()` avec `EmptyState variant="error"` et retry via `queryClient.invalidateQueries`

**2. [Rule 2 - Missing functionality] Calendar EmptyState pour 0 séances**
- Calendar avait un texte "0 séances en janvier" pour le mois vide — remplacé par EmptyState `no-data` avec CTA
- Le texte résumé reste affiché uniquement quand `Object.keys(sessionsByDate).length > 0`

**3. [Rule 1 - Adaptation] store/index.tsx utilise useState au lieu de useQuery**
- store/index.tsx n'utilise pas TanStack Query — il utilise `useCallback + useEffect`
- Solution : ajout `loadError: boolean` via `useState`, mis à `true` si `regRes.error` dans `load()`

## Known Stubs

Aucun stub. Tous les composants sont fonctionnels et les intégrations passent des données réelles.

## Threat Flags

Aucun nouveau point d'entrée réseau ou chemin d'authentification introduit. Composants purement visuels.

## Self-Check: PASSED

- packages/ui/src/components/EmptyState.tsx : FOUND
- packages/ui/src/components/ErrorScreen.tsx : FOUND
- Index exports (EmptyState + ErrorScreen) : 2 lignes
- EmptyState variants (no-data/offline/no-results/error) : 5 occurrences
- ErrorScreen variants (generic/network/auth/not-found) : 5 occurrences
- 5 fichiers écrans avec EmptyState ou ErrorScreen : 5/5
- Commits 7f3dbba et 0946129 : FOUND
