---
phase: "02"
plan: "04"
subsystem: retour-vocal
tags: [ui, gsap, state-machine, feedback-card, tag-chip, card-section]
dependency_graph:
  requires:
    - "02-03"
  provides:
    - FeedbackCard
    - CardSection
    - TagChip
    - VocalCardReady (full)
  affects:
    - apps/web/src/components/coach/vocal/
tech_stack:
  added: []
  patterns:
    - GSAP entrance stagger (card → sections → tags)
    - Local useState for active edit section (no reducer round-trip)
    - Fake save via setTimeout 500ms → SAVE_COMPLETE
key_files:
  created:
    - apps/web/src/components/coach/vocal/TagChip.tsx
    - apps/web/src/components/coach/vocal/CardSection.tsx
    - apps/web/src/components/coach/vocal/FeedbackCard.tsx
  modified:
    - apps/web/src/components/coach/vocal/VocalCardReady.tsx
decisions:
  - "Active edit section tracked via local useState in FeedbackCard (not in reducer), per UI-SPEC note on Section Click-to-Edit Pattern"
  - "Loader2 GSAP spinner wraps icon in a span ref (not SVG ref) to avoid TS2322 Ref type mismatch between React versions"
  - "card-saving state has no card field — fallback to editedCard for FeedbackCard card prop"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  files_created: 4
---

# Phase 02 Plan 04: FeedbackCard + CardSection + TagChip + VocalCardReady — Summary

**One-liner:** 4-composant card UI avec GSAP stagger entrance, inline edit par section, toggle tags, et fake save 500ms → card-saved success block.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TagChip + CardSection | b2d9b14 | TagChip.tsx (new), CardSection.tsx (new) |
| 2 | FeedbackCard + VocalCardReady | b2d9b14 | FeedbackCard.tsx (new), VocalCardReady.tsx (replaced) |

---

## What Was Built

### TagChip.tsx
- Pill chip (h 28px, borderRadius 9999px) pour chacun des 5 tags : force, technique, mental, cardio, récupération
- `role="checkbox"` + `aria-checked={selected}` pour accessibilité
- Sélectionné : bg `#1C1A17`, texte blanc. Désélectionné : bg `#F0EFE9`, texte muted, border `#E2E0DA`
- GSAP toggle ON : `fromTo scale 0.85→1` back.out(1.4) 150ms ; toggle OFF : `to scale 0.95` yoyo 50ms

### CardSection.tsx
- Section labelée avec bloc read-only cliquable (bg `#F0EFE9`, hover border `#1C1A17`) et textarea éditable
- `role="button"` + `aria-label="Modifier : {label}"` sur le bloc read-only ; `aria-label={label}` sur textarea
- Textarea : border `1.5px solid #1C1A17`, boxShadow focus ring, resize vertical, outline none
- GSAP entrance textarea : `from { opacity:0, y:4 }` 150ms power2.out quand `isEditing` passe à `true`
- Pas de dismiss sur `onBlur` — switching se fait via local state du parent

### FeedbackCard.tsx
- Header : sparkles icon + "Retour structuré" (12px/600/muted, uppercase)
- 4 sections via CardSection (context, strengths, corrections, next_steps)
- Tags row : 5 TagChip avec dispatch `TAG_TOGGLE`
- Footer : bouton Sauvegarder (`#FF5C1A`, h 40px) avec GSAP scale feedback et spinner GSAP quand `isSaving`
- GSAP entrance mount : card y:16 250ms, sections stagger y:8 0.04s, tags scale 0.85 delay 0.15s

### VocalCardReady.tsx (remplacement complet du stub Plan 02-03)
- Couvre les 4 états : `card-ready`, `card-editing`, `card-saving`, `card-saved`
- Fake save : `useEffect` sur `state.status === 'card-saving'` → `setTimeout 500ms` → `dispatch SAVE_COMPLETE`
- card-saved : success block vert (`#F0FDF4`, border `#BBF7D0`) avec CheckCircle + "Retour sauvegardé." + "Nouveau retour" ghost button (dispatch `RESET`)
- GSAP entrance success block : `from { y:12, opacity:0 }` 200ms power2.out

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript Ref<SVGSVGElement> incompatibilité sur Loader2**
- **Trouvé pendant :** Task 2 — vérification TypeScript post-écriture
- **Problème :** Passer un `ref` typé `Ref<SVGSVGElement>` directement à `Loader2` causait TS2322 (deux types `Ref` incompatibles entre modules React)
- **Fix :** Envelopper `Loader2` dans un `<span ref={loaderWrapperRef}>` — GSAP cible le span, pas le SVG
- **Fichier :** `FeedbackCard.tsx`
- **Commit :** b2d9b14

**2. [Rule 1 - Bug] card-saving n'expose pas .card dans VocalState**
- **Trouvé pendant :** Task 2 — vérification TypeScript
- **Problème :** L'état `card-saving` ne contient que `editedCard` (pas `card`), donc `state.card` produit TS2339 pour l'union `card-ready | card-editing | card-saving`
- **Fix :** Discriminer avec `state.status === 'card-saving' ? state.editedCard : state.card` pour le prop `card` de FeedbackCard
- **Fichier :** `VocalCardReady.tsx`
- **Commit :** b2d9b14

---

## Verification Results

- TypeScript : 0 erreurs dans `vocal/` (tsc --noEmit)
- Tests vitest : 21 passed / 0 failed (4 fichiers de test)
- Critères d'acceptance : tous satisfaits

---

## Self-Check: PASSED

- [x] `apps/web/src/components/coach/vocal/TagChip.tsx` — FOUND
- [x] `apps/web/src/components/coach/vocal/CardSection.tsx` — FOUND
- [x] `apps/web/src/components/coach/vocal/FeedbackCard.tsx` — FOUND
- [x] `apps/web/src/components/coach/vocal/VocalCardReady.tsx` — FOUND (replaced)
- [x] Commit b2d9b14 — FOUND
