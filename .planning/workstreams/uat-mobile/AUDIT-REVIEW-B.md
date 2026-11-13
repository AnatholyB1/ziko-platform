# AUDIT-REVIEW-B : revue de code + verification de l'objectif, milestone v1.20 (phases 13, 14, 16-26)

Branche `audit/review-b` (base `milestone/v1.20`). Lecture seule du code applicatif. Methode : goal-backward sur le code (pas sur les SUMMARY), lecture integrale des migrations 1301-1602, 1701, 1801-1803, 1901-1903, 2001, 2101-2103, 2301, 2401-2402, 2501-2504, 2601-2605, des services backend quetes / mesures / atelier / periodisation / ligue, des ecrans cles.

Limites : `npx vitest run`, `tsc` et `backend/api vitest` n'ont PAS pu etre lances (le worktree n'a pas de `node_modules` : MODULE_NOT_FOUND sur `vitest.config.ts`). Les chiffres de tests cites viennent des SUMMARY / FIX-UAT, non rejoues. Aucun SQL execute. Les constats ci-dessous sont tous verifies par lecture du code ; ceux deja corriges par `FIX-UAT-RUN1/RUN2` ne sont pas repris (grants 1803/2504, crash `ExpoTopicSubscriptionModule`, KAV, policies badge/level, `hydration_ml` sans plugin, emoji coin, "mesures stables").

## 1. Constats (SEV | fichier:ligne | probleme | impact | correctif)

### HAUTE
H1 | HAUTE | `supabase/migrations/202612011602_quest_measurement_metric.sql:15-54` (meme code en `202612011302:38-72`) + creation `1602:58-112` | `ziko_quest_metric_value` borne les metriques a base de colonne `date` (hydratation, repas, habitudes, mesures) par `(p_from AT TIME ZONE 'Europe/Paris')::date` .. `(p_to ...)::date` EXCLUSIF. Une quete IA/chat a `period_start = now()` et `expires_at = now()+duree` (pas alignees sur minuit). Deux effets : (a) les logs deja saisis le jour de creation comptent (quete "Boire 2 L" creee a 21 h apres avoir bu 2 L = terminee a la premiere sync, pieces creditees) ; (b) une quete quotidienne de 24 h creee a 21 h a `v_to_d` = demain, exclusif : les logs de demain ne comptent jamais, la fenetre utile est les 3 h restantes du jour de creation. Seules les quetes de depart (periodes alignees sur minuit Paris) sont justes ; `workout_sessions` (timestamps exacts) est juste. | QUEST-01/04 ("progression sur donnees reelles") non tenu pour toute quete IA a metrique datee ; pieces gagnees sans effort ; quetes quotidiennes IA quasi impossibles. Non detecte par le harnais SQL (starters seulement) ni par l'UAT (QA-1..8 non testes). | Nouvelle migration (jamais editer 1302/1602) : pour `source='ai'`, calculer sur `[ceil_day(period_start), expires_at]` en date locale incluse ou ne compter que les lignes `created_at >= period_start` (colonne horodatee) ; au minimum aligner `period_start` / `expires_at` des quetes IA sur des bornes de jour Paris. Ajouter un cas de test "quete IA creee a 21 h".

### MOYENNE
M1 | MOYENNE | `supabase/migrations/202612011402_quest_sync_ai_handover.sql:35-48` + `202612011401:~60-95` (claim) + `plugins/gamification/src/screens/GamificationPlugin.tsx:113` | Le relais starters -> IA ne se produit que si `claim` voit une place libre. Tant qu'aucune quete IA n'existe, `ziko_sync_quests` recree chaque periode les 3 starters : `active` revient a 3 chaque jour, donc `full` (le niveau est alors marque "vu", `last_level` ecrase) ; `no_quest` exige 0 active, soit tout termine, hebdo compris. Un joueur qui termine 2 starters sur 3 ne recoit jamais de quetes IA. | QUEST-04 ("a chaque passage de niveau ou quand aucune quete ne reste") livre en pratique seulement au level-up avec une place libre ; aucune preuve emulateur de la generation auto. | Declencher le relais (flag "starters epuises") apres N jours/1ere completion, ou ne pas consommer `last_level` quand `full`, ou laisser les starters expires sans les renouveler des que la personne est au niveau 2.

