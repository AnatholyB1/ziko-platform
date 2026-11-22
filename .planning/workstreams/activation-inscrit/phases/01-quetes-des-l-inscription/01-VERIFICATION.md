# Phase 1 - Verification orientee but (re-verifiee, branche `audit/phase-1`)

Preuves de gate : voir `01-REVIEW.md` (type-check, lint, build OK ; mobile 629 + 121 tests, backend 592 tests verts). Rien n'est prouve sur appareil ni sur base reelle.

| Exigence | Verdict | Preuve |
|---|---|---|
| QNEW-01 quetes actives des l'arrivee | PARTIAL | Code + `questsBlock.test.tsx` (« 3 welcome quests »). Necessite la migration appliquee (meal) et la decision D-01/A1 sur l'hebdo. SQL jamais execute (HUMAN_NEEDED) |
| QNEW-02 sans Recompenses, sans doublon | VERIFIED | Sync declenchee par `useHomeQuests` ; unique `(user_id,slug,period_start)` + `ON CONFLICT DO NOTHING` (130100, 290400) |
| QNEW-03 <= 3, titre, progression, completion | VERIFIED (reserve M2) | `MAX_ACTIVE_QUESTS=3` dans `visibleHomeQuests`; `homeQuests.test.ts` ; ordre degrade si hebdo active + quotidienne terminee |
| QNEW-04 action + un tap | VERIFIED | `QUEST_ACTIONS` table, `QuestRow` (titre, actionText, barre, bouton) ; test de rendu |
| QNEW-05 aucun ecran verrouille a L1 | VERIFIED | Test A5 sur la table ; `hydration`/`nutrition` minLevel 1 (`gating.ts:121-124`) ; routes existent ; `gamification` L3 jamais ciblee |
| QNEW-06 completion sans relance | VERIFIED (code) / HUMAN_NEEDED (appareil) | `detectCompletions` + test rendu ; handler `questRefreshHandler` ; M3 : pas de relecture au retour d'arriere-plan |
| QNEW-07 aucune quete echouee | VERIFIED (accueil) / PARTIAL ailleurs | `status !== 'expired'` filtre (A7). Mais M1 : l'onglet Recompenses affiche un « Non terminees » eternel pour les comptes existants |
| CLAR-03 premiere mission = hydratation | VERIFIED | `coerceFirstMission` + `tools/onboarding.spec.ts` / `routes/onboarding.spec.ts` ; prompt ; seul appelant de l'ecriture du choix = `assess_profile` |
| CLAR-04 bouton jamais renvoye a l'accueil | VERIFIED (logique) / HUMAN_NEEDED (Maestro) | Route hydratation minLevel 1 ; `_layout.tsx` non modifie, `isPluginRouteLocked` teste sur segments (garde non monte). Missions legacy journal/mesures : accueil masque, chat non (L5) |

## Decisions verrouillees D-01..D-10
- D-01 : PARTIEL, **contradiction interne**. D-01 : « eau, repas, seance ; les 3 starters existants restent en base ». Contrat A1 : count(active) <= 3 en base. Avec les 3 quotidiennes + l'hebdo starter, un compte neuf aurait 4 lignes actives. La migration choisit A1 (hebdo `is_starter=false`) = les lignes restent en base mais ne sont plus generees : lecture stricte de D-01 non respectee.
- D-02 OK (RPC a l'ouverture/focus + `requestQuestRefresh`). D-03 OK (Mission du jour au-dessus). D-04 OK (aucun lien). D-05 OK (pieces masquees < L3, partout). D-06 OK (workout affiche). D-07 PARTIEL (M2 + M3 : completees peuvent disparaitre ; rollover de minuit). D-08 OK a l'accueil / M1 ailleurs. D-09 OK. D-10 OK (insertion localisee apres Mission du jour ; P2 deja fusionnee au-dessus).

## Contrat A1..A17 (resume)
A1 PARTIAL (depend de la migration, DB). A2 OK (contrainte unique). A3/A4 OK en test, Maestro non fait. A5 OK. A6 OK en simulation, delai non mesure. A7 OK. A8 OK backend. A9/A10/A12/A13 non mesures (HUMAN_NEEDED ; tailles lues dans le code : `minHeight 84`, bouton `44x44`, texte 14). A11 couleurs du contrat reprises. A14 OK (pas d'emoji ; `visibleTextGuard` vert). A15 OK (ordre fixe). A16 OK en test (« Reessayer »). A17 PARTIAL (L1 : animation lancee avant la lecture asynchrone de reduce motion).

## Decision produit a signaler (ne PAS trancher)
Question : la quete hebdomadaire « S'entraîner 3 fois » doit-elle encore etre generee pour tous les comptes sans quete IA ?
- Option A (actuelle) : `is_starter=false`. Pour : A1 respecte, 3 lignes exactement, aucun code UI a changer. Contre : contredit la lettre de D-01 ; comptes existants perdent leur hebdo ; fantome « Non terminees » eternel dans Recompenses (M1) a traiter.
- Option B (alternative minimale, sans toucher a `is_starter`) : retirer l'etape 4 de la migration ET corriger `orderQuests` (M2) pour que les quotidiennes, terminees ou non, precedent toujours l'hebdo ; le plafond UI a 3 masque alors l'hebdo pour tout compte ayant les 3 quotidiennes. Pour : D-01 a la lettre, rien de retire aux comptes existants. Contre : A1 mesure en base echoue (4 lignes actives) ; une hebdo invisible peut se terminer et verser des pieces sans etre vue (pieces creditees silencieusement, acceptable avant L3 mais a assumer) ; l'onglet Recompenses (L3) la montre.
- Option C : B + exclure explicitement l'hebdo du bloc accueil tant qu'une quotidienne existe, et assouplir A1 en « <= 3 quetes AFFICHEES ».
Recommandation technique non decisoire : dans tous les cas corriger M2 ; la contradiction D-01/A1 est a arbitrer par l'utilisateur avant d'appliquer la migration.
