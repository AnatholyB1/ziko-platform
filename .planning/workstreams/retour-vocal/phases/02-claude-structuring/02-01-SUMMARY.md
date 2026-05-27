---
phase: "02"
plan: "01"
subsystem: retour-vocal
tags: [reducer, state-machine, tdd, types]
dependency_graph:
  requires: []
  provides: [StructuredCard, CardSection, TagKey, vocalReducer-phase02-transitions]
  affects: [02-02, 02-03, 02-04]
tech_stack:
  added: []
  patterns: [TDD-RED-GREEN, pure-state-machine, union-types]
key_files:
  created: []
  modified:
    - apps/web/src/components/coach/vocal/vocalReducer.ts
    - apps/web/src/components/coach/vocal/vocalReducer.test.ts
decisions:
  - "RESET has no status guard — toujours autorisé depuis n'importe quel état"
  - "SECTION_EDIT et TAG_TOGGLE acceptent card-ready ET card-editing pour permettre l'édition en ligne"
metrics:
  duration: "~10 min"
  completed: "2026-05-27"
  tasks_completed: 1
  tests_passed: 15
---

# Phase 02 Plan 01: Extend vocalReducer — Phase 02 types and transitions

**One-liner:** Extension TDD du vocalReducer avec 6 nouveaux statuts, 7 nouvelles actions et 3 types exportés — 15 tests verts.

## What Was Built

Extension de la machine à états `vocalReducer.ts` existante (Phase 01) pour supporter le flux de structuring Claude de Phase 02.

### Types exportés ajoutés

- `CardSection = 'context' | 'strengths' | 'corrections' | 'next_steps'`
- `TagKey = 'force' | 'technique' | 'mental' | 'cardio' | 'recuperation'`
- `interface StructuredCard { context, strengths, corrections, next_steps, tags: TagKey[] }`

### VocalState — 6 nouveaux variants

| Statut | Champs |
|--------|--------|
| `structuring` | `transcript: string` |
| `card-ready` | `card: StructuredCard; editedCard: StructuredCard` |
| `card-editing` | `card, editedCard, activeSection: CardSection` |
| `card-saving` | `editedCard: StructuredCard` |
| `card-saved` | (vide) |
| `structuring-error` | `transcript: string; message: string` |

### VocalAction — 7 nouveaux variants

`STRUCTURE_SUCCESS`, `STRUCTURE_ERROR`, `SECTION_EDIT`, `TAG_TOGGLE`, `START_SAVING`, `SAVE_COMPLETE`, `RESET`

### Transition modifiée

- `VALIDATE` : `review → structuring` (était `review → idle` en Phase 01)

## Test Results

```
Tests  15 passed (15)
```

- 6 tests Phase 01 inchangés (comportement)
- 1 test VALIDATE mis à jour (`idle` → `structuring`)
- 7 nouveaux tests Phase 02 tous verts

## Files Changed

| Fichier | Type | Description |
|---------|------|-------------|
| `apps/web/src/components/coach/vocal/vocalReducer.ts` | modified | +100 lignes : types, union extensions, reducer cases |
| `apps/web/src/components/coach/vocal/vocalReducer.test.ts` | modified | +80 lignes : 1 test mis à jour + 7 nouveaux |

## Commit

`70d2ab5` — feat(02-01): extend vocalReducer — Phase 02 types, transitions, 15 tests green

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit.

## Self-Check: PASSED

- [x] `vocalReducer.ts` existe et contient les types exportés
- [x] `vocalReducer.test.ts` contient le test VALIDATE avec assertion `structuring`
- [x] 15 tests passent
- [x] Commit `70d2ab5` présent
