---
phase: 35-profile-settings-redesign
plan: 10
subsystem: ui
tags: [expo-image-picker, supabase-storage, body_measurements, tanstack-query, react-native]

# Dependency graph
requires:
  - phase: 35-06
    provides: avatar upload pattern (ImagePicker + Supabase Storage + useQueryClient)
provides:
  - PRProgressTab avec upload de photos de progrès vers bucket profile-photos
  - Suppression photo par long-press (Storage remove + body_measurements delete)
  - ActivityIndicator pendant l'upload + gate uploading pour éviter les doublons
affects: [profile-screen, body_measurements, progress-photos-gallery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upload photo: fetch(uri) → blob → storage.upload → getPublicUrl → insert DB → invalidateQueries"
    - "Suppression: showAlert destructive → storage.remove(path) → DB delete eq('id') → invalidateQueries"
    - "Long-press wrapping: TouchableOpacity onLongPress + delayLongPress:500 sur photo cards"

key-files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/index.tsx

key-decisions:
  - "Bucket 'profile-photos' (non 'progress-photos' comme indiqué dans must_haves — le PLAN.md et les interfaces précisent 'profile-photos')"
  - "userId passé en prop à PRProgressTab depuis ProfileScreen (userId ?? '')"
  - "Path Storage extrait via split('/profile-photos/') pour la suppression"

patterns-established:
  - "Pattern upload progrès: même flow que avatars (plan 35-06) — réutilisable pour tout upload image utilisateur"

requirements-completed: [PROF-03]

# Metrics
duration: 12min
completed: 2026-05-22
---

# Phase 35 Plan 10: Progress Photo Upload Summary

**Upload de photos de progrès vers bucket Supabase `profile-photos` avec suppression par long-press dans PRProgressTab — ImagePicker + Storage + body_measurements insert/delete + invalidation TanStack Query**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-22T12:48:00Z
- **Completed:** 2026-05-22T13:00:26Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Bouton "Ajouter" (dashed card) déclenche désormais `handleAddPhoto` au lieu de naviguer vers `profile/avatar`
- Upload complet : demande de permission galerie → ImagePicker → fetch blob → storage.from('profile-photos').upload → getPublicUrl → body_measurements.insert → invalidateQueries
- ActivityIndicator remplace l'icône camera pendant l'upload, bouton disabled pour éviter les doublons
- Long-press (500ms) sur chaque photo card ouvre `showAlert` Supprimer → supprime du Storage et de body_measurements, puis rafraîchit la galerie
- Zéro erreur TypeScript

## Task Commits

1. **Task 1: Upload photos + suppression dans PRProgressTab** - `62e61f4` (feat)

**Plan metadata:** (à venir — commit docs)

## Files Created/Modified

- `apps/mobile/app/(app)/profile/index.tsx` — ajout imports (ActivityIndicator, useQueryClient, ImagePicker), refonte PRProgressTab avec userId prop, handleAddPhoto, handleDeletePhoto, wrapping photo cards en TouchableOpacity onLongPress

## Decisions Made

- Le PLAN.md spécifie le bucket `profile-photos` dans les interfaces — c'est ce bucket qui est utilisé (cohérent avec la migration 025 décrite dans les interfaces)
- `userId ?? ''` passé à PRProgressTab depuis `ProfileScreen` où `userId = user?.id ?? null`
- Path Storage extrait par `split('/profile-photos/')` pour retrouver le chemin relatif lors de la suppression

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Issues Encountered

None.

## User Setup Required

None — aucune configuration de service externe requise. Le bucket `profile-photos` est déjà défini par la migration 025 Supabase.

## Next Phase Readiness

- Plan 35-10 complet — PRProgressTab fonctionnel avec upload réel et suppression
- Phase 35 terminée si ce plan est le dernier

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