M2 | MOYENNE | `supabase/migrations/202612012603_league_sync.sql:129-160` (boucle) ; claim "absence longue = non scorée, jamais punie" de `26-SUMMARY.md` | `v_asked` n'est jamais <= 0 (habitudes : `GREATEST(3,...)*7 >= 21` ; performance : `>= 1`), donc la branche `neutral` (ligne 137) est morte. Toute semaine echue sans activite est scoree 0 (< 30) : 3 semaines d'absence = `down` (plancher `max(start, peak-1)`). Le harnais ne teste que 30 semaines d'absence a `division = start` (`run.mjs:291`), cas ou la descente est impossible. | Penalite de palier pour absence/maladie/vacances, contraire a la regle non punitive v1.18 et au SUMMARY. XP/pieces/serie bien intacts. | Marquer `neutral` toute semaine sans aucune activite (done = 0 sur les 2 pistes) ; tester a `division > start`.

M3 | MOYENNE | `backend/api/src/league/service.ts:66-97` + `supabase/migrations/202612012604` (`ziko_league_ai_claim`) | Apres une decision `transition=false` (`declined`) rien n'est memorise : l'eligibilite reste vraie (4 semaines >= 70) et le modele est rappele chaque jour (cap 1/jour, temperature 0, meme preuve = meme reponse). | Un appel Sonnet absorbe par jour et par utilisateur eligible, indefiniment. | Stocker `declined_at` et imposer un delai (7-14 j) ou ne rappeler que si la preuve a change.

M4 | MOYENNE | `backend/api/src/periodization/relaunch.ts:182,228-236` + `periodization/store.ts` (`countAutoCallsToday`) | Le plafond de 1 appel/jour compte les lignes `ziko_ai_cost_log`, ecrites apres l'appel et seulement si `generateText` retourne. Si le modele leve (cas `catch`) rien n'est journalise : le plafond n'est pas consomme et `claimPropose` ne protege que 3 min (`PROGRAM_RELAUNCH_STALE_MS`). Le client peut rappeler `POST /ai/workshop/relaunch/:id/propose` en boucle ; chaque tentative ayant atteint le fournisseur coute des jetons non traces. Contraste : `quests/service.ts` et `league/service.ts` journalisent aussi les echecs. | Plafond de cout contournable, cout invisible. | Journaliser dans le `catch` (usage null) comme P14/P26 et/ou persister un compteur en base sous verrou.

