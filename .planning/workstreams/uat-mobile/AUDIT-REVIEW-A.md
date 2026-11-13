# AUDIT-REVIEW-A : revue de code + verification objectif, v1.20 (phases 1-12, 15)

Branche `audit/review-a` (base `milestone/v1.20`). Lecture seule sur le code applicatif.
Methode : lecture de code goal-backward, greps de charte, croisement avec `FIX-UAT-RUN1/2.md`, `UAT-RESULTS-run1/2.md`.
Limite : pas de `node_modules` dans ce worktree, donc ni `vitest` ni `tsc` lances (je m'appuie sur les gates declares dans FIX-UAT-RUN1/2). Pas d'emulateur.
Couverture : revue profonde sur P2, P3, P5, P6, P7, P8, P9, P11, P12, P15. Revue partielle sur P1 et P10 (pas de lecture exhaustive des scripts `scripts/uat` ni des composants Pantry).
Ne figure pas ici ce que FIX-UAT-RUN1/2 ont deja corrige.

## Constats (SEV | fichier:ligne | probleme | impact | correctif)

### HAUTE

1. HAUTE | `backend/api/src/tools/ai-programs.ts:106` | `ai_programs_generate` insere `is_active: true` sans desactiver aucun autre programme (ni l'AI, ni le coach) et hors de la RPC `ziko_set_active_program`. En cas d'echec du parse JSON il insere aussi `program_data: { raw: rawText }` actif (l. 85-90). | Casse TRAIN-07 (un seul programme actif) : l'agent IA cree un 2e programme actif, la RPC n'est plus l'unique chemin d'ecriture annonce. Un programme vide/illisible peut devenir "actif". | Inserer `is_active: false` puis appeler la RPC (ou un `rpc` equivalent cote service), et rejeter le programme si le JSON est invalide au lieu d'inserer `{raw}`.

2. HAUTE | `apps/mobile/src/hooks/useHomeData.ts:218,266,300` + `apps/mobile/app/(app)/_layout.tsx:257` + `apps/mobile/src/lib/queryClient.ts:5` | Aucune invalidation de `['workouts','weekly']`, `['workouts','recent']`, `['session_streak']`, `['hydration','today']` apres fin de seance (`workout/session.tsx`, `summary.tsx`) ou apres un log eau dans Hydratation (qui invalide `hydration_today`, une AUTRE cle, l. 257/272). L'accueil est un ecran d'onglet, donc reste monte, avec `staleTime` 5 min et sans refetch au focus. | Apres une seance ou un log d'eau, l'accueil affiche des donnees perimees : "Recent" et semaine sans la seance (TRAIN-03/05, QLOG-01), serie, total d'eau. Seul le pull-to-refresh corrige. Les UAT ont probablement force-stop l'app, ce qui masque le defaut. | Invalider ces cles dans `awardWorkoutXP`/fin de seance et dans `logMutation`/`undoMutation` d'Hydratation, ou ajouter un `useFocusEffect` + `refetch` sur l'accueil.

3. HAUTE | `plugins/hydration/src/screens/HydrationPlugin.tsx:292,318` | Le correctif run1 #4 invalide `['hydration','goal',userId]`, cle qu'aucune requete n'utilise (l'objectif de l'accueil vit dans `['hydration','today',userId]` sous `goalMl`). | Le critere de verif 4 du run1 ("changer l'objectif puis revenir a l'accueil : mis a jour") echouera : l'objectif de l'accueil ne bouge pas. | Invalider `['hydration','today']` aux deux endroits.

### MOYENNE

4. MOYENNE | `plugins/measurements/src/screens/MeasurementsLog.tsx:66` et `MeasurementsPlugin.tsx:216` | La date de mesure est `toISOString().split('T')[0]` (UTC) alors que Quick Log (`quickLog.ts`) utilise la date locale. | QLOG-02 "1 poids/jour" casse autour de minuit : un poids logue depuis Mesures a la date UTC, puis Quick Log ne le voit pas et cree une 2e ligne. Aucune garde "une fois par jour" dans Mesures. | Utiliser `localDateKey()` partout.

5. MOYENNE | `apps/mobile/src/hooks/useHomeData.ts:65,102,110` (`useSessionStreak`) | `started_at.split('T')[0]` (UTC) compare a un curseur `localDateKey` (local). Idem `since` en UTC. | Serie d'entrainement fausse pour une seance entre 00:00 et 02:00 locale (France). | Convertir `started_at` en date locale avant comparaison.

6. MOYENNE | `plugins/habits/src/screens/HabitsPlugin.tsx:166,194,245,352,514` ; `plugins/gamification/src/store.ts:186,191` ; `workout/session.tsx:274` | Dates en UTC pour `ziko_habit_logs` (ecriture), la serie gamification et l'eau rapide de la seance. L'accueil (`useStreak`) lit avec `localDateKey`. | Une habitude cochee apres minuit local est datee la veille : la serie de l'accueil diverge ; la serie gamification (`updateStreak`) se decale. | `localDateKey()` + fournir un helper unique dans `plugin-sdk` (il existe 4 copies : `apps/mobile/src/lib/localDate.ts`, `hydration/settings.ts`, `plugin-sdk/mealLog.ts`, plus d'autres).

7. MOYENNE | `workout/session.tsx:851-852,865` | `try { await saveSessionStats(); } catch {}` dans `handleEndSession` : l'echec d'ecriture des totaux est avale, l'utilisateur voit le resume. Dans `handleFinish` (l. 864) `saveSessionStats()` n'est pas protege (rejet non gere depuis les `.then()` des l. 1560-1584). | Perte silencieuse de la seance : `total_sets=0` donc la seance est ensuite exclue de Recent/semaine par le filtre `.or('total_sets.gt.0,...')` (`useHomeData.ts:224,272`). | Afficher une erreur + reessayer ; ne naviguer vers le resume qu'apres succes.

8. MOYENNE | `useHomeData.ts:224,272` | TRAIN-03 est implemente via un filtre serveur sur `total_sets`/`total_volume_kg`, ecrits seulement a la fin de seance. Une seance dont l'app est tuee en cours, ou les seances historiques sans totaux, disparaissent de Recent et de la semaine. | Historique reel invisible ; seance interrompue jamais comptee. | Calculer a partir de `ziko_session_sets` (completed) ou migrer/backfiller les totaux.

9. MOYENNE | `apps/mobile/src/lib/workoutPlan.ts:106-110` | `hasZeroIndex = some(day_index === 0)` devine la base 0/1. Un programme 0-base sans seance le lundi (ex. 1,3,5) est lu en 1-base : Lun/Mer/Ven au lieu de Mar/Jeu/Sam. | TRAIN-04 "semaine type sur les bons jours" faux pour ces programmes. | Porter l'indexation dans `program_data` (champ explicite) ou normaliser a l'ecriture.

10. MOYENNE | `plugins/habits/src/screens/HabitsPlugin.tsx:366-367` | Message "Tu rates "X" N fois sur 7. On baisse la cible ?". | Ton culpabilisant, contraire aux regles non punitives v1.18. | Reformuler (ex. "X est difficile en ce moment : on ajuste la cible ?").

11. MOYENNE | `apps/mobile/app/(app)/workout/session.tsx:1109,1114` | "Min reached! Target:" / "Target reached!" en anglais. Le test `uatRun1Guards.test.ts:45-50` ne cherche que 7 aiguilles precises, donc passe. | Anglais residuel apres le correctif run1 #5 (affirme "aucun mot anglais"). | Traduire ; remplacer le test par un scan de motifs anglais plus large.

12. MOYENNE | `plugins/habits/src/notifications.ts:62` | Corps de notification : `${agentName} here — don't forget your ... today! 💪` (anglais + emoji). Idem `workout/[id].tsx:648` ("Séance du jour 💪"), `NotificationPermissionModal.tsx:55` (emoji). | Charte (pas d'emoji) et i18n. | Texte francais sans emoji.

13. MOYENNE | `apps/mobile/src/lib/quickLog.ts:16,185` ; `app/(app)/index.tsx:325` | `NUTRITION_GOAL_KCAL = 2200` code en dur pour l'anneau nutrition et le score "Forme du jour". Le run2 #5 a unifie a 2000 (`DEFAULT_NUTRITION_TARGETS`) mais l'accueil ignore aussi les reglages TDEE. Le commentaire (l. 160-161) cite 2200 et 2500. | Troisieme objectif kcal divergent (2000 / 2200 / reglage) : l'accueil dit autre chose que l'ecran Repas. | Lire l'objectif depuis `ziko_user_plugins.settings` avec repli `DEFAULT_NUTRITION_TARGETS`.

14. MOYENNE | `plugins/hydration/src/reminders.ts` + `HydrationPlugin.tsx:335-346` | "Plus de rappel une fois l'objectif atteint" n'est applique que si l'ecran Hydratation est ouvert (resync). Atteindre l'objectif via le Quick Log de l'accueil ou la seance laisse les DAILY actifs. | HYDR-02 partiel : rappels reçus alors que l'objectif est atteint. | Appeler la resync depuis `logWater` ou planifier le "saut" cote notification.

15. MOYENNE | `plugins/nutrition/src/screens/LogMealScreen.tsx:250-253,198-200` | `commit` protege par l'etat `saving` (asynchrone) : deux taps rapides inserent deux fois. La file hors-ligne peut renvoyer un lot deja insere si la reponse s'est perdue (`status: 'network'`), et `flushPending` peut tourner en parallele (mount + AppState). `now = useMemo(new Date())` fige aussi le repas suggere a l'heure de montage. | Doublons de repas / kcal. | Garde par `useRef`, cle d'idempotence par lot, verrou de flush.

16. MOYENNE | `apps/mobile/src/stores/authStore.ts:~226` (`getSession().then(...)`) et `onAuthStateChange` (`await get().refreshProfile()`) | Pas de `.catch` sur `getSession()` : un rejet laisse `isInitialized` a false (splash infini). `refreshProfile` (requetes supabase) est `await` dans le callback `onAuthStateChange`, motif connu de deadlock dans auth-js. | SESS-02 : risque de blocage au demarrage / a la reconnexion. | `.catch` -> `isInitialized: true` ; deporter `refreshProfile` via `setTimeout(0)`.

17. MOYENNE | `plugins/gamification/src/store.ts:~190-210` (`updateStreak`, `ensureProfile`) | Ecriture cliente directe sur `ziko_user_gamification` (UPDATE) et `rpc('ziko_award_xp'|'ziko_award_coins')` avec `p_amount` fourni par le client, erreurs non verifiees. Le diagnostic P2 mentionne une migration prod `ziko_revoke_client_dml` absente du depot (aucune trace dans `supabase/migrations`, ni sur `main`). | Si le REVOKE DML est actif en prod, la serie ne progresse jamais (echec silencieux) ; sinon le client peut s'attribuer des pieces/XP. A verifier avec l'audit securite. | Passer la serie et les gains en RPC SECURITY DEFINER qui calculent le montant ; verifier les erreurs.

18. MOYENNE | `supabase/migrations/202612011203_badge_definitions_select_policy.sql` (et `1204/1205/1803/2504`) | Fichiers non appliques. Sans la policy, `fetchAchievements` renvoie `0 sur 0` (REWD-02/03) ; sans `level_definitions`, "niveau maximum" a tort. Le gate vitest ne le voit pas. | REWD-02 depend d'un pas manuel hors code. | Garder dans la check-list de deploiement ; ajouter un test integration RLS.

19. MOYENNE | `plugins/pantry/src/utils/data.ts:36-52` (`executeRanger`) | Mises a jour/insert/suppressions sequentielles non transactionnelles (boucles N+1). Un echec a mi-chemin laisse du stock insere sans retrait des courses. | PANT-06 incoherent apres echec ; doublons au retry. | RPC unique ou, a defaut, ordre idempotent.

### BASSE

20. BASSE | `plugins/pantry/src/utils/barcode.ts:77` | `fetch` OpenFoodFacts sans `AbortController`/timeout. | Formulaire en attente indefinie hors couverture. | Timeout 8 s.
21. BASSE | `apps/mobile/app/(app)/index.tsx:413-418` | Mise a jour optimiste de l'eau : `setQueryData(waterKey, { totalMl })` ecrase `goalMl` (flicker vers 2000 ml) ; rollback sur `prev` perd un 2e tap rapide ; `setTimeout` sans cleanup. | Cosmetique. | Fusionner `{...prev, totalMl}` ; utiliser `onMutate` de react-query.
22. BASSE | `apps/mobile/src/lib/quickLog.ts:83-96,134-150` | Poids/humeur : "select puis insert/update" non atomique (pas d'index unique, choix documente). Double tap -> 2 lignes. | Doublons rares. | Verrou local ou RPC upsert.
23. BASSE | `plugins/hydration/src/screens/HydrationPlugin.tsx:218-233` | Recalcule objectif de base + bonus a la main au lieu d'appeler `fetchEffectiveGoalMl` (la "source unique" a donc deux chemins de lecture). | Risque de re-divergence. | Un seul hook partage.
24. BASSE | `plugins/hydration/src/store.ts:20-23` | `DEFAULT_CONTAINERS` avec icones emoji + store local `getFavoriteContainer` utilise par la seance : 3e mecanisme d'eau a cote de la base et du Quick Log. | Charte + etat parallele. | Ionicons ; lire la taille de verre dans `ziko_hydration_settings`.
25. BASSE | `apps/mobile/src/lib/friendRequest.ts:30-33` | `/permission denied/` est classe "session expiree" : un GRANT manquant sera presente comme une session expiree. | Diagnostic trompeur. | Distinguer 42501 (RLS) de 'permission denied for table'.
26. BASSE | `apps/mobile/app/(app)/_layout.tsx:181`, `plugins/coach/src/screens/coachLinked.ts:35`, `coachState.ts:45`, `ConversationScreen.tsx:129` | `toLocaleDateString/TimeString` encore utilises malgre XCUT-02 ("tous remplaces"), risque "May" sur Hermes. | XCUT-02 non complet. | `formatDateFr`.
27. BASSE | `plugins/nutrition/src/screens/TDEECalculatorScreen.tsx:34-37,198,226,258,277,335` | Emojis dans l'UI (calculateur TDEE). | Charte. | Ionicons.
28. BASSE | `apps/mobile/src/lib/programsService.ts:~166-170` | Rollback de `duplicateProgram` : resultat du `delete` ignore ; copie sequentielle (N+1 par seance). | Programme demi-copie possible. | Verifier l'erreur / RPC.
29. BASSE | `ziko_set_active_program` (`202612010703`) | La RPC met `is_active=false` sur la ligne du programme COACH assigne : la meme ligne sert au CRM coach. Aucun index unique partiel n'impose un seul actif. | Le coach voit son programme desactive par le choix de l'athlete ; les chemins hors RPC (constat 1) peuvent encore creer 2 actifs. | Etat "actif" cote athlete dans une table dediee ; index unique partiel.
30. BASSE | `apps/mobile/src/__tests__/uatRun1Guards.test.ts` ; `mealLog.test.ts` ; `nativeDepsAlignment.test.ts` | Tests par `readFileSync` + regex : `if (/<TextInput/.test(body))` rend le test KAV conditionnel ; ils ne prouvent ni clavier ni rendu. Annonce comme tel dans FIX-UAT-RUN1, mais comptes dans le gate. | Faux sentiment de couverture. | Garder, mais ne pas les compter comme preuve.
31. BASSE | `plugins/habits/src/store.ts:122-158`, `HabitLogScreen.tsx:19` | Emojis par defaut/pickers d'habitudes. | Charte (donnee utilisateur, tolerable). | Ionicons par defaut.

Hors constat (verifie conforme) : aucun `Alert.alert`, aucun `StyleSheet.create`, aucun `findLast` dans le perimetre ; les `catch {}` restants hors constats ci-dessus sont des degradations volontaires et commentees.

## Tableau par phase

LIVRE = visible dans le code ET preuve (emulateur ou test). PARTIEL = code present, preuve emulateur absente ou defaut ci-dessus. ABSENT = non trouve.

### P1 Harness (HARN-01..07)
| Exigence | Etat | Preuve |
|---|---|---|
| HARN-01 AVD scripte | LIVRE | `scripts/uat/avd-create.sh`, `emu-start.sh` ; 01-SUMMARY (capture locale `uat-evidence/01`) |
| HARN-02 Maestro | PARTIEL | seul `demo-login-nav` passe ; `p03-habits-crash.yaml` echoue tel quel (UAT-RESULTS-run1) |
| HARN-03 comptes + seed reproductible | PARTIEL | `seed-v1-20.sql` existe ; `create-accounts.mjs`/`reset-data.mjs` jamais executes en reel (01-SUMMARY), seed ajuste a la main (athlete_state) |
| HARN-04 preuves par flow | PARTIEL | `evidence.sh run` non execute ; preuves par uiautomator ad hoc |
| HARN-05 simulations | PARTIEL | GPS/background OK ; expiration (`sim-session-expiry.mjs`) et camera non prouvees |
| HARN-06 file d'attente | LIVRE | `queue.sh`, verrou machine |
| HARN-07 migrations | LIVRE | `check-migration-names.mjs`, `README-v1.20.md` ; garde anti-prod (`lib.mjs:7`, `backend-start.sh:15`) |

### P2 Session
| Exigence | Etat | Preuve |
|---|---|---|
| SESS-01 refresh au premier plan | PARTIEL | `authStore.ts` AppState + `sessionManager.ts` ; test `sessionRefreshReal` (vrai GoTrueClient, fetch mocke) ; aucun signal emulateur (P2-REFRESH-DEBUG, run1 #6) ; cablage natif non teste |
| SESS-02 session expiree -> login | PARTIEL | run1 : session morte -> ecran login sans boucle ; alerte "Session expiree" non observee ; risque constat 16 |
| SESS-03 plus de "non connecte" | LIVRE (code) | `patchGetUser` (`supabase.ts:21`) ; pas de preuve emulateur |
| SESS-04 cause ajout d'ami | PARTIEL | diagnostic = "cause plausible", non reproduite (02-DIAGNOSTIC) ; envoi A->B PASS run1 ; constat 25 |

### P3 Habitudes / garde
| Exigence | Etat | Preuve |
|---|---|---|
| HABT-01 plus d'ecran blanc | PARTIEL | cause racine non reproduite (03-SUMMARY) ; run1 : 3 ouvertures stables, 0 FATAL logcat |
| HABT-02 garde d'erreur | LIVRE | `(plugins)/_layout.tsx` + `ErrorBoundary.tsx` ; run1 crash-test : ecran d'erreur, retour, autre module OK |

### P5 Transverses
| Exigence | Etat | Preuve |
|---|---|---|
| XCUT-01 slugs | LIVRE | `displayLabels.ts:goalLabel` ; run1 XCUT-01 PASS |
| XCUT-02 anglais/mois | PARTIEL | run1 PASS echantillon ; residus constats 11, 26 |
| XCUT-03 safe-area | PARTIEL | `WSHeader` mesure ; ecrans a en-tete maison non traites (05-SUMMARY) ; non teste |
| XCUT-04 bug FAB | PARTIEL | `BugFab` repositionne (run1 #6b) ; pas de re-verification |
| XCUT-05 marges onglets | PARTIEL | `SubTabs` ; NON-TESTE run1 |
| XCUT-06 noms d'exercices | PARTIEL | accueil + atelier corriges (run1 #3) ; noms bruts en base non francises ; sites stats/plugins non traites |
| XCUT-07 "Coach Ziko" | LIVRE (code) | tag "Conseil" ; sans capture |

### P6 Seance
| Exigence | Etat | Preuve |
|---|---|---|
| TRAIN-01/02 ouvrir la seance prevue | LIVRE (partiel) | run1 flow A PASS (jour de repos -> "Lower", 8 exos) ; B, D, E, F NON-TESTE |
| TRAIN-03 seance vide non comptee | PARTIEL | run1 C PASS (0 ligne) ; mais constats 7, 8 |
| TRAIN-04 semaine type | PARTIEL | `workoutPlan.ts` ; constat 9 ; non teste |
| TRAIN-05 detail depuis Recent | PARTIEL | route `session/[sessionId].tsx` ; NON-TESTE ; constat 2 |

### P7 Programmes
| Exigence | Etat | Preuve |
|---|---|---|
| TRAIN-06 liste de tous les programmes | LIVRE | run1 flow A PASS (filtres 3/1/1/1) ; `programsService.loadAllPrograms` |
| TRAIN-07 un seul actif | PARTIEL | RPC `202612010703` solide ; contournee par `backend/.../ai-programs.ts:106` (constat 1) ; run2 B, C PASS |
| TRAIN-08 menu | PARTIEL | run2 PASS liste ; D NON-TESTE |
| TRAIN-09 assistant 4 etapes -> actif | PARTIEL | `program-builder.tsx` ; NON-TESTE ; `ai-programs/dashboard` crash corrige run2 #2 (non rejoue) |
| TRAIN-10 seance rapide Ionicons FR | PARTIEL | non teste |

### P8 Quick Log
| Exigence | Etat | Preuve |
|---|---|---|
| QLOG-01 total d'eau, logs illimites | LIVRE | run1 U1/U3 PASS (0,75 L persiste) ; constats 2, 3 |
| QLOG-02 poids 1x/jour | PARTIEL | `saveTodayWeight` ; U4 FAIL clavier (corrige par KAV, non rejoue) ; constat 4 |
| QLOG-03 humeur 1x/jour | PARTIEL | `saveTodayMood` ; run1 U7 PASS partiel |
| QLOG-04 tuile repas + kcal | PARTIEL | run2 PASS U8, U9 ; constat 13 |
| QLOG-05 score + etat vide | PARTIEL | `computeFormScore` (testable) ; run2 U12/U13 PASS ; constat 13 |

### P9 Repas
| Exigence | Etat | Preuve |
|---|---|---|
| NUTR-01 ecran unique 1 tap | LIVRE | run2 PASS U5-U11, U13 |
| NUTR-02 preselection heure + derniere methode | LIVRE (code) | `mealTypeForHour`, prefs AsyncStorage ; U1/U12/U15 NON-TESTE |
| NUTR-03 repas du jour visibles | LIVRE | run2 PASS ; fix minuit non rejoue |
| NUTR-04 recherche/scan/code-barres/manuel | PARTIEL | PASS sans scan reel ; constat 15 |

### P10 Garde-manger
| Exigence | Etat | Preuve |
|---|---|---|
| PANT-01..04 listes, ajout, scan, detail | PARTIEL | run1 : onglets/groupes/badges PASS ; ajout manuel/scan non rejoues |
| PANT-05 recettes IA + macros restantes | LIVRE | `pantry-recipes-macros.ts` + tests backend ; run2 PASS (faux Anthropic arme) |
| PANT-06 courses | PARTIEL | NON-TESTE ; constat 19 |
| PANT-07 libelles FR | PARTIEL | "Courses" ; texte sans scan exhaustif |

### P11 Hydratation
| Exigence | Etat | Preuve |
|---|---|---|
| HYDR-01 boutons | LIVRE | run1 : +250/+500/+750 presents |
| HYDR-02 rappels | PARTIEL | `reminders.ts` ; constat 14 ; NON-TESTE |
| HYDR-03/04/05 verre / cafe-the / bonus | PARTIEL | `settings.ts` + feuilles ; run2 PASS HY-7, HY-9 seulement |
| HYDR-06 champ au-dessus du clavier | PARTIEL | KAV deja present ; non rejoue |
| Objectif unique accueil/plugin | PARTIEL | constats 3, 23 |

### P12 Recompenses
| Exigence | Etat | Preuve |
|---|---|---|
| REWD-01 4 onglets | LIVRE | run1 R-1 PASS |
| REWD-02 11 succes (en fait 12) + progression | PARTIEL | RPC `ziko_get_badge_progress` ; "0 sur 0" tant que la migration 1203 n'est pas appliquee (constat 18) ; run2 R-2 partiel |
| REWD-03 fiche succes | PARTIEL | NON-TESTE |
| REWD-04 attribution automatique | PARTIEL | `awardBadges` apres seance, a l'ouverture de l'ecran, profil ; badges amis/habitudes seulement a l'ouverture |
| REWD-05 boutique sans limite de 8 | LIVRE (code) | aucune troncature trouvee ; non teste |
| REWD-06 mes objets / equiper | PARTIEL | `equipItem` ; NON-TESTE |
| REWD-07 solde permanent | PARTIEL | run1 R-1 (solde) PASS, "visible en permanence" non verifie |
| REWD-08 historique | PARTIEL | pagination `HISTORY_PAGE_SIZE` ; run1 PASS partiel |
| REWD-09 apercu avant achat | LIVRE (code) | `ShopTab.tsx:112,161` ; non teste |
| REWD-10 pas de liste factice | LIVRE | `fetchAchievements` leve ; pas de liste de secours |

### P15 Mesures
| Exigence | Etat | Preuve |
|---|---|---|
| MEAS-01 objectifs en base | LIVRE | `202612011501` + RPC ; run2 PASS ME-1, ME-2 |
| MEAS-04 7 mesures | LIVRE | `goals.ts:MEASURES` |
| MEAS-05 % de completion | LIVRE | `computeGoalProgress` (tests) ; run2 ME-5 PASS |
| MEAS-06 objectif non modifiable | PARTIEL | index unique `idx_athlete_goals_one_active_per_measure` ; UI NON-TESTE |
| Texte coach "stables" | LIVRE (code) | `coachTip.ts` ; non rejoue |
| Date locale de saisie | PARTIEL | constat 4 |

(MEAS-02, 03, 07, 08, 09 relevent de P16/P14 : hors perimetre.)

## Reste a faire (non couvert faute de contexte)
- Revue exhaustive des composants Pantry, de `plugins/gamification/src/screens/rewards/*`, de `GoalsTab.tsx`, et des scripts `scripts/uat/*.mjs`.
- Executer `vitest` et `tsc` (necessite `npm install --no-save` dans un worktree).
