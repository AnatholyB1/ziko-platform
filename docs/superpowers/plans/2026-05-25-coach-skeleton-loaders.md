# Coach Skeleton Loaders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des `loading.tsx` animate-pulse sur toutes les pages du dashboard coach pour éliminer le blank blanc pendant le SSR.

**Architecture:** Pattern natif Next.js App Router — un `loading.tsx` par segment de route crée automatiquement une Suspense boundary. Un fichier de primitives partagées (`skeletons.tsx`) expose `SkeletonBlock`, `SkeletonText`, `SkeletonRow`. Aucune modification des pages existantes. Pour `/clients/[id]`, le `loading.tsx` au niveau `[id]/` couvre le chargement initial (layout + page) ; chaque onglet a son propre `loading.tsx` qui n'affecte que le slot `{children}` (le header reste stable lors des navigations entre onglets).

**Tech Stack:** Next.js 14 App Router, Tailwind CSS (`animate-pulse`), TypeScript, Server Components (pas de `'use client'`)

---

## File Map

```
apps/web/src/
  components/coach/
    skeletons.tsx                              ← CRÉER — primitives partagées
  app/[locale]/(coach)/coach/
    dashboard/
      loading.tsx                              ← CRÉER
    clients/
      loading.tsx                              ← CRÉER
      [id]/
        loading.tsx                            ← CRÉER — skeleton pleine page (initial)
        sessions/loading.tsx                   ← CRÉER
        habits/loading.tsx                     ← CRÉER
        nutrition/loading.tsx                  ← CRÉER
        measurements/loading.tsx               ← CRÉER
        sleep/loading.tsx                      ← CRÉER
        cardio/loading.tsx                     ← CRÉER
        journal/loading.tsx                    ← CRÉER
        programs/loading.tsx                   ← CRÉER (onglet programmes client)
    programs/
      loading.tsx                              ← CRÉER
      [id]/
        loading.tsx                            ← CRÉER
    invitations/
      loading.tsx                              ← CRÉER
    imports/
      loading.tsx                              ← CRÉER
    settings/
      loading.tsx                              ← CRÉER
    ai/
      loading.tsx                              ← CRÉER
```

**Total : 1 fichier primitives + 18 `loading.tsx`. Aucun fichier existant modifié.**

---

## Task 1 — Primitives partagées `skeletons.tsx`

**Files:**
- Create: `apps/web/src/components/coach/skeletons.tsx`

- [ ] **Créer le fichier**

```tsx
// apps/web/src/components/coach/skeletons.tsx
// Server Component — pas de 'use client'.
// Couleur #E2E0DA = token 'border' du design system Ziko.

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E2E0DA] rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E2E0DA] rounded h-3 ${className}`}
      aria-hidden="true"
    />
  );
}

