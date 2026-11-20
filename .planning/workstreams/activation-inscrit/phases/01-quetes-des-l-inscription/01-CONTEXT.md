# Phase 1 — Quêtes dès l'inscription : CONTEXT (décisions verrouillées)

**Exigences :** QNEW-01..07, CLAR-03, CLAR-04 · **Contrat de design :** `design/01-DESIGN-CONTRACT.md` (+ `design/png/`, maquettes `with-content.html` / `without-content.html`), à implémenter à l'identique.

## Décisions (utilisateur, 2026-11-20)
- **D-01** Quêtes de bienvenue AJOUTÉES : jeu de départ d'un compte neuf = eau, repas, séance (les 3 starters existants « Terminer une séance », « Boire 2 litres », « S'entraîner 3 fois » restent en base). Une migration ajoute le template « repas » (métrique `nutrition_logs`, déjà supportée par `ziko_quest_metric_value`). Fichier SQL seulement ; appliqué par l'orchestrateur après accord, d'abord sur `uat-v1-20`.
- **D-02** Déclenchement : l'accueil appelle la RPC idempotente `ziko_sync_quests` à l'ouverture et après chaque action loguée (via `requestQuestRefresh` / debounce existant). Pas de trigger d'inscription.
- **D-03** La carte « Mission du jour » d'onboarding reste AU-DESSUS du bloc Quêtes ; elle disparaît une fois la mission faite.
- **D-04** Pas de lien « Voir tout » tant que l'écran Récompenses est verrouillé (niveau 3).
- **D-05** Les pièces (reward_coins) sont MASQUÉES jusqu'au niveau 3 (boutique) ; au niveau 1 : progression + action seulement.
- **D-06** La quête « Terminer une séance » est affichée dès cette phase (la phase 2 lui donne sa destination).
- **D-07** Quête terminée : le bloc affiche « Bravo, tout est fait » jusqu'au lendemain, pas de remplacement dans la journée. Retour haptique à la complétion : actif.
- **D-08** Non punitif : aucune quête « échouée » ni « expirée » visible.
- **D-09** CLAR-03 : le backend n'assigne comme première mission que `hydration_log` à un compte de niveau 1 (`backend/api/src/routes/onboarding.ts`, prompt + validation de sortie). CLAR-04 : le tap sur une quête ou sur le CTA de la première mission n'est jamais renvoyé à l'accueil par le garde de `app/(app)/(plugins)/_layout.tsx` / `gating.ts`.
- **D-10** Placement : la phase 2 ajoutera la carte « Crée ton premier entraînement » AU-DESSUS de Mission du jour (propriétaire de la composition de `app/(app)/index.tsx`). Cette phase n'insère son bloc que par édition localisée.

## Références code
`plugins/gamification/src/quests.ts` (parseQuestSync), `QuestsTab.tsx`, `packages/plugin-sdk/src/questRefresh.ts`, `apps/mobile/src/lib/questRefreshHandler.ts`, `supabase/portfolio-migrations/20261201130100..130200`, `20261201290400_quest_reward_system_award.sql` (dernière version de la sync), `packages/plugin-sdk/src/gating.ts`. Convention migrations : `supabase/portfolio-migrations/`, nouvelle seulement, jamais d'édition ; préfixe `20261215PP SS` -> `2026121501NN_...` pour la phase 1.

## Différé
Quêtes personnalisées par l'IA dès J1 ; lien Récompenses dès le niveau 1.
