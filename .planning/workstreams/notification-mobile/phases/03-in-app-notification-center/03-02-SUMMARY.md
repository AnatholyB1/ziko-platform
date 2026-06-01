---
phase: 03-in-app-notification-center
plan: 02
subsystem: mobile

key-files:
  modified:
    - apps/mobile/app/(app)/notifications.tsx

requirements-completed:
  - CENTER-01
  - CENTER-02
  - CENTER-04

duration: 15min
completed: 2026-05-28
---

# Phase 03 Plan 02: Notification Screen Wiring

**notifications.tsx branché avec vraies données — deep-link navigation ajoutée via useRouter**

## What changed

Le fichier `notifications.tsx` était déjà correctement structuré sans `INITIAL_ITEMS` mock — il utilisait directement `useQuery` + `useMutation` de TanStack Query avec Supabase. La seule fonctionnalité manquante était la navigation deep-link sur `action_url`.

Changements appliqués :

- Import `useRouter` ajouté depuis `expo-router`
- `const router = useRouter()` instancié dans `NotificationsScreen`
- `handlePress` mis à jour : après `markReadMutation.mutate(item.id)`, appelle `router.push(item.action_url as any)` si `action_url` est présent
- `markRead` sur tap via `markReadMutation.mutate` — déjà opérationnel
- `markAllRead` mutation sur bouton "Tout lire" — déjà opérationnel
- Loading guard inline via `renderEmpty` avec `ActivityIndicator` — déjà présent

## Deviations from Plan

**[Rule 1 - Observation] Fichier déjà réécrit sans mock**

- Le plan supposait un fichier avec `INITIAL_ITEMS` et `useState` pour les items
- En réalité, le fichier avait déjà été migré vers `useQuery`/`useMutation` directs (probablement lors des plans précédents ou d'un commit intermédiaire)
- Action : seule l'intégration `useRouter` + deep-link manquait — ajoutée sans toucher au reste
- Aucune régression visuelle

## Self-Check: PASSED

- `apps/mobile/app/(app)/notifications.tsx` — fichier modifié et commité (70235cd)
- `INITIAL_ITEMS` : 0 occurrences (confirmé via grep)
- TypeScript : aucune erreur dans `notifications.tsx`
- Commit `70235cd` vérifié dans git log
