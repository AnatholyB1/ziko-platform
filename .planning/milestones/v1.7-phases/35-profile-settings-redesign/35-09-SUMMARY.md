---
phase: 35-profile-settings-redesign
plan: 09
subsystem: ui
tags: [react-native, expo-router, linking, faq, help-screen, settings]

requires:
  - phase: 35-profile-settings-redesign
    provides: settings.tsx avec STGroup/STRow (plan 35-03 à 35-08)

provides:
  - "help.tsx — Centre d'aide avec 4 groupes FAQ dépliables (13 Q/R en français)"
  - "settings.tsx — row Centre d'aide navigue vers /(app)/profile/help"
  - "settings.tsx — row 'Noter l'app' ouvre App Store (iOS) ou Play Store (Android)"

affects: [35-profile-settings-redesign, 35-10, 35-11]

tech-stack:
  added: []
  patterns:
    - "FAQ dépliable via Set<string> local state + toggle() function"
    - "Linking.openURL avec Platform.OS pour redirection store par plateforme"

key-files:
  created:
    - apps/mobile/app/(app)/profile/help.tsx
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx

key-decisions:
  - "URLs stores hardcodées (App Store id6744155867 avec TODO, Play Store com.ziko.mobile) — pas de paramètre utilisateur, pas d'injection possible (T-35-09-01 accepté)"
  - "Cards custom pour FAQ plutôt que STRow — chaque item nécessite un contenu dépliable Text, incompatible avec STRow"
  - "Task 2 déjà satisfaite par le commit 35-08 (b19e2ea) — les modifications étaient déjà en place"

requirements-completed: [SET-01]

duration: 8min
completed: 2026-05-22
---

# Phase 35 Plan 09: Centre d'aide FAQ + Linking store rating Summary

**help.tsx créé avec 13 Q/R en 4 groupes dépliables et settings.tsx câblé vers App Store/Play Store via Linking.openURL**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-22T12:43:53Z
- **Completed:** 2026-05-22T12:52:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Créé `help.tsx` — Centre d'aide avec 4 groupes (Démarrage, Séances, Abonnement, Compte), 13 Q/R réelles en français, toggle dépliable par item via `Set<string>`
- Câblé la row "Centre d'aide" dans settings.tsx vers `/(app)/profile/help` (chemin corrigé)
- Câblé la row "Noter l'app" avec `Linking.openURL` Platform-aware (App Store sur iOS, Play Store sur Android) avec fallback showAlert
- 0 erreurs TypeScript à la fin de l'exécution

## Task Commits

1. **Task 1: Créer help.tsx** - `5d04ce9` (feat)
2. **Task 2: Câbler settings.tsx** - `b19e2ea` (feat — déjà committé par plan 35-08)

**Plan metadata:** (docs commit ci-dessous)

## Files Created/Modified

- `apps/mobile/app/(app)/profile/help.tsx` — Centre d'aide avec 4 groupes FAQ, toggle dépliable, SafeAreaView + ScrollView paddingBottom:100
- `apps/mobile/app/(app)/profile/settings.tsx` — row Centre d'aide + Linking.openURL stores (modifié dans 35-08, vérifié intact)

## Decisions Made

- Cards custom (bg:surface, borderRadius:12, shadow md) pour la FAQ au lieu de STRow — les items dépliables nécessitent un bloc Text de réponse qui ne rentre pas dans le pattern STRow
- App Store ID `id6744155867` conservé avec commentaire TODO — l'app n'est pas encore publiée, placeholder à remplacer
- Séparateurs 1px entre items via `borderTopWidth` conditionnel (index > 0), style identique à STGroup

## Deviations from Plan

### Note — Task 2 déjà satisfaite

**[Observation] settings.tsx déjà à jour par le plan 35-08**
- **Found during:** Task 2 (vérification du fichier actuel)
- **Issue:** Le plan 35-08 (`b19e2ea feat(35-08): corriger données hardcodées dans settings.tsx`) avait déjà appliqué les modifications : route `profile/help` et `Linking.openURL` avec les URLs stores
- **Action:** Vérification confirmée — contenu identique à ce que le plan 35-09 demandait. Aucune modification supplémentaire requise. Commit de Task 2 référencé : `b19e2ea`
- **Impact:** Aucun, plan exécuté dans l'état correct

---

**Total deviations:** 0 auto-fixes — plan exécuté comme prévu (Task 2 déjà commitée par 35-08)
**Impact:** Aucun impact négatif.

## Issues Encountered

None

## User Setup Required

None — pas de service externe requis.

## Next Phase Readiness

- Plan 35-09 complet : help.tsx disponible, navigation settings.tsx opérationnelle
- Prêt pour plan 35-10 (prochain plan de la phase 35)
- TODO restant : remplacer l'App Store ID placeholder `id6744155867` par le vrai ID lors de la publication

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
