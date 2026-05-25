---
phase: 35-profile-settings-redesign
plan: 06
subsystem: ui
tags: [react-native, expo-image-picker, supabase-storage, tanstack-query, profile, avatar-upload]

# Dependency graph
requires:
  - phase: 35-01
    provides: ProfileScreen avec avatar initiales + bouton Modifier stub

provides:
  - "EditProfileScreen (/(app)/profile/edit) avec formulaire Nom/Bio/Objectif + avatar upload"
  - "Upload avatar vers bucket Supabase 'avatars' avec upsert avatar_url"
  - "Profile/index.tsx affiche avatar_url réel via Image ou fallback initiales"
  - "Bouton Modifier navigue vers /edit (remplace stub /settings)"

affects: [35-profile-settings-redesign, future-profile-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "expo-image-picker launchCameraAsync / launchImageLibraryAsync via showAlert ActionSheet"
    - "Supabase Storage upload blob + getPublicUrl pour avatars publics"
    - "settings JSONB spread pattern pour persister bio sans colonne dédiée"
    - "Goal picker inline bottom-sheet (View absolue) sans dépendance externe"

key-files:
  created:
    - apps/mobile/app/(app)/profile/edit.tsx
  modified:
    - apps/mobile/app/(app)/profile/index.tsx

key-decisions:
  - "Bio stockée dans user_profiles.settings JSONB sous la clé 'bio' (pas de colonne dédiée) — spread des settings existants avant upsert"
  - "Goal picker implémenté comme View absolue en bas d'écran (bottom sheet maison) pour éviter une dépendance externe"
  - "STHeader reproduit localement dans edit.tsx (pattern de settings.tsx) sans import depuis @ziko/ui — cohérence avec l'existant"
  - "showAlert utilisé pour l'ActionSheet avatar (3 boutons: camera / galerie / annuler) — conforme à la convention plugin-sdk"

patterns-established:
  - "Avatar upload: fetch(uri) → blob → supabase.storage.from('avatars').upload → getPublicUrl → upsert user_profiles → invalidateQueries"
  - "Affichage avatar conditionnel: avatarUrl présent → <Image>, sinon → View initiales"

requirements-completed: [PROF-01, PROF-06]

# Metrics
duration: 9min
completed: 2026-05-22
---

# Phase 35 Plan 06: Edit Profile Screen Summary

**Nouvel écran EditProfileScreen avec upload avatar expo-image-picker → bucket Supabase 'avatars', formulaire Nom/Bio/Objectif pré-rempli, et affichage Image réel dans le profil**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-22T12:43:02Z
- **Completed:** 2026-05-22T12:53:04Z
- **Tasks:** 2
- **Files modified:** 2 (1 créé, 1 modifié)

## Accomplishments

- Création complète de `edit.tsx` : STHeader, section avatar avec Image/initiales, formulaire Nom/Bio/Objectif, bottom-sheet goal picker, bouton Enregistrer avec ActivityIndicator
- Upload avatar via expo-image-picker (camera ou galerie) → blob fetch → bucket `avatars` → upsert `avatar_url` → invalidation cache
- Mise à jour `profile/index.tsx` : bouton "Modifier" navigue vers `/edit`, avatar affiche `<Image>` si `avatarUrl` défini
- Zéro erreurs TypeScript sur les deux fichiers

## Task Commits

1. **Task 1: Créer apps/mobile/app/(app)/profile/edit.tsx** - `95df433` (feat)
2. **Task 2: Mettre à jour profile/index.tsx** - `33480fe` (feat)

**Plan metadata:** (à venir — commit docs)

## Files Created/Modified

- `apps/mobile/app/(app)/profile/edit.tsx` - Ecran d'édition profil complet avec avatar upload, formulaire, goal picker bottom-sheet
- `apps/mobile/app/(app)/profile/index.tsx` - Bouton Modifier → `/edit`, affichage conditionnel Image si avatarUrl

## Decisions Made

- Bio stockée dans `user_profiles.settings JSONB` clé `'bio'` (spread des settings existants avant upsert) — pas de colonne dédiée disponible
- Goal picker bottom-sheet maison (View absolue) — pas de dépendance externe
- STHeader reproduit localement dans edit.tsx comme dans settings.tsx — pattern cohérent sans import @ziko/ui
- `showAlert` utilisé pour l'ActionSheet avatar (3 boutons) — conforme convention plugin-sdk (pas Alert.alert)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Known Stubs

None — avatar upload et formulaire sont pleinement câblés. La bio est persistée dans `settings JSONB` (comportement documenté dans les décisions).

## Threat Flags

Aucun — toutes les surfaces réseau sont dans le périmètre du threat model (T-35-06-01 à T-35-06-05) déjà documenté dans le plan.

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/edit.tsx` : EXISTS
- `apps/mobile/app/(app)/profile/index.tsx` : EXISTS, router.push.*edit = 1 occurrence
- Commits `95df433` et `33480fe` : présents dans git log
- TypeScript : 0 erreurs

## Next Phase Readiness

Plan 06 terminé. L'écran d'édition profil est complet et fonctionnel. Si d'autres plans de la phase 35 existent, ils peuvent s'appuyer sur le pattern d'upload avatar établi ici.

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
