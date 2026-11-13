
# 17-sommeil-saisie-manuelle
## Run 7 (2026-11-13, branche uat/run7, compte athlete A)
| Id | Verdict | Preuve |
|---|---|---|
| SL-1 etat vide | PASS | `Aucune nuit enregistree`, `Logger ma nuit`, `Connecter une source` presents; 0 `8h00/score/profond/leger/REM` dans l'arbre (uat-evidence/run7/p17-empty.png) |
| SL-2 saisie 23:15->07:00, q4, 1 reveil | PASS | ecran `7 h 45`, `4 / 5`; accueil `7 h 45 · qualité 4 / 5`; base 1 ligne manual 7.75 |
| SL-2b re-saisie | PASS | message `Une nuit est déjà saisie pour cette date : elle sera modifiée.`, champs pre-remplis |
| SL-6 > 16 h | PASS | `Cette nuit dure 16 h 15. Vérifie le coucher et le lever (maximum 16 h).`, Enregistrer sans effet (base inchangee 7.75) (p17-16h.png); duree differente du plan (steppers 15 min) |
| SL-7 qualite obligatoire | PASS | Enregistrer sans qualite : 0 ligne creee |
| SL-3/4/5/8/9/11 | NON-TESTE | budget |

# 20-timer-presets-editables
## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| TI-1 CRUD | PASS | Onglet Seance : creer `UAT7` (5 series, 8 min), Dupliquer -> `UAT7 (copie)`, Modifier (6 series, base ok), Supprimer : message `Supprimer ce preset ? Cette action est définitive.`, Annuler = rien, Supprimer = ligne retiree. Intervalle et Tabata : creation OK en base (`hiit` 45/45/15/1/10, `tabata` 20/10/1/8) |
| TI-2 etats vides | PASS | `Aucun preset d'intervalle`, `Aucun preset Tabata` + bouton `Nouveau preset` |
| TI-3 editeur Intervalle | PASS | 6 champs (Echauffement, Effort, Repos, Series, Rounds, Repos entre rounds), pas 15 s; `Durée totale : 11 min` = formule (45 s + 10x60 s = 10,75 min) |
| TI-4 editeur Seance | PASS | seulement Repos + Series par round |
| TI-5 lancement | PASS | `EFFORT 00:36`, `Cotes 400 m · Round 1/10 · Série 1/1` apres echauffement (p20-run2.png); pause/arriere-plan non testes |
| TI-6/7 | NON-TESTE | |
Ecart mineur : le preset legacy `Cotes` (type `custom`) est range sous l'onglet Seance.

# 11-hydratation-boutons-reglages
## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| HY-1 +250/+500/+750 + verrou | PASS | 1 ligne par appui; 3 appuis a 100 ms = 1 seule ligne (verrou ok) |
| HY-2 dimension des tuiles | **FAIL** | bounds uiautomator : 250 = [42,1287][229,1558] (187 px), 500 = 130 px, 750 = 130 px, hauteur 271 px (~103 dp, attendu 132 dp +-4) ; les tuiles ne s'etirent pas (flex:1 sans effet), pas de fond/bord de carte visibles, rangee collee a gauche, moitie droite vide (uat-evidence/run7/p11-tiles.png). Cause probable : `plugins/hydration/src/screens/HydrationPlugin.tsx:511-535` : `Pressable` avec `style` fonction/tableau (interop NativeWind v4) |
| HY-7 cafe 250 a 50 % | PASS | ligne 125 ml |
| HY-4 reglage taille de verre | PASS | 250 -> 300 ml; `ziko_hydration_settings.glass_ml=300` (1 ligne) |
| HY-8 bonus seance | PASS (indirect) | objectif `2,0 L + 0,5 L les jours de séance`, carte `/ 2.5L` |
| HY-3/5/6/9 | NON-TESTE | |
Ecart : jauge `12.1L / 2.5L` (point) vs reglages `2,0 L` (virgule).

# 15-mesures-objectifs-base
## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| ME-2/ME-3 creation objectif + % | PASS | `Définir le suivant` : Poids 70,5 -> 68 : `Objectif de baisse : 2,5 kg à perdre.`; carte `0 %`, `EN COURS`, `70,5 kg vers 68,0 kg` (p15-created.png) |
| ME-5 verrou D-04 | PASS | feuille `Objectif en cours`, `Tu ne peux pas modifier cet objectif tant qu'il n'est pas atteint. Il te reste 2,5 kg.`, `Compris`; pas de bouton Modifier |
| ME-6 atteint | PASS | carte `ATTEINT`, `100 %` (p15-achieved.png) |
| ME-7 cible = depart | PASS | `La cible doit être différente du point de départ.` |
| Defaut libelle | FAIL mineur | `Objectif atteint le 13 nov.. Bravo.` et `Ta dernière mesure, le 13 nov.. Tu peux la corriger.` : double point |
| ME-1/4/8-11 | NON-TESTE | |

# 22-journal-mon-coach
## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| JR-4 Quick Log -> Journal `Général` | PASS | bandeau `Humeur déjà notée aujourd'hui depuis l'accueil : Bof. Ton enregistrement la met à jour.`, bouton `Mettre à jour`, base : 1 seule ligne `general`, mood mis a jour |
| JR-6 session expiree | NON-TESTE | `POST /auth/v1/logout?scope=global` revoque le refresh token mais PostgREST accepte encore le JWT (~1 h) : l'ecriture Journal reussit, aucun bandeau. Simulation insuffisante : attendre l'expiration du JWT ou reduire `jwt_exp` sur la branche |
| Constat lie | FAIL | apres ce logout global, le backend repond 401 (`/coach/clients/links/me`) et Mon coach affiche `Impossible de charger / Vérifie ta connexion, puis réessaie.` : un 401 est presente comme un probleme reseau, ni bandeau `Session expirée` ni redirection login (p22-coach.png) |
| CO-1 Mon coach lie | PASS | `UAT Coach`, `Ton coach Ziko`, `IDENTITÉ VÉRIFIÉE`, `Ton coach depuis le 13 nov. 2026`, 2 stats, bloc programme (p22-coach2.png) |
| CO-5 coupure reseau | NON-TESTE | donnees en cache affichees |
| JR-1/2/3/5/7/8, CO-1b..4 | NON-TESTE | |

