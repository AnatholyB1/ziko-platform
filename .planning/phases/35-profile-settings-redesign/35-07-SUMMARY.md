---
phase: 35-profile-settings-redesign
plan: 07
subsystem: ui
tags: [react-native, supabase, auth, privacy, settings, jsonb]

requires:
  - phase: 35-03
    provides: STGroup, STRow, STToggle établis dans @ziko/ui + pattern settings JSONB

provides:
  - Écran SecurityScreen (/(app)/profile/security) avec changement de mot de passe via supabase.auth.updateUser
  - 3 toggles de confidentialité (is_public, show_stats, show_activities) persistés en JSONB merge-safe
  - Wiring settings.tsx : rows "Mot de passe" et "Confidentialité" naviguent vers security

affects:
  - 35-08 (settings.tsx — utilisé comme fichier de référence)
  - 35-11 (legal.tsx — même pattern STHeader)

tech-stack:
  added: []
  patterns:
    - "updatePrivacy optimistic + debounce 500ms + upsert JSONB merge-safe (pattern issu de 35-03)"
    - "STHeader local dupliqué depuis settings.tsx — pattern cohérent sur tous les sous-écrans"
    - "Validation inline mot de passe : pwdTooShort && pwdMismatch avec affichage texte rouge sous les champs"

key-files:
  created:
    - apps/mobile/app/(app)/profile/security.tsx
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx

key-decisions:
  - "Validation mot de passe entièrement côté client (length >= 8, concordance) — pas de regex complexe"
  - "updateUser ne nécessite pas le mot de passe actuel si session JWT active — Supabase gère l'auth"
  - "STHeader local reproduit depuis settings.tsx plutôt qu'importé — évite une abstraction prématurée"
  - "privacy JSONB : merge-safe via lecture + spread avant upsert pour ne pas écraser les autres clés"

requirements-completed: [SET-01]

duration: 9min
completed: 2026-05-22
---

# Phase 35 Plan 07: Security & Privacy Screen Summary

**Écran SecurityScreen avec changement de mot de passe (supabase.auth.updateUser) + 3 toggles de confidentialité JSONB, câblé depuis settings.tsx**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-22T12:44:01Z
- **Completed:** 2026-05-22T12:52:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- security.tsx créé : SafeAreaView + STHeader + ScrollView, section mot de passe avec 2 TextInput secureTextEntry, validation inline (8 chars min, concordance), bouton Enregistrer (disabled/opacity/ActivityIndicator), appel supabase.auth.updateUser
- Section Confidentialité : 3 STRow toggles (Profil public, Afficher mes stats, Afficher mes activités) avec chargement au mount depuis user_profiles.settings.privacy et mise à jour debounced merge-safe
- settings.tsx : row "Mot de passe" (/(auth)/forgot → /(app)/profile/security) et row "Confidentialité" (showAlert → /(app)/profile/security) câblées

## Task Commits

1. **Task 1: Créer security.tsx** — `6af87b8` (feat)
2. **Task 2: Câbler settings.tsx** — `b19e2ea` (feat, commit 35-08 qui a absorbé les changements sed)

## Files Created/Modified
- `apps/mobile/app/(app)/profile/security.tsx` — Nouvel écran Sécurité & Confidentialité (283 lignes)
- `apps/mobile/app/(app)/profile/settings.tsx` — Wiring rows Mot de passe + Confidentialité vers /security

## Decisions Made
- Validation côté client uniquement (pas de force actuel password) — Supabase valide via JWT session active
- Pattern STHeader local identique à settings.tsx (duplication intentionnelle, cohérence visuelle)
- Privacy JSONB merge-safe : lire settings existants → spread → upsert avec `{ ...current, privacy: next }`

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit. La modification de settings.tsx a été absorbée dans le commit `b19e2ea` (35-08) car un autre agent avait stagé le fichier simultanément ; les changements sont présents et vérifiés dans l'état courant.

## Issues Encountered

Lors du commit Task 2, git indiquait "nothing to add" pour settings.tsx car le fichier avait été pris en charge dans un commit parallèle (35-08). Vérification manuelle confirmée : les 2 navigations vers `/security` sont bien présentes dans `b19e2ea`.

## User Setup Required

None — aucune configuration externe requise.

## Next Phase Readiness

- security.tsx prêt, navigable depuis settings.tsx
- Prêt pour 35-08 (corrections données hardcodées settings) et les plans suivants de la phase 35

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