// Ligne de tableau : avatar circle + N colonnes de largeurs croissantes
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const colWidths = ['w-32', 'w-24', 'w-28', 'w-16', 'w-20'];
  return (
    <div
      className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]"
      aria-hidden="true"
    >
      <div className="animate-pulse bg-[#E2E0DA] rounded-full w-8 h-8 shrink-0" />
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-[#E2E0DA] rounded h-3 ${colWidths[i] ?? 'w-20'}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

Attendu : aucune erreur sur `skeletons.tsx`.

- [ ] **Commit**

```bash
git add apps/web/src/components/coach/skeletons.tsx
git commit -m "feat(web): add SkeletonBlock/Text/Row primitives for coach loading states"
```

---

## Task 2 — `dashboard/loading.tsx`

La page dashboard (`dashboard/page.tsx`) affiche :
- `WelcomeCard` — card blanche `rounded-2xl p-8` avec titre h2 + badge KYC + 2 lignes texte
- `AlertsPanel` — liste de jusqu'à 3 `AlertCard` (icon circle + titre + texte)

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/dashboard/loading.tsx`

- [ ] **Créer le fichier**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/dashboard/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* WelcomeCard skeleton */}
      <div className="bg-white rounded-2xl p-8 border border-[#E2E0DA] shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <SkeletonText className="w-56 h-6" />
          <SkeletonBlock className="w-20 h-6 rounded-full" />
        </div>
        <SkeletonText className="w-72 mb-3" />
        <SkeletonText className="w-64" />
      </div>

      {/* AlertsPanel skeleton — 3 cartes */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-[#E2E0DA]"
          >
            <div className="flex items-start gap-3">
              <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonText className="w-40" />
                <SkeletonText className="w-64" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Vérification visuelle** — Démarrer le serveur dev (`npm run dev` depuis la racine), naviguer vers `/coach/dashboard` avec une connexion lente simulée (DevTools → Network → Slow 3G) ou ajouter un `await new Promise(r => setTimeout(r, 3000))` temporaire dans `dashboard/page.tsx` pour observer le skeleton.

- [ ] **Commit**

```bash
git add apps/web/src/app/[locale]/\(coach\)/coach/dashboard/loading.tsx
git commit -m "feat(web): skeleton loader for coach dashboard"
```

---

## Task 3 — `clients/loading.tsx`

La page clients (`clients/page.tsx`) affiche :
- Titre "Clients" + badge compteur
- `ClientsTable` : barre recherche + 4 filter chips + table avec 6 colonnes (checkbox, avatar+nom, dernière activité, signaux, compliance, actions)

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/loading.tsx`

- [ ] **Créer le fichier**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/loading.tsx
import { SkeletonBlock, SkeletonText, SkeletonRow } from '@/components/coach/skeletons';

export default function ClientsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SkeletonText className="w-24 h-7" />
        <SkeletonBlock className="w-8 h-6 rounded-full" />
      </div>

      {/* Search + filter chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 mb-4">
        <SkeletonBlock className="w-64 h-10 rounded-xl" />
        <div className="flex gap-2">
          {[80, 128, 152, 136].map((w, i) => (
            <SkeletonBlock key={i} style={{ width: w }} className="h-11 rounded-full" />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-6 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonBlock className="w-4 h-4 rounded" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-28" />
          <SkeletonText className="w-20" />
          <SkeletonText className="w-24" />
          <SkeletonText className="w-12" />
        </div>
        {/* 6 rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} cols={4} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add apps/web/src/app/[locale]/\(coach\)/coach/clients/loading.tsx
git commit -m "feat(web): skeleton loader for coach clients list"
```

---

## Task 4 — `programs/loading.tsx` et `programs/[id]/loading.tsx`

`programs/page.tsx` : titre + bouton "Nouveau" + grille 2×3 de `ProgramCard` (card blanche avec nom, goal, badges).
`programs/[id]/page.tsx` : header programme + `ProgramEditorClient` (accordion de semaines).

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/programs/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/programs/[id]/loading.tsx`

- [ ] **Créer `programs/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/programs/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ProgramsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <SkeletonText className="w-32 h-7" />
        <SkeletonBlock className="w-36 h-10 rounded-xl" />
      </div>

      {/* Grille 6 program cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#E2E0DA] p-5"
          >
            <SkeletonText className="w-40 h-4 mb-3" />
            <SkeletonText className="w-24 mb-4" />
            <div className="flex gap-2">
              <SkeletonBlock className="w-16 h-6 rounded-full" />
              <SkeletonBlock className="w-20 h-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Créer `programs/[id]/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/programs/[id]/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ProgramEditorLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header du programme */}
      <div className="flex items-center gap-4 mb-6">
        <SkeletonText className="w-48 h-7" />
        <SkeletonBlock className="w-20 h-6 rounded-full" />
      </div>

      {/* Zone éditeur */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] p-6 mb-4">
        <SkeletonText className="w-32 mb-4" />
        <SkeletonBlock className="w-full h-48 rounded-xl" />
      </div>

      {/* Accordion semaines */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E2E0DA] p-4 mb-3"
        >
          <div className="flex items-center justify-between">
            <SkeletonText className="w-24" />
            <SkeletonBlock className="w-6 h-6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add \
  apps/web/src/app/[locale]/\(coach\)/coach/programs/loading.tsx \
  apps/web/src/app/[locale]/\(coach\)/coach/programs/\[id\]/loading.tsx
git commit -m "feat(web): skeleton loaders for coach programs list and editor"
```

---

## Task 5 — `invitations/loading.tsx` et `imports/loading.tsx`

`invitations/page.tsx` : titre + bouton "Générer" + table de codes (code 6 chars | date expiration | statut badge | action révoquer).
`imports/page.tsx` : titre + bouton "Importer" + liste de lignes import (icône | filename | statut badge).

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/invitations/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/imports/loading.tsx`

- [ ] **Créer `invitations/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/invitations/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function InvitationsLoading() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <SkeletonText className="w-40 h-7" />
        <SkeletonBlock className="w-40 h-10 rounded-xl" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        <SkeletonBlock className="w-20 h-9 rounded-full" />
        <SkeletonBlock className="w-16 h-9 rounded-full" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonText className="w-20" />
          <SkeletonText className="w-28" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-16 ml-auto" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]"
          >
            <SkeletonText className="w-16 font-mono" />
            <SkeletonText className="w-28" />
            <SkeletonBlock className="w-16 h-6 rounded-full" />
            <SkeletonBlock className="w-8 h-6 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Créer `imports/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/imports/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ImportsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <SkeletonText className="w-32 h-7" />
        <SkeletonBlock className="w-36 h-10 rounded-xl" />
      </div>

      {/* Liste imports */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#E2E0DA] p-4 flex items-center gap-4"
          >
            <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonText className="w-48" />
              <SkeletonText className="w-28" />
            </div>
            <SkeletonBlock className="w-20 h-7 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add \
  apps/web/src/app/[locale]/\(coach\)/coach/invitations/loading.tsx \
  apps/web/src/app/[locale]/\(coach\)/coach/imports/loading.tsx
git commit -m "feat(web): skeleton loaders for coach invitations and imports"
```

---

## Task 6 — `settings/loading.tsx` et `ai/loading.tsx`

`settings/page.tsx` : titre + `SettingsClient` (formulaire en sections : profil, spécialités, KYC).
`ai/page.tsx` : `AIChatClient` (interface chat avec historique de messages + barre de saisie).

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/settings/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/ai/loading.tsx`

- [ ] **Créer `settings/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/settings/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function SettingsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen max-w-2xl">
      <SkeletonText className="w-32 h-7 mb-8" />

      {/* 3 sections formulaire */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E2E0DA] p-6 mb-4"
        >
          <SkeletonText className="w-36 h-4 mb-5" />
          <div className="space-y-3">
            <SkeletonBlock className="w-full h-10 rounded-xl" />
            <SkeletonBlock className="w-full h-10 rounded-xl" />
          </div>
        </div>
      ))}

      {/* Bouton save */}
      <SkeletonBlock className="w-32 h-10 rounded-xl" />
    </div>
  );
}
```

- [ ] **Créer `ai/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/ai/loading.tsx
import { SkeletonBlock } from '@/components/coach/skeletons';

export default function AILoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col justify-end gap-4 p-6 overflow-hidden">
        {/* 2 messages user (droite) */}
        <div className="flex justify-end">
          <SkeletonBlock className="w-64 h-12 rounded-2xl rounded-tr-sm" />
        </div>
        <div className="flex justify-end">
          <SkeletonBlock className="w-80 h-16 rounded-2xl rounded-tr-sm" />
        </div>
        {/* 1 message assistant (gauche) */}
        <div className="flex items-start gap-3">
          <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
          <SkeletonBlock className="w-72 h-24 rounded-2xl rounded-tl-sm" />
        </div>
      </div>

      {/* Barre de saisie */}
      <div className="border-t border-[#E2E0DA] p-4">
        <SkeletonBlock className="w-full h-12 rounded-2xl" />
      </div>
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add \
  apps/web/src/app/[locale]/\(coach\)/coach/settings/loading.tsx \
  apps/web/src/app/[locale]/\(coach\)/coach/ai/loading.tsx
git commit -m "feat(web): skeleton loaders for coach settings and AI chat"
```

---

## Task 7 — `clients/[id]/loading.tsx` (skeleton pleine page)

Ce `loading.tsx` est au niveau du segment `[id]/`. Il couvre le **chargement initial** de la page, c'est-à-dire quand `clients/[id]/layout.tsx` n'a pas encore résolu (profil client en cours de fetch). Il doit imiter toute la structure : header client (avatar + nom + tabs) + zone contenu + panneau notes.

Lors des navigations entre onglets (sessions → habits), ce fichier n'est PAS montré — seuls les `loading.tsx` des onglets individuels s'activent, le header reste stable.

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/loading.tsx`

- [ ] **Créer le fichier**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/loading.tsx
// Affiché lors du chargement initial de /clients/[id]/* (avant que le layout résolve).
// Imite : ClientDetailHeader + ClientTabStrip + contenu tab + ClientNotesPanel.
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ClientDetailLoading() {
  return (
    <div className="flex-1 bg-[#F7F6F3] min-h-screen">
      {/* Header area — imite p-8 pb-0 du layout */}
      <div className="p-8 pb-0">
        {/* ClientDetailHeader skeleton */}
        <div className="flex items-center gap-4 mb-6">
          <SkeletonBlock className="w-14 h-14 rounded-full shrink-0" />
          <div className="space-y-2">
            <SkeletonText className="w-40 h-5" />
            <SkeletonText className="w-24" />
          </div>
        </div>

        {/* ClientTabStrip skeleton — 8 onglets */}
        <div className="flex gap-1 border-b border-[#E2E0DA]">
          {[96, 80, 88, 80, 112, 72, 88, 80].map((w, i) => (
            <SkeletonBlock
              key={i}
              style={{ width: w }}
              className="h-9 rounded-t-lg rounded-b-none"
            />
          ))}
        </div>
      </div>

      {/* Content area — imite flex gap-6 p-8 pt-6 du layout */}
      <div className="flex gap-6 p-8 pt-6">
        {/* Tab content (flex-1) */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* ExecutiveSummaryCard skeleton — 4 stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E2E0DA] p-4">
                <SkeletonText className="w-28 mb-2" />
                <SkeletonText className="w-16 h-5" />
              </div>
            ))}
          </div>

          {/* Table skeleton */}
          <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
            <div className="flex gap-8 px-4 py-3 bg-[#F7F6F3]">
              <SkeletonText className="w-16" />
              <SkeletonText className="w-24" />
              <SkeletonText className="w-16" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-8 px-4 py-3 border-t border-[#E2E0DA]">
                <SkeletonText className="w-20" />
                <SkeletonText className="w-32" />
                <SkeletonText className="w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* Notes panel — hidden sous lg, skeleton visible sur lg+ */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-[#E2E0DA] p-4">
            <SkeletonText className="w-28 mb-4" />
            <SkeletonBlock className="w-full h-32 rounded-xl mb-3" />
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} className="w-16 h-6 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add apps/web/src/app/[locale]/\(coach\)/coach/clients/\[id\]/loading.tsx
git commit -m "feat(web): full-page skeleton for coach client detail initial load"
```

---

## Task 8 — Onglets sessions, habits, nutrition

Ces trois onglets affichent tous une table 3 colonnes. L'onglet **sessions** inclut en plus un `ExecutiveSummaryCard` (4 stats en grille).

Note : ces `loading.tsx` s'affichent dans le slot `{children}` du layout `[id]/layout.tsx`. Le header et les tabs restent visibles. Largeur = `flex-1` du `flex gap-6` du layout.

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/habits/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/nutrition/loading.tsx`

- [ ] **Créer `sessions/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function SessionsLoading() {
  return (
    <div>
      {/* ExecutiveSummaryCard skeleton — 4 cellules stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#E2E0DA] p-4">
            <SkeletonText className="w-28 mb-2" />
            <SkeletonText className="w-16 h-5" />
          </div>
        ))}
      </div>

      {/* Sessions table (Date | Séance | Durée) */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        <div className="flex gap-8 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonText className="w-12" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-14" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-8 px-4 py-3 border-t border-[#E2E0DA]">
            <SkeletonText className="w-20" />
            <SkeletonText className="w-32" />
            <SkeletonText className="w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Créer `habits/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/habits/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function HabitsLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Table header (Habitude | Type | Taux 30j) */}
      <div className="flex gap-8 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-20" />
        <SkeletonText className="w-12" />
        <SkeletonText className="w-28" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-8 px-4 py-3 border-t border-[#E2E0DA]">
          {/* emoji placeholder + nom */}
          <div className="flex items-center gap-2 w-44">
            <SkeletonBlock className="w-6 h-6 rounded" />
            <SkeletonText className="w-32" />
          </div>
          <SkeletonText className="w-16" />
          <SkeletonText className="w-10" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Créer `nutrition/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/nutrition/loading.tsx
import { SkeletonText } from '@/components/coach/skeletons';

export default function NutritionLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Table header (Date | Repas | Aliment | Calories | Protéines) */}
      <div className="flex gap-4 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-24" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonText className="w-20" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-28" />
          <SkeletonText className="w-12" />
          <SkeletonText className="w-12" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/loading.tsx" \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/habits/loading.tsx" \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/nutrition/loading.tsx"
git commit -m "feat(web): skeleton loaders for client sessions, habits, nutrition tabs"
```

---

## Task 9 — Onglets measurements, sleep, cardio, journal, programs

Cinq onglets restants. `measurements` a 5 colonnes. `sleep`, `cardio`, `journal` sont des tables 3-4 colonnes. `programs` (onglet programmes client) affiche une card programme actif + liste historique.

**Files:**
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/measurements/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sleep/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/cardio/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/loading.tsx`
- Create: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/loading.tsx`

- [ ] **Créer `measurements/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/measurements/loading.tsx
import { SkeletonText } from '@/components/coach/skeletons';

export default function MeasurementsLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* 5 colonnes : Date | Poids | % Graisse | Tour taille | Tour poitrine */}
      <div className="flex gap-4 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-12" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-20" />
        <SkeletonText className="w-24" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonText className="w-20" />
          <SkeletonText className="w-14" />
          <SkeletonText className="w-12" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-16" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Créer `sleep/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sleep/loading.tsx
import { SkeletonText } from '@/components/coach/skeletons';

export default function SleepLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Date | Coucher | Réveil | Durée | Qualité */}
      <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-12" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-16" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-6 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonText className="w-20" />
          <SkeletonText className="w-14" />
          <SkeletonText className="w-14" />
          <SkeletonText className="w-12" />
          <SkeletonText className="w-10" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Créer `cardio/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/cardio/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function CardioLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Type | Date | Distance | Durée | Allure */}
      <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-12" />
        <SkeletonText className="w-12" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-14" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonBlock className="w-6 h-6 rounded" />
          <SkeletonText className="w-20" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-14" />
          <SkeletonText className="w-12" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Créer `journal/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function JournalLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Date | Humeur | Énergie | Stress | Notes */}
      <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-12" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-20" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonText className="w-20" />
          {/* Mood score circle */}
          <SkeletonBlock className="w-7 h-7 rounded-full" />
          <SkeletonBlock className="w-7 h-7 rounded-full" />
          <SkeletonBlock className="w-7 h-7 rounded-full" />
          <SkeletonText className="w-32" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Créer `clients/[id]/programs/loading.tsx`**

```tsx
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/loading.tsx
// Onglet "Programmes" du client — affiche programme actif + historique.
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ClientProgramsLoading() {
  return (
    <div className="space-y-4">
      {/* Programme actif */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] p-5">
        <SkeletonText className="w-20 h-3 mb-3" />
        <SkeletonText className="w-48 h-5 mb-2" />
        <SkeletonText className="w-28 mb-4" />
        {/* Barre compliance */}
        <div className="flex items-center gap-3">
          <SkeletonBlock className="flex-1 h-2 rounded-full" />
          <SkeletonText className="w-10" />
        </div>
      </div>

      {/* Historique — 2 lignes */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonText className="w-28" />
          <SkeletonText className="w-20" />
          <SkeletonText className="w-20" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-6 px-4 py-3 border-t border-[#E2E0DA]">
            <SkeletonText className="w-36" />
            <SkeletonText className="w-20" />
            <SkeletonText className="w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Vérifier TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/measurements/loading.tsx" \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sleep/loading.tsx" \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/cardio/loading.tsx" \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/loading.tsx" \
  "apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/loading.tsx"
git commit -m "feat(web): skeleton loaders for remaining client detail tabs"
```
