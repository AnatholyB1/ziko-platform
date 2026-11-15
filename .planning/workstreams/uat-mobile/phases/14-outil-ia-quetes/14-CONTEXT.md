# Phase 14 : Outil IA de quêtes, CONTEXT

Exigences : QUEST-03..08. Branche `phase/14-quetes-ia` (base `milestone/v1.20`, après P13). Les gray areas portent la réponse recommandée marquée **[A CONFIRMER]** : appliquée par défaut, réversible, à valider par l'utilisateur. (Rédigé en début de phase, complété avec les choix faits en cours de build ; rien de codé ne contredit ce fichier.)

## Sources lues
ROADMAP phase 14, REQUIREMENTS QUEST-03..08, `13-CONTEXT.md` + `13-SUMMARY.md` (stockage, `ziko_create_quests` sans plafond, plafond à P14), v1.18 phase 45 (`D-07` monotone : jamais de retrait ; `D-05`/OPS-03 : coût autonome journalisé via `lib/autonomousCost.ts`, hors crédits), `ORCHESTRATION-v1.20` (registre : P14 propriétaire du 1er ajout d'outil), `UAT-BACKEND.md` (faux Anthropic, modes d'outil forcé).

## Décisions déjà prises (verrouillées, non rediscutées)
- **D-01 QUEST-07 non punitif** : « échouée » = statut neutre `expired`, libellé « Non terminée » (P13 D-04), jamais « échec » ; aucune pénalité XP / pièces / série ; les pièces d'une quête terminée ne sont jamais reprises ; la ligne est conservée (historique).
- **D-02 Crédits** : appels IA **automatiques** (passage de niveau, plus aucune quête) absorbés par la plateforme, plafonnés par jour et par personne, journalisés dans `ziko_ai_cost_log` (source `quest_generation`). Appels **déclenchés par l'utilisateur** (demande dans le chat) : couverts par `creditCheck('chat')` / `creditDeduct('chat')` de la route de conversation, aucun double débit.
- **D-03** Le plafond de 3 actives (QUEST-05) et le déclenchement (QUEST-04) appartiennent à P14 (P13 les a volontairement laissés).

## Décisions de conception
- **D-04 Plafond en base, sous verrou.** `ziko_create_ai_quests` (service_role seul) compte les quêtes `active` non échues sous le même verrou consultatif que `ziko_sync_quests`, n'insère qu'au plus `3 − actives` (ordre conservé, surplus ignorés et comptés), valide via `ziko_create_quests` (P13). Deux appels simultanés ne dépassent donc jamais 3 (prouvé en SQL local, scénario course).
- **D-05 Déclenchement décidé côté serveur.** `ziko_quest_ai_claim` renvoie `proceed` + `reason` : `level_up` (niveau `ziko_user_gamification.level` > dernier niveau vu), `no_quest` (0 active), `requested` (demande du chat, `p_force`), sinon `not_needed` / `full` / `daily_cap` / `not_initialized` (pas d'appel IA, coût nul). Le client ne décide de rien : il appelle `POST /quests/refresh` quand une place est libre.
- **D-06 Création = compléter ce qui reste.** Nombre créé ≤ places libres. Niveau gagné avec 3 actives : rien créé, niveau marqué vu (pas de rattrapage).
- **D-07 Pas de refus ni de suppression (QUEST-06).** Aucun outil ni route de suppression/refus ; `ziko_user_quests` reste SELECT seul côté client (P13 D-05). Durée limite toujours présente : bornes `daily` 12..48 h (défaut 24), `weekly` 72..336 h (défaut 168), la base accepte 1..840 h.
- **D-08 Deux outils pour l'agent** : `quests_get` (quêtes + places libres, échues en libellé neutre) et `quests_create` (UNE quête, paramètres plats ; l'agent l'appelle jusqu'à la limite). Pas de second appel de modèle dans le chat : la personnalisation vient du contexte utilisateur déjà injecté dans le prompt système de l'agent (`context/user.ts`).
- **D-09 Génération automatique** : `generateObject` (`AGENT_MODEL`, schéma Zod), prompt = **identité** (QUEST-08) : objectif, âge, poids, taille, niveau, focus et disposition coaching, profil d'onboarding, plugins actifs, 8 dernières quêtes et leur issue (réussite/expirée : ajuster la difficulté, ne pas répéter). Sortie **toujours renormalisée en code** (`quests/rules.ts`) : liste blanche de métriques, plages de cible, durée, pièces, une seule quête par (métrique, portée), icône `[a-z0-9-]` (jamais un emoji), et **métriques limitées aux plugins actifs** (pas d'eau sans Hydratation).
- **D-10 Relais starters → IA** (migration 1402, remplace `ziko_sync_quests` sans changer sa signature) : les quêtes de départ ne se renouvellent plus dès qu'une quête IA existe pour la personne (sinon elles reprennent les 3 places et l'IA ne crée jamais). Avant la première quête IA : comportement P13 inchangé. Une quête échue reste visible jusqu'à son remplacement : départ = même quête d'une période suivante (P13) ; IA = toute quête IA plus récente active ou terminée.
- **D-11 Quota des appels automatiques** : 2 par jour Paris et par personne (`AUTO_GENERATION_DAILY_CAP`). Le niveau n'est pas consommé quand le quota bloque (rattrapage le lendemain). Une tentative qui échoue est journalisée (coût 0) et consomme le quota.

## Gray areas
- **G-1 Relais des quêtes de départ à la première quête IA (D-10)** : les 3 quêtes de départ cessent de se renouveler. **[A CONFIRMER]** (alternative : plafond mixte départ + IA ; non retenue, les départs recréés à chaque période bloqueraient l'IA en permanence).
- **G-2 Récompense IA** daily 5..40, weekly 20..120 pièces (départ : 15/25/60). **[A CONFIRMER]**
- **G-3 Quota auto = 2/jour**. **[A CONFIRMER]** (coût plateforme maximal par personne et par jour : 2 appels `generateObject`).
- **G-4 Niveau pris = `ziko_user_gamification.level`** (récompenses/XP, onglet Niveau), pas le niveau/palier coaching v1.18 (`ziko_athlete_state.level`, dérivé du tier). **[A CONFIRMER]**
- **G-5 Déclencheur côté client** : à l'ouverture / au retour sur l'onglet Quêtes (déjà synchronisé en P13) quand une place est libre ; pas de cron ni de déclencheur au moment exact du gain de niveau (le niveau gagné est vu à la prochaine ouverture de l'onglet). **[A CONFIRMER]** (alternative : appel aussi en fin de séance / après XP ; non fait pour ne pas toucher `awardWorkoutXP` plus que P13).
- **G-6 Échec de génération sur level-up** : le niveau est déjà marqué vu, la récompense de niveau est perdue (la reprise `no_quest` couvre le cas « plus aucune quête »). Acceptable : jamais de double coût.
- **G-7 Pas de métrique nouvelle** : liste blanche P13 inchangée (séances, eau, repas, habitudes). Étendre (sommeil, mesures…) = migration + mesure en P16/ultérieur.

## Hors périmètre
UI nouvelle (l'onglet P13 affiche déjà `expired` neutre et la durée) ; notification de nouvelles quêtes ; déclenchement exact au gain de niveau ; vrai appel Anthropic (1 appel réel par l'orchestrateur après validation) ; application des migrations.
