---
phase: 35-profile-settings-redesign
plan: 08
subsystem: ui
tags: [react-native, settings, supabase, notifications, appearance, integrations, referral, share, linking]

requires:
  - phase: 35-03
    provides: NotifSubScreen, AppearanceSubScreen, IntegrationsSubScreen avec Supabase persistence
  - phase: 35-04
    provides: profile screen rebuild, authStore profile

provides:
  - NotifSubScreen avec isLoading + ActivityIndicator — plus de flash des valeurs par défaut
  - AppearanceSubScreen avec activeTheme depuis settings.appearance.theme + handleThemeSelect persist
  - Badge PREMIUM/FREE conditionnel depuis profile.settings.subscription_tier
  - Bouton "Connecter" Apple Health : Linking.openURL('App-Prefs:Privacy&path=HEALTH') sur iOS
  - Right value "Intégrations" dynamique depuis health_sync_log (connectedCount query)
  - Parrainage inline : code stable userId.slice(0,8) + Share.share (route inexistante supprimée)

affects: [35-09, profile screen, smoke tests, settings UX]

tech-stack:
  added: []
  patterns:
    - "isLoading gate in sub-screens — afficher ActivityIndicator jusqu'au chargement DB"
    - "Linking.openURL pour deep link iOS réglages santé (App-Prefs:Privacy&path=HEALTH)"
    - "Share.share natif React Native pour partage de code parrainage"
    - "Code parrainage stable : userId.slice(0,8).toUpperCase() — pas aléatoire"
    - "useQuery integrations-count au niveau parent SettingsScreen pour badge dyn"

key-files:
  created: []
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx

key-decisions:
  - "Les 6 corrections (Task 1 + Task 2) commitées atomiquement — seul fichier modifié"
  - "subscription_tier lu depuis profile.settings.subscription_tier (JSONB) — pas de colonne dédiée dans les migrations"
  - "connectedCount query distincte de IntegrationsSubScreen pour éviter prop drilling"
  - "Parrainage via Share.share inline — pas de route /(app)/referral qui n'existe pas"
  - "handleThemeSelect persisté avec merge-safe pattern (charge settings complets avant upsert)"

requirements-completed: [SET-02, SET-03, SET-04, SET-05]

duration: 12min
completed: 2026-05-22
---

# Phase 35 Plan 08: Settings Data Wiring Summary

**6 données hardcodées remplacées dans settings.tsx : NotifSubScreen loader DB, AppearanceSubScreen thème actif, badge PREMIUM/FREE conditionnel, Linking Apple Health, connectedCount dynamique, Share.share parrainage**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-22T12:00:00Z
- **Completed:** 2026-05-22T12:12:00Z
- **Tasks:** 2 (commitées atomiquement)
- **Files modified:** 1

## Accomplishments

- NotifSubScreen : `isLoading` state + `ActivityIndicator` centré — les toggles n'apparaissent qu'après le chargement Supabase, supprimant le flash des valeurs par défaut
- AppearanceSubScreen : `activeTheme` initialisé depuis `settings.appearance.theme` + `handleThemeSelect` qui persiste le choix avec le pattern merge-safe JSONB
- Badge PREMIUM/FREE : conditionnel sur `profile?.settings?.subscription_tier ?? 'free'` — orange + 'PREMIUM' ou gris + 'FREE'
- Bouton "Connecter" Apple Health : `Linking.openURL('App-Prefs:Privacy&path=HEALTH')` sur iOS, alert 'bientôt disponible' sur Android et pour les autres intégrations
- Right value "Intégrations" : `connectedCount` depuis `health_sync_log` query dans SettingsScreen (plus '2 actives' hardcodé)
- Parrainage : code stable `userId.slice(0, 8).toUpperCase()` + `Share.share` natif — route `/(app)/referral` inexistante supprimée

## Task Commits

1. **Task 1 : Corriger NotifSubScreen, AppearanceSubScreen, PREMIUM badge** + **Task 2 : Corriger Intégrations, Parrainage, right value** — `2fa5d34` (feat)

Les deux tâches modifient uniquement `settings.tsx` — commit atomique.

## Files Created/Modified

- `apps/mobile/app/(app)/profile/settings.tsx` — 90 lignes ajoutées, 16 supprimées : 6 corrections de données hardcodées, Linking/Platform/Share/ActivityIndicator ajoutés aux imports RN

## Decisions Made

- `subscription_tier` lu depuis `profile?.settings?.subscription_tier` (JSONB) car aucune colonne dédiée n'existe dans les migrations — cette approche est cohérente avec le pattern `settings` JSONB déjà utilisé pour `notif_prefs` et `appearance`
- `connectedCount` ajouté comme query séparée dans `SettingsScreen` (pas dans `IntegrationsSubScreen`) pour éviter le prop drilling et rester disponible pour le badge dans la vue principale
- `handleThemeSelect` utilise le même pattern merge-safe que `handleUnitSelect` déjà présent — cohérence du code
- Route `/(app)/referral` supprimée : elle n'existe pas dans le router Expo et causait un crash au tap — remplacée par action inline `showAlert` + `Share.share`

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit. Les 6 corrections correspondent exactement aux actions décrites dans les tasks 1 et 2.

## Issues Encountered

None.

## Known Stubs

- `handleThemeSelect` appelle `setActiveTheme` mais `useThemeStore` n'est pas synchronisé — l'UI theme switcher est fonctionnel visuellement dans AppearanceSubScreen mais ne change pas le thème global de l'app (thème Sombre et Auto sont locked de toute façon). Ce sera résolu quand les thèmes seront activés.
- Badge PREMIUM : `profile?.settings?.subscription_tier` est `null` pour tous les utilisateurs actuels (aucun flow de paiement en place) — tous verront 'FREE'. C'est le comportement attendu.

## Threat Flags

Aucune nouvelle surface de sécurité introduite. Les mitigations du threat model sont respectées :
- T-35-08-01/02 (Share.share parrainage) : code = 8 premiers chars UUID, aucune donnée sensible
- T-35-08-03 (Linking.openURL App-Prefs) : URL scheme limité aux réglages système iOS, pas d'écriture
- T-35-08-04 (connectedCount) : query sur `health_sync_log` avec `.eq('user_id', userId!)` — RLS garantit les données propres à l'utilisateur

## Next Phase Readiness

- settings.tsx sans données hardcodées, TypeScript 0 erreurs
- Toutes les interactions utilisateur ont une action réelle (pas de route inexistante)
- Phase 35 complète côté settings — prêt pour la vérification finale

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
