# Phase 5: Corrections transverses - Context

**Gathered:** 2026-11-12 (recap chantiers 4 et 16). Req : XCUT-01..07. Vague 1.

## Decisions verrouillees
- **D-01** XCUT-01 slugs (`muscle_gain`, `fat_loss`, ...) -> libelles FR via une table/utilitaire unique (ex. `goalLabel(slug)`) dans `packages/plugin-sdk` (i18n), utilise partout ; couvre aussi l'objectif affiche en profil.
- **D-02** XCUT-02 textes anglais : "End" (fin de seance), "Pantry", "Shopping", mois ("May") -> francais. Les mois/dates via locale `fr` (`toLocaleDateString('fr-FR')` ou util commun). Pantry/Shopping : l'UI complete est refaite en P10 ; ici seulement les libelles visibles aujourd'hui (additif, namespace i18n propre).
- **D-03** XCUT-03 safe-area : titres sous la barre de statut (accueil, assistant Coach IA, ecrans scrolles). Corriger au point commun (`WSHeader`, layouts, `SafeAreaView`/`useSafeAreaInsets`), pas ecran par ecran.
- **D-04** XCUT-04 bouton bug flottant : ne masque aucun bouton d'action (ex. "Repas") ; repositionner/rendre deplacable ou reserver une zone ; defini par mesure (dernier element actionnable de chaque ecran reste cliquable). Fichier : `BugReportModal.tsx` et son montage.
- **D-05** XCUT-05 marges laterales des barres d'onglets : composant commun (P5 proprietaire) ; P17/P18/P22 le consomment, ne le modifient pas. Marges = gouttiere charte (16).
- **D-06** XCUT-06 noms d'exercices : francais + casse correcte (premiere lettre majuscule). Source : table `exercises` / seed (`supabase/seed.sql`, `scripts/exercise_names.txt`, `gen_fr_migration.py`) ; si les noms FR manquent en base, **ecrire une migration** `20261201 0501...` n'est PAS prevu (phase marquee sans migration) : privilegier un mappage d'affichage cote app (`exerciseDisplayName`) ; si une migration est indispensable, la signaler a l'orchestrateur (bloc 0501-0509 reserve).
- **D-07** XCUT-07 "Coach Ziko . Coach Ziko" : supprimer la redondance (header + sous-titre).
- **D-08** Edits **localises et additifs** sur l'accueil `apps/mobile/app/(app)/index.tsx` (P6/P8 y touchent aussi). Ordre de merge P5 -> P6 -> P8. UI hint non : pas d'UI-SPEC ; verifier contre les tokens charte.
- **D-09** Verification : tests unitaires des utilitaires (labels, noms, dates) + captures emulateur en file apres P1.

## Zones grises restantes
Aucune produit.
