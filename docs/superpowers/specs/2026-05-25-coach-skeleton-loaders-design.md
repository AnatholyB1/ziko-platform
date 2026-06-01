# Design — Coach Skeleton Loaders

**Date:** 2026-05-25  
**Scope:** Toutes les pages du dashboard coach (`/coach/**`)  
**Approche:** Next.js App Router `loading.tsx` natif + primitives partagées

---

## Contexte

Le layout coach est `force-dynamic` / `revalidate=0` — chaque navigation SSR provoque un blank blanc pendant la résolution des requêtes Supabase. Aucun `loading.tsx` n'existe aujourd'hui. L'objectif est d'éliminer cet effet d'attente en affichant immédiatement un skeleton qui mime la forme de la vraie page.

---

## Primitives partagées

**Fichier :** `apps/web/src/components/coach/skeletons.tsx`

Trois composants, pas de dépendances externes :

```
SkeletonBlock   — rectangle animate-pulse, props: className (width/height via Tailwind)
SkeletonText    — ligne de texte h-3, largeur variable via className
SkeletonRow     — ligne de tableau complète: circle + 4 colonnes
```

**Tokens visuels :**
- Couleur : `bg-[#E2E0DA]` (= token `border` du design system)
- Animation : `animate-pulse` (Tailwind natif)
- Fond : `bg-white` ou `bg-background` (#F7F6F3) selon le contexte
- Arrondi : `rounded-xl` cards, `rounded-full` avatars/cercles, `rounded` textes

---

## Inventaire des `loading.tsx`

### Pages principales

| Fichier | Skeleton |
|---|---|
| `coach/dashboard/loading.tsx` | WelcomeCard block (h-32) + 3 AlertCard blocks (h-20 chacun) |
| `coach/clients/loading.tsx` | Search bar + filter chips + table header + 6 SkeletonRows |
| `coach/programs/loading.tsx` | Titre + grille 2×3 de ProgramCard blocks (h-40) |
| `coach/invitations/loading.tsx` | Titre + 4 lignes (code 6ch + date + badge statut) |
| `coach/imports/loading.tsx` | Titre + 3 lignes import (nom fichier + date + statut) |
| `coach/settings/loading.tsx` | 3 blocs formulaire section (h-24 chacun) |
| `coach/ai/loading.tsx` | 2 bulles droite (user) + 1 bulle gauche (assistant) |
| `coach/programs/[id]/loading.tsx` | Header programme + bloc semaines accordion (h-48) |

### Pages détail client — stratégie

Le `loading.tsx` placé dans `coach/clients/[id]/` couvre uniquement le **chargement initial** (résolution du profil client). Une fois le layout `[id]/layout.tsx` rendu, le header client (avatar + nom + tabs strip) reste **stable et visible** pendant les navigations entre onglets. Chaque onglet a son propre `loading.tsx` scoped à son segment.

| Fichier | Skeleton |
|---|---|
| `coach/clients/[id]/loading.tsx` | Avatar circle + 2 lignes nom/rôle + tabs strip (5 blocs) |
| `coach/clients/[id]/sessions/loading.tsx` | 5 lignes (date + durée + nb sets) |
| `coach/clients/[id]/habits/loading.tsx` | 4 lignes (cercle emoji + label + barre de progression) |
| `coach/clients/[id]/nutrition/loading.tsx` | 5 lignes repas (label + 3 macros en blocs courts) |
| `coach/clients/[id]/measurements/loading.tsx` | Bloc graphique (h-40) + 4 lignes métriques |
| `coach/clients/[id]/sleep/loading.tsx` | 5 lignes (date + durée + score qualité) |
| `coach/clients/[id]/cardio/loading.tsx` | 5 lignes session (icône + type + distance + durée) |
| `coach/clients/[id]/journal/loading.tsx` | 4 lignes (icône mood + score + extrait notes) |
| `coach/clients/[id]/programs/loading.tsx` | 2 ProgramCard blocks avec barre compliance |

---

## Architecture des fichiers

```
apps/web/src/
  components/coach/
    skeletons.tsx                          ← primitives partagées (nouveau)
  app/[locale]/(coach)/coach/
    dashboard/loading.tsx                  ← nouveau
    clients/
      loading.tsx                          ← nouveau
      [id]/
        loading.tsx                        ← nouveau
        sessions/loading.tsx               ← nouveau
        habits/loading.tsx                 ← nouveau
        nutrition/loading.tsx              ← nouveau
        measurements/loading.tsx           ← nouveau
        sleep/loading.tsx                  ← nouveau
        cardio/loading.tsx                 ← nouveau
        journal/loading.tsx                ← nouveau
        programs/loading.tsx               ← nouveau
    programs/
      loading.tsx                          ← nouveau
      [id]/loading.tsx                     ← nouveau
    invitations/loading.tsx                ← nouveau
    imports/loading.tsx                    ← nouveau
    settings/loading.tsx                   ← nouveau
    ai/loading.tsx                         ← nouveau
```

**Total : 1 fichier primitives + 18 `loading.tsx`**

---

## Contraintes techniques

- Les `loading.tsx` sont des Server Components (pas de `'use client'`).
- Ils n'importent que `skeletons.tsx` — aucune dépendance externe.
- Le layout coach (`force-dynamic`) n'est pas modifié.
- La hiérarchie des segments App Router garantit que le layout header client reste monté pendant les navigations entre onglets — aucune modification de `[id]/layout.tsx` requise.
- Aucune modification des pages existantes.

---

## Hors scope

- Dark mode (le projet n'a pas de dark mode)
- Transitions animées entre skeleton et contenu réel (le fade natif du navigateur suffit)
- Skeleton pour les modales et drawers (chargement instantané côté client)