# 06-seance-entrainement-fiable
## Run 7 (2026-11-13) : verification FIX-UAT-RUN6
| Critere | Verdict | Preuve |
|---|---|---|
| `Sauvegarder & fermer` | PASS | seance rapide (1 serie) -> Terminer -> resume -> `Sauvegarder & fermer` atterrit sur l'onglet Entrainement, pas d'Unmatched Route (p6-after.png) |
| Accueil rafraichi sans relance | PASS | tuile Charge `2/4` -> `4/4 séances` apres retour; ecart : +2 pour une seule seance et incoherence avec `2 séances sur 4 prévues` (onglet Entrainement) |
| Resume | PASS partiel | `Temps fort`, `1 série complétée` OK; reste `1 séries · meilleure : —` (pluriel) et `0 kg` de volume pour 12x60 kg |
| Cold start avion != Bienvenue | PASS | accueil affiche, pas d'onboarding. Ecart : au meme demarrage `Communauté se débloque au niveau 3. Tu es niveau 1.` alors que le niveau en base est 3 |
| Defi collectif 1 participant | PASS | `Total masqué (moins de 3 participants)`, `1 participant`, `Ma contribution : 4000`, pas de barre (p26-collective.png) |

# 09-ajout-repas-un-ecran
## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| U1 1 tap + <= 4 taps | PASS | tuile Repas -> ecran unique (1 tap); champ recherche, `poulet`, resultat, `Ajouter 1 aliment` = 4 taps au total; retour accueil; base : `Poulet rôti` snack 190 kcal; recap `490 -> 680 / 2000 kcal` |
| U12 code-barres introuvable | BLOQUE | camera virtuelle de l'emulateur : le segment Code n'offre que `Alignez le code-barres pour scanner` (pas de saisie manuelle), aucun code injectable ; permission camera ok (p9-barcode.png) |
| U15 photo | NON-TESTE | route vision = faux Anthropic (sortie structuree a scripter) ; budget |

# 10-pantry-utile-francais
## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| S12 groupe `Il manque dans ton frigo` | PASS | `Yaourt grec` + raison `Expiré` |
| S14 ranger 2 articles | PASS partiel | cocher `Yaourt grec` (perime) + `Pates` (manuel) -> `Ranger 2 articles dans le garde-manger` -> message `2 articles rangés dans le garde-manger`; base : Yaourt grec qte 1, `expiration_date` null (ok), `Pates` cree en stock (pantry, qte 1) |
| Defaut | FAIL | `Pates` ranges reapparaissent aussitot dans la liste (`Stock bas`) : l'article manuel est cree avec `low_stock_threshold = 1.00` = quantite (1), donc stock bas immediat (boucle courses -> ranger -> courses). A verifier : seuil par defaut a la creation depuis une ligne de courses (p10-ranger.png) |
| S7 scan introuvable | BLOQUE | meme limite camera virtuelle que U12 |
| Constat base | A SIGNALER | `service_role` recoit `permission denied for table ziko_shopping_list_items` (GRANT manquant sur la branche de test ; sans effet sur l'app authentifiee) |

# 06-seance-entrainement-fiable
## Run 7 (suite) : Flows B / D / E
| Flow | Verdict | Preuve |
|---|---|---|
| B bouton `Démarrer la séance d'aujourd'hui · Séance` | PASS partiel | present en bas de la page programme avant effacement des donnees locales ; la seance ouverte s'appelle `Séance rapide` (nom du bouton `Séance` != titre de la seance ouverte) |
| Entrainement vs Programmes | FAIL | apres reconnexion (effacement des donnees de l'app) l'onglet Entrainement affiche `Aucun programme actif` alors que `ziko_workout_programs.is_active=true` et que la liste `Programmes` montre `Force 5x5, bloc 2` `ACTIF` (`start_date` null). Avant l'effacement le meme ecran montrait le programme (etat local persiste) : l'onglet ne relit pas la base |
| D semaine type | NON-TESTE / BLOQUE | le programme coach `Force 5x5, bloc 2` ouvre le constructeur avec `0 jours / semaine` (aucun jour en base) ; il faut activer `UAT Full Body 3x8` pour tester (p6-prog.png) |
| E detail depuis Recent | NON-TESTE | budget |

# 16-ia-mesures-onboarding
## Run 7 (2026-11-13)
IM-1..3, IM-8..12, IM-14 : NON-TESTE (arret par budget de contexte; prochaine etape dans UAT-RUN7-RESUME.md)

# 26-factions-ligues
## Run 7 (2026-11-13)
Defi collectif 1 participant : PASS (voir phase 6, `Total masqué (moins de 3 participants)`). LG-1..16, LG-23..25 : NON-TESTE (arret par budget de contexte).

# 24-periodisation-relance
## Run 7 (2026-11-13)
B..F : NON-TESTE (budget)

# 23-atelier-ia-programme
## Run 7 (2026-11-13)
Feuille d'epuisement (solde 0 + quota 0) et quete creee a 21 h : NON-TESTE (budget)