M5 | MOYENNE | `backend/api/src/workshop/webSearch.ts:34-62` | Plafond de 20 recherches/jour lu dans `ziko_ai_cost_log` avant l'appel, journal ecrit en fire-and-forget apres : des tours paralleles depassent le plafond ; un echec du runner (`catch`, ligne 70+) ne journalise rien alors que l'API web_search peut avoir ete facturee. | Cout absorbe non borne strictement (jusqu'a 2 recherches/sous-appel). | Reservation atomique (table de compteur ou RPC avec verrou) et journal en cas d'erreur.

M6 | MOYENNE | `backend/api/src/workshop/store.ts:112-143` (`publishDraft`) + `routes/workshop.ts` `/drafts/:id/publish` | Lecture du statut puis INSERT puis UPDATE `saved` sans verrou ni contrainte : deux "Enregistrer" concurrents (double tap, reessai reseau) creent deux programmes inactifs (`saved_program_id` ecrase). Pour un brouillon de relance, `sequence_position` collisionne sur l'index unique `uq_ziko_ai_programs_sequence_position`, l'un des deux recoit un 500. | Doublon de programme dans la liste P7 ; erreur 500 sur la suite. | `UPDATE ... SET status='saved' WHERE id=$1 AND status='draft' RETURNING` avant l'insert, ou RPC unique transactionnelle.

M7 | MOYENNE | `backend/api/src/measurements/rules.ts:93-120` (`injury_pause`, `main_goal_change`) | Deux des 4 motifs MEAS-07 sont "declaratifs" : le serveur n'exige qu'une phrase fournie par le modele, sans lien avec une donnee reelle (blessure, pause, changement d'objectif principal valide). Le modele peut donc modifier n'importe quel objectif en cours en declarant `injury_pause` (cooldown 14 j seulement). | MEAS-06/07 ("l'IA ne modifie qu'a 4 conditions") contournable sur 2 motifs. | Exiger un signal persiste (champ `athlete_state` pause/blessure, objectif principal valide dans `athlete_decisions`) ou une confirmation utilisateur avant d'appliquer.

M8 | MOYENNE | `supabase/migrations/202612012103_public_profile_rpc.sql:23-199` (Q-P21a) | `ziko_get_public_profile(p_user)` est SECURITY DEFINER et accessible a tout utilisateur authentifie pour n'importe quel UUID : seances recentes, records de charge, serie, defis communs, objectif, sans relation d'amitie ni opt-out (le choix est documente mais non valide produit/RGPD). | Exposition de donnees d'entrainement a tous les comptes ; enumeration possible. | Reduire le profil par defaut aux amis/relation `friend`/`sent`, ajouter un reglage de visibilite (public / amis / prive) avant mise en production.

M9 | MOYENNE | `plugins/stretching/src/components/DefaultStretchingCard.tsx` + `apps/mobile/app/(app)/workout/session.tsx:956,1636` | STRE-06 exige que la routine par defaut soit "ajoutee automatiquement au debut de chaque seance". Livre : une carte "Ajoutee en debut de seance" a toucher pour lancer la routine ; rien n'est insere dans la seance ni demarre. | Ecart d'interpretation, ce n'est pas un ajout automatique. | Trancher avec le produit ; si auto : lancer/inserer au demarrage avec bouton "Passer".

M10 | MOYENNE | `.planning/workstreams/uat-mobile/phases/{16,23,24,25,26}` (UAT-RESULTS absent ou NON-TESTE) et P14 QA-1..8, P18/P19/P20 | Aucune preuve emulateur pour P16, P23, P24 (NON-TESTE), P25 et P26 (aucun fichier UAT-RESULTS) ; P14 generation automatique non testee ; P19 : aucun re-test apres le correctif RUN2 ; P18 : creation/lancement de routine non testes. Les "VERIFIED" de P14/P16/P26 reposent sur un Postgres 18 local avec stubs + faux modele (aucun test du schema portfolio reel, `auth.role()` simule). | Les claims "VERIFIED (SQL local)" sont a considerer "non prouve en conditions reelles". | Run3 prioritaire : quetes IA (H1, M1), atelier a 0 credit, relance seedee, retrait de coach, ligue.

M11 | MOYENNE | `plugins/timer/src/...` / `supabase/migrations/202612012001_timer_preset_fields.sql:3` ; `20-SUMMARY.md` | TIMR-03 : le preset "Exemple" n'est pas supprime en base (volontairement) ; seul le repli code est retire. Le compte UAT garde la ligne. | Exigence PARTIELLE. | Migration de nettoyage ciblee (`DELETE ... WHERE name='Exemple' AND user_id` jamais modifie) ou decision explicite.

### BASSE
B1 | BASSE | `quests/service.ts:140-146` + `ziko_quest_ai_claim` | Le claim consomme `last_level` / le quota avant la generation : un echec modele perd le level-up (repli `no_quest` seulement). | Quetes de niveau parfois jamais generees. | Rendre le niveau "vu" apres l'insertion reussie.
B2 | BASSE | `backend/api/src/workshop/limits.ts:4,8`, `periodization`, `webSearch.ts`, `relaunch.ts:213`, `workshop.ts` (`'claude-sonnet-4-20250514'` en dur) | Contraire a la regle "modele centralise dans `config/models.ts`" ; les lignes de cout peuvent diverger du modele reel. Les plafonds par jour sont en UTC (atelier, relance) mais en Europe/Paris (quetes, ligue). | Incoherence de comptage. | Utiliser `AGENT_MODEL.modelId` et un jour de reference unique.
B3 | BASSE | `backend/api/src/app.ts:70,102,103` | Aucune limitation de debit sur `/quests/refresh`, `/league/refresh`, `/ai/workshop/relaunch/*` (le middleware `rateLimiter` n'est utilise que par `auth-email`). Les plafonds sont en base mais chaque appel execute du SQL lourd (`ziko_league_sync`, `relaunch/check`). | Surface de charge. | Ajouter le `rateLimiter` Upstash.
B4 | BASSE | `backend/api/src/workshop/store.ts:56-75` | "Un seul brouillon" n'est pas garanti en base : `WORKSHOP_MAX_DRAFTS = 5` applique par lecture puis insertion, les surplus sont archives en `status='saved'` sans programme (semantique detournee) ; creation avant le premier octet du modele : un 502 laisse un brouillon et une conversation orphelins. | Lignes parasites. | Index partiel + statut `archived`.
B5 | BASSE | `supabase/migrations/202612012001_timer_preset_fields.sql:14` | `ADD CONSTRAINT ... CHECK (rounds >= 1)` valide les lignes existantes ; une ligne `rounds = 0` fait echouer toute la migration (non idempotent, sans `NOT VALID`). | Migration bloquante possible. | `NOT VALID` puis `VALIDATE`, ou `UPDATE` prealable.
B6 | BASSE | `supabase/migrations/202612011302:80,167` (`Europe/Paris` fige) | Fuseau code en dur alors que les `date` (eau, repas, habitudes) sont ecrites en date locale appareil par le client : decalage pour un utilisateur hors Paris. Non prouve sur appareil (cf. SUMMARY P13). | Quetes quotidiennes decalees hors France. | Stocker le fuseau du profil.
B7 | BASSE | `plugins/sleep/src/screens/SleepPlugin.tsx:309`, `lib/data.ts` | "Reveil intelligent" = preference sans effet ; une nuit connectee (`ziko_wearable_daily_summary`) n'est lue que par Sommeil/accueil, pas par `plugins/stats/src/store.ts:1236,1252`, `plugins/cardio` ni `coach/ai`, qui lisent `ziko_sleep_logs` seul (SLP-06 limite a Sommeil + accueil). | Incoherence entre ecrans. | Ecrire aussi la nuit connectee dans `ziko_sleep_logs` (`source='health'`, colonne deja prevue) ou unifier la lecture.
B8 | BASSE | `plugins/stretching/.../202612011801` (policies UPDATE/DELETE) + `1803` (GRANT SELECT, INSERT seulement) | Policies UPDATE/DELETE des exercices personnalises mortes (pas de GRANT), aucun ecran d'edition/suppression d'exercice : STRE-02 limite a la creation. | Dette. | GRANT UPDATE, DELETE si l'edition est voulue.
B9 | BASSE | `plugins/stretching/src/data.ts:86-135` (`saveRoutine`) | Changement de routine par defaut en 2 UPDATE + compensation applicative, non atomique (l'index unique protege l'etat final mais pas la fenetre intermediaire). | Faible. | RPC unique.
B10 | BASSE | tests : `plugins/stretching/src/migrations.test.ts`, `v120MigrationGrants.test.ts`, `nativeDepsAlignment.test.ts`, `mealLog.test.ts` (gardes source) | Beaucoup de "tests" sont des regex sur du SQL / du source ; ils ne testent aucun comportement (l'absence de GRANT de P18/P19 est passee a travers). Honnetes dans leurs en-tetes, mais ne valent pas preuve. | Faux sentiment de couverture. | Jouer `backend/api/test/rls` sur une base jetable avant merge.
B11 | BASSE | `.planning/workstreams/uat-mobile/ROADMAP.md` (Progress : 26 phases "Not started 0/0") et `REQUIREMENTS.md` (cases `[ ]`, Traceability "Pending", "0 orphelin") | Documents de pilotage non mis a jour ; "0 orphelin" faux (voir section 3). | Pilotage trompeur. | Synchroniser a la cloture.

Conformite charte (13-26) : `grep` sur plugins + `apps/mobile/app` : aucun `Alert.alert`, aucun `StyleSheet.create`, aucun emoji (plages Unicode) ; `paddingBottom: 100` present sur sleep, stretching, atelier, sequence, league (140 sur la feuille Sommeil avec barre fixe, accepte). Regle non punitive : quetes (`expired` neutre, pas de retrait), relance (aucun import credits/gamification, `relaunch.ts:5`), retrait de coach (copie sans mot punitif, historique conserve) conformes ; seul M2 (ligue) deroge. Idempotence / courses : plafond de 3 quetes sous verrou consultatif commun (`1401` : OK, course testee en SQL local) ; activation unique de programme via P7 (non reverifiee ici, hors perimetre) ; brouillon d'atelier : voir M6/B4 ; transition de ligue : `ziko_league_apply_transition` sous le meme verrou que `ziko_league_sync` (OK sur le papier, non eprouve en parallele).

Chaine de migrations (1302 -> 1402 -> 1602) : verifiee. `ziko_sync_quests` (1302) redefinie par 1402 avec starters + mesure + credit unique + visibilite des echues conserves, `1602` ne la touche pas. `ziko_quest_metric_value` (1302) redefinie par 1602 en gardant les 4 branches + `measurement_logs`. `ziko_create_quests` (1302) redefinie par 1602 avec la liste blanche etendue ; `ziko_create_ai_quests` (1401) l'appelle (OK). CHECK `ziko_user_quests_metric_check` mis a jour en 1602. L'ordre de rejeu est coherent (1203/1204/1205 avant 13xx ; 1803 puis 2504 pour les GRANT ; 2301 avant 2401 ; 1501/1502 avant 1601). Dependances hors depot : `ziko_award_coins`, `ziko_award_xp`, `ziko_user_gamification` viennent de `supabase/portfolio-migrations/20261001101853` ; 1204 recopie ces corps (a recontroler si la base portfolio les a modifies depuis).

## 2. Tableau par phase : exigence -> statut + preuve

Legende : LIVRE = present dans le code et coherent ; PARTIEL = present avec ecart ou non prouve ; ABSENT. "Emul." = preuve capture emulateur (`UAT-RESULTS`).

### P13 Quetes en base
| Exigence | Statut | Preuve |
|---|---|---|
| QUEST-01 base + progression reelle | LIVRE (starters) | `202612011301/1302`, `GamificationPlugin.tsx` ; Emul. run2 Q-3 (1,4/2 L), Q-4 (+750 ml -> terminee, solde 430 -> 445). Reserve H1 pour les quetes IA |
| QUEST-02 starters identiques | LIVRE | Emul. Q-1 (2 jour + 1 semaine) ; harnais SQL 53 PASS (stub). Q-2, Q-5..11 NON-TESTE |

### P14 Outil IA de quetes
| Exigence | Statut | Preuve |
|---|---|---|
| QUEST-03 outil | LIVRE | `tools/quests.ts`, `registry.ts` ; Emul. QA-9..11 PASS (faux Anthropic) |
| QUEST-04 creation niveau / aucune quete | PARTIEL | `quests/service.ts:122`, `1401` ; QA-1..8 NON-TESTE ; M1 ; H1 |
| QUEST-05 max 3 | LIVRE | `1401` verrou ; Emul. QA-10 (3 actives -> aucune creation) |
| QUEST-06 pas de refus + duree | LIVRE | table SELECT seul, `rules.ts` DURATION_HOURS ; non vu a l'ecran |
| QUEST-07 echue visible hors des 3 | LIVRE (SQL) | `1402:90-100` ; rendu non vu |
| QUEST-08 personnalisation | PARTIEL | `loadIdentity` + filtre plugins ; pertinence non prouvee |

### P16 IA mesures & onboarding
| MEAS-02 onboarding | PARTIEL | `routes/onboarding.ts`, `ziko-chat.tsx` ; UAT run2 NON-TESTE |
|---|---|---|
| MEAS-03 outil | LIVRE | `tools/measurements.ts`, `measurements-goals.test.ts` (mock) |
| MEAS-07 4 cas | PARTIEL | stagnation/pace verifies, 2 motifs declaratifs (M7) |
| MEAS-08 prevenu avec raison | PARTIEL | `ziko_goal_revisions` + bandeau ; non vu |
| MEAS-09 objectifs -> quetes | LIVRE | `1602`, `measurements_goals` action `quest` ; H1 s'applique |

### P17 Sommeil
| SLP-01 saisie manuelle | LIVRE | Emul. run2 "Saisie manuelle" PASS (base `source=manual`, 8 h, 4/5) |
|---|---|---|
| SLP-02 etat vide | LIVRE | Emul. "Etat vide" PASS |
| SLP-03 phases si source | LIVRE (code) | colonnes `sleep_*_min`, texte honnete en Emul. ; pas de nuit connectee testee |
| SLP-04 source connectee prime | LIVRE (code) | `resolveNight`, `lib/sleep.test.ts` ; non emule |
| SLP-05 reglages | PARTIEL | `settingsToJson` ; reveil intelligent sans effet (B7) ; Emul. "Reglages" NON-TESTE |
| SLP-06 accueil = ecran | LIVRE (Sommeil + accueil) | Emul. "Accueil" PASS ; B7 pour stats/coach |

### P18 Stretching
| STRE-01 bibliotheque | LIVRE | Emul. FAIL puis PASS (grant), 24 exercices seed |
|---|---|---|
| STRE-02 exercices perso | LIVRE (creation) | `data.ts:37` ; B8 ; non emule |
| STRE-03 routines | PARTIEL | Emul. "Aucune routine / Creer" ; creation/lancement NON-TESTE |
| STRE-04 suivi | PARTIEL | Emul. compteurs 0 seulement |
| STRE-05 defaut | LIVRE (code) | `1802` index unique partiel, `saveRoutine` |
| STRE-06 auto en debut de seance | PARTIEL | M9 |

### P19 Complements
| SUPP-01 4 onglets | LIVRE | `screens/tabs/*` ; Emul. run1 PASS partiel |
|---|---|---|
| SUPP-02 recherche/filtres | LIVRE (code) | `lib/catalog.ts` ; Emul. run1 catalogue |
| SUPP-03 comparateur | PARTIEL | route reactivee, run2 FAIL (crash) puis correctif RUN2 non rejoue |
| SUPP-04 ajout stack dose/moment | PARTIEL | `1901`, `lib/data.ts` ; run2 BLOQUE (grants) |
| SUPP-05 stack editable | PARTIEL | idem ; Emul. "stack vide" PASS (run1) |
| SUPP-06 pas de NaN | LIVRE | `lib/pricing.ts:31-60` ; Emul. "des 21,00 EUR" |
| SUPP-07 rappels par moment | PARTIEL | `lib/reminders.ts`, `notifications.ts` ; non emule |

### P20 Timer
| TIMR-01 CRUD presets | PARTIEL | Emul. creation PASS ; edition/suppression NON-TESTE |
|---|---|---|
| TIMR-02 champs | LIVRE | `2001`, Emul. (nom, repos, series, duree totale) |
| TIMR-03 "Exemple" retire | PARTIEL | M11 |

### P21 Social
| SOC-01 ajout depuis recherche | LIVRE | RPC `ziko_send_friend_request` ; Emul. run1 envoi PASS |
|---|---|---|
| SOC-02 envoyee dans En attente | LIVRE | `ziko_list_friendships` ; Emul. PASS partiel |
| SOC-03 recues/envoyees | PARTIEL | acceptation simulee par UPDATE service_role (la voie RLS cote client non emulee) |
| SOC-04 suivre = ami | LIVRE (code) | RPC `relation` ; non emule |
| SOC-05 recherche directe | LIVRE (code) | non emule |
| SOC-06 profil public | LIVRE | Emul. "Profil complet" PASS ; M8 |
| SOC-07 sans coupure | LIVRE | Emul. PASS |
| SOC-08 sans echappement unicode | LIVRE | `noJsxUnicodeEscape.test.ts` |

### P22 Journal & Mon coach
| JRNL-01 enregistrement | PARTIEL | Emul. : ecran/echelles seulement, sauvegarde non prouvee |
|---|---|---|
| JRNL-02 Ionicons/couleur | LIVRE | `logic.ts` icones ; aucun emoji (grep) |
| COACH-01 profil coach lie | LIVRE | Emul. "UAT Coach - IDENTITE VERIFIEE - depuis le 12 nov." |
| COACH-02 header/retour/UI | PARTIEL | Emul. "PASS partiel", reste NON-TESTE |

### P23 Atelier IA
| ATEL-01 conversation | LIVRE (code) | `routes/workshop.ts`, `atelier.tsx` ; UAT NON-TESTE |
|---|---|---|
| ATEL-02 recherche web | LIVRE (code) | `workshop/webSearch.ts` ; M5 |
| ATEL-03 skills | LIVRE (code) | `workshop/skills.ts` |
| ATEL-04 contexte complet | LIVRE (code) | `workshop/context.ts` |
| ATEL-05 edition live | LIVRE (code) | PATCH sans credit + revision optimiste (`workshop.ts:96-120`) |
| ATEL-06 programme precis | PARTIEL | non prouve avec le vrai modele |
| ATEL-10 credits | LIVRE (code) | `creditCheck/Deduct('chat')` (`workshop.ts:166`), debit apres 1er octet ; reserve : web search hors credit |

### P24 Periodisation
| ATEL-07 suite ordonnee, un seul actif | LIVRE (code) | `2401` index unique sequence/position + actif unique P7 ; M6 |
|---|---|---|
| ATEL-08 suivant selon resultats | PARTIEL | `results.ts`, `previousResultsBlock` ; mock, UAT NON-TESTE |
| ATEL-09 relance auto | PARTIEL | `relaunch.ts` ; M4 ; seed "programme echu" jamais cree |

### P25 Mon coach complet
| MCOA-01 audit | LIVRE | `25-CONTEXT.md` |
|---|---|---|
| MCOA-02 pre-installe, non desinstallable | PARTIEL | garde UI + `2503` (SQL non execute) |
| MCOA-03 retrait confirme | PARTIEL | modale saisie `COACH`, `2501` garde (analyse : couvre toutes les colonnes ; non execute) |
| MCOA-04 programme prescrit + carte | PARTIEL | `PrescribedProgramCard.tsx`, hypothese `assigned_to_user_id`/`created_by_coach_id` non verifiee ; aucune UAT |

### P26 Factions & Ligues
| LEAG-01 factions | LIVRE (SQL stub) | `2601/2602`, UAT absente |
|---|---|---|
| LEAG-02 deux pistes etanches | LIVRE (SQL stub) | historique par piste |
| LEAG-03 transition IA + celebration | PARTIEL | M3 ; hallucination refusee par la base ; non emule |
| LEAG-04 garde-fous | PARTIEL | M2 (absence punie d'un palier) |
| LEAG-05 defi collectif coach | PARTIEL | RPC + route `POST /league/collective` ; AUCUN ecran coach web ; non emule |
| LEAG-06 lit athlete_state | LIVRE | `2603:30-60, 2604` |

## 3. Exigences orphelines et differees

- MEAS-10 / MEAS-11 : citees par le ROADMAP pour P16 selon `16-CONTEXT.md` (G-8), absentes de `REQUIREMENTS.md` (qui s'arrete a MEAS-09) ; P16 les a marquees N/A sans travail. A clarifier (ajouter ou retirer du ROADMAP). `REQUIREMENTS.md` annonce pourtant "134/134 mappees, 0 orphelin".
- ATEL-07/08/09 sont portes par P24 et ATEL-10 par P23 : la traceabilite est correcte, mais ATEL-10 n'est pas couvert pour les appels automatiques (volontairement absorbes) ; a documenter dans REQUIREMENTS.
- DSGN-01 (P4) conditionne P14/P16/P25/P26 qui n'ont pas de maquette (G-4 P16, UI-SPEC "criteres mesurables" sans HTML pour P25/P26).
- P26 a explicitement differe : classement entre joueurs (cohortes), saisons / battle pass, cosmetiques / loot / mascotte, defis collectifs entre amis (hors coach), ecran web de creation de defi par le coach, pastille de faction sur le profil public (P21), blocage / signalement, push de transition, retour Performance -> Habitudes, trace dans `athlete_decisions` (G-05), defis de groupe visibles quand la Ligue est verrouillee. Tout ceci est coherent avec le scope "tranche" mais LEAG-05 reste de fait inutilisable cote coach sans l'ecran.
- P25 a differe : section "Mon coach" dans les reglages (D-11) ; P16 : outil/ecran sans maquette ; P24 : aucun seed UAT.

## 4. Priorites de correction avant merge

1. H1 (fenetre de dates des quetes IA) et M1 (relais starters -> IA) : nouvelle migration + test SQL avec quete creee a 21 h.
2. M2 (absence = descente de palier) a corriger avant la mise en prod de la Ligue.
3. M4/M5 (plafonds de cout contournables en cas d'echec/concurrence) et M3 (rappel quotidien apres refus).
4. M6 (double enregistrement de brouillon), M7 (motifs declaratifs), M8 (profil public).
5. Run3 emulateur : quetes IA auto, atelier a 0 credit, relance seedee, retrait de coach, ligue, P19 apres le correctif RUN2.
