# Phase 2 — Premier entraînement & parcours clarifié : CONTEXT (décisions verrouillées)

**Exigences :** FWKO-01..07, CLAR-01, CLAR-02 · **Contrat de design :** `design/02-DESIGN-CONTRACT.md` (+ `design/frames/png/`, `design/index.html`), à implémenter à l'identique.

## Décisions (utilisateur, 2026-11-20)
- **D-01** Carte d'accueil « Crée ton premier entraînement » : toute première carte, 3 chemins dans l'ordre Manuel, IA simple, Atelier IA, chacun avec badge livrable (« Programme » / « Séance »), phrase d'explication et coût. Coûts lus du serveur, jamais en dur ; repli « Consomme des crédits IA » si la source de coût n'est pas disponible. Manuel affiche « Gratuit ».
- **D-02** Badge « Conseillé » sur IA simple. Carte jamais repoussable (pas de « Plus tard ») : elle disparaît dès qu'un programme est actif ou qu'une séance est terminée.
- **D-03** Crédits épuisés : les lignes IA disent « Crédits épuisés » AVANT l'ouverture ; Manuel reste proposé ; le tap ouvre l'écran d'épuisement existant.
- **D-04** La variante vide de Mission du jour (« Aucun programme actif / Créer un programme IA ») est masquée tant que la carte s'affiche.
- **D-05** Onglet Entraînement vide : « Créer un programme » ouvre une feuille de choix (Manuel, IA simple, Atelier IA) ; bouton secondaire « Générer une séance IA » vers `ai-generate`.
- **D-06** Fin d'onboarding `step-7` : variante B (« C'est noté. » + 3 étapes « La suite » menant à la carte premier entraînement), fond SOMBRE conservé ; supprimer la carte « Ton programme », « Première séance demain matin » et la phase de chargement « Construction de ton programme ».
- **D-07** Compter les séances terminées pour la carte : requête légère nouvelle (colonne à confirmer par le builder dans `ziko_workout_sessions`).
- **D-08** Propriétaire de la composition de `apps/mobile/app/(app)/index.tsx` : cette phase. La phase 1 ajoute son bloc Quêtes par édition localisée ; fusionner par intention au merge (carte premier entraînement > Mission du jour > Quêtes).

## Références code
`app/(app)/index.tsx` (Mission du jour), `app/(app)/workout/index.tsx`, `workout/programs.tsx`, `workout/ai-generate.tsx`, `workout/program-builder.tsx`, `workout/atelier.tsx`, `app/(auth)/onboarding/step-7.tsx`, `backend/api/src/config/credits.ts`, `apps/mobile/src/lib/atelier.ts` (costLabel).

## Différé
Programme pré-généré à la fin de l'onboarding.
