---
phase: 35-profile-settings-redesign
plan: 11
subsystem: ui
tags: [react-native, legal, rgpd, expo-router, mentions-legales, cgu, confidentialite]

requires:
  - phase: 35-profile-settings-redesign
    provides: settings.tsx avec row Mentions légales câblée vers legal.tsx

provides:
  - Écran LegalScreen (apps/mobile/app/(app)/profile/legal.tsx) avec 3 onglets
  - Navigation corrigée de /(app)/legal vers /(app)/profile/legal

affects:
  - Apple App Store Review (obligation contenu légal)
  - Google Play Store Review (obligation contenu légal)

tech-stack:
  added: []
  patterns:
    - "Écran légal 3-onglets avec tab bar local (useState<Tab>) et key={tab} sur ScrollView"
    - "Composants Text atomiques (SectionHeading, BodyText, BulletItem, MutedText) pour contenu légal"

key-files:
  created:
    - apps/mobile/app/(app)/profile/legal.tsx
  modified:
    - apps/mobile/app/(app)/profile/settings.tsx

key-decisions:
  - "Contenu extrait des pages web existantes (mentions-legales, cgu, politique-de-confidentialite) pour cohérence source unique"
  - "Placeholders [À COMPLÉTER] avec TODO dans le code pour SIRET, forme juridique et tribunal — complétables sans relivraison"
  - "Tab bar local (useState) plutôt que navigation de pile pour fluidité et simplicité"
  - "key={tab} sur ScrollView pour réinitialiser le scroll à chaque changement d'onglet"

requirements-completed: [SET-01]

duration: 15min
completed: 2026-05-22
---

# Phase 35 Plan 11 : Legal Screen Summary

**Écran mentions légales mobile à 3 onglets (ML / CGU / Confidentialité) extrait des pages web Next.js existantes, conforme RGPD, avec placeholders TODO pour entité légale**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-22T10:00:00Z
- **Completed:** 2026-05-22T10:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Créé `apps/mobile/app/(app)/profile/legal.tsx` — écran LegalScreen avec 3 onglets entièrement fonctionnels
- Contenu réel extrait et adapté des 3 pages web (mentions-legales, cgu, politique-de-confidentialite) — aucun Lorem ipsum
- Câblé la row "Mentions légales" dans settings.tsx vers `/(app)/profile/legal` (chemin corrigé de `/(app)/legal`)
- Conforme RGPD : droits utilisateurs Art.15-21, contact DPO, délai 30j, lien CNIL, base légale Art.6.1.a/b/f
- Avertissement médical IA (section CGU 5) dans encadré orange tint

## Task Commits

1. **Task 1: Créer legal.tsx** - `2fa5d34` (feat)
2. **Task 2: Câbler settings.tsx** - intégré dans commit antérieur linter (route `/(app)/profile/legal` confirmée présente)

**Plan metadata:** à créer ci-après (docs)

## Files Created/Modified

- `apps/mobile/app/(app)/profile/legal.tsx` — Écran LegalScreen : SafeAreaView + header + tab bar 3 onglets + ScrollView key={tab}
- `apps/mobile/app/(app)/profile/settings.tsx` — Row Mentions légales : chemin corrigé vers profile/legal

## Decisions Made

- Extraction du contenu depuis les pages web plutôt que réécriture — garantit cohérence source unique et conformité avec le contenu déjà validé
- Placeholders [À COMPLÉTER] avec commentaires TODO pour SIRET, forme juridique, siège social, tribunal compétent — l'entité légale doit les compléter avant soumission aux stores
- Tab bar local `useState<Tab>` — pas de navigation de pile supplémentaire, transition fluide entre les 3 onglets
- Composants Text atomiques locaux (SectionHeading, BodyText, BulletItem, MutedText) pour code lisible et cohérent

## Deviations from Plan

None — plan exécuté exactement comme écrit.

## Known Stubs

| Stub | Fichier | Raison |
|------|---------|--------|
| `[À COMPLÉTER — ex : Ziko SAS, RCS Paris]` | legal.tsx:35 | Entité légale non encore constituée — TODO avant soumission stores |
| `[À COMPLÉTER]` (SIRET) | legal.tsx:36 | Idem |
| `[À COMPLÉTER]` (siège social) | legal.tsx:37 | Idem |
| `[À COMPLÉTER — tribunal de Paris]` | legal.tsx:CGU sect.10 | Tribunal à préciser selon domiciliation |

Ces stubs sont intentionnels et documentés avec TODO dans le code. Ils n'empêchent pas la navigation vers l'écran ni la lecture du contenu légal. Ils doivent être complétés avant la première soumission aux stores.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- L'écran legal.tsx est complet et navigable depuis settings.tsx
- Les placeholders légaux sont clairement identifiés avec TODO — à compléter avant soumission App Store / Google Play
- Phase 35 plans 1-11 complètes — toutes les fonctionnalités du redesign profil/settings sont livrées

## Self-Check: PASSED

- `apps/mobile/app/(app)/profile/legal.tsx` existe sur disque : PASS
- 3 onglets présents ('legal', 'cgu', 'privacy') : PASS (8 occurrences grep)
- Contenu RGPD (RGPD, contact@ziko-app.com, CNIL) : PASS (7 occurrences)
- Navigation câblée (profile/legal dans settings.tsx) : PASS (1 occurrence)
- Placeholders TODO présents : PASS (7 occurrences)
- TypeScript 0 erreurs : PASS

---
*Phase: 35-profile-settings-redesign*
*Completed: 2026-05-22*
