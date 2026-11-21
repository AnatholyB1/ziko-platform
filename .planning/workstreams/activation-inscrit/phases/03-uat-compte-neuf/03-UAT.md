# Phase 3 - UAT compte neuf (v1.21, workstream activation-inscrit)

Branche `uat/phase-3` (depuis `milestone/v1.21`). Cible : emulateur Android `ziko-uat-1`, dev-client + Metro 8281, backend local 8200, faux Anthropic 8211, faux Upstash 8210, base Supabase jetable `uat-v1-20` (migration welcome-quests deja appliquee). Production non touchee. Compte : `uat-fresh@uat.ziko.test`, recree par `scripts/uat/v121-reset-run.sh` avant chaque run.
Preuves (gitignorees, locales a ce worktree) : `uat-evidence/v121/<flow>/` (PNG Maestro dans `maestro-shots/*/takeScreenshot/`, `maestro.log`, `logcat.txt`, `maestro-result.xml`, `RESULT.txt`). Flows commites : `.maestro/v121-*.yaml`, `.maestro/scripts/v121-queue-*.js`.

## Limites (honnetes)
- Android, pas iOS : le JS et le backend sont les memes que TestFlight, le rendu natif iOS n'est pas prouve. Les deficits de mise en page ci-dessous (FirstWorkoutCard) peuvent etre propres au rendu Android ou communs : a confirmer sur iOS.
- Faux Anthropic : ni la qualite des reponses du vrai Claude, ni les couts reels ne sont prouves. Les reponses (`Reponse simulee du coach IA...`, mission, brouillon atelier, seance IA) sont scriptees.
- Inscription (UI sign-up) et OTP de verification email NON exerces : le compte est cree par `create-fresh-athlete.mjs` (email confirme). Le parcours part de l'ecran de connexion.
- Emulateur lent (clavier : perte de caracteres, plantages SystemUI, adb qui retombe) : 3 relances d'infrastructure, voir "Incidents de harnais".

## UATN-01 : compte neuf -> login -> onboarding -> 1re conversation -> 1re mission -> accueil : PASS (avec ecarts visuels)
Flow : `.maestro/v121-n01-fresh-account-home.yaml` (2 min 29, Passed). Preuves : `uat-evidence/v121/n01-fresh-account-home/` (captures 05 a 13, `ui-order.txt`).
Verifie par assertions Maestro + dump uiautomator :
- 7 etapes d'onboarding (sous-flow `v121-common-onboarding.yaml`, remplace `tf-common-onboarding-steps.yaml` dont le dernier bouton "C'est parti, demarrer ma journee" n'existe plus).
- Fin d'onboarding (step-7, `05-step7-end.png`) : "C'est note." / "LA SUITE" / "Une courte discussion avec Ziko" / bouton "Continuer" ; assertNotVisible OK sur "Ton programme", "Premiere seance demain matin", "Ton plan est pret", "Push Pull Legs", "Construction de ton programme" (CLAR-02 OK).
- 1re conversation : reponse du faux au 1er tour, carte "TA PREMIERE MISSION" au 2e (`06`, `07`), CTA -> ecran notifications "Plus tard" -> Hydratation (`08`), jamais renvoye a l'accueil (CLAR-04 OK).
- Accueil : ordre vertical mesure uiautomator (`ui-order.txt`) : carte "Cree ton premier entrainement" y=0..667 < "MISSION DU JOUR" y=745 < "QUETES DU JOUR" y=1136 < "FORME DU JOUR" y=2067 (FWKO-01, FWKO-06 cohabitation, QNEW). Absents : "Voir tout", "Tout voir", "echou/expir/manqu", "pieces".
- Carte : 3 chemins Manuel (Programme, Gratuit) / IA simple (Seance, badge "Conseille", "1 gratuite aujourd'hui") / Atelier IA (Programme, "1 message gratuit aujourd'hui"), pastille "5 crédits".

## UATN-02 : quetes visibles et completables : PASS
Flow : `.maestro/v121-n02-quests.yaml` (2 min 46, Passed). Preuves : `uat-evidence/v121/n02-quests/` (`n02-01` a `n02-06`).
- Bloc "QUETES DU JOUR / 3 en cours" : Bois 2 litres d'eau (0 / 2 L, bouton Boire), Ajoute un repas (Ajouter), Termine une seance (Seance) avec progression et action.
- CTA : Ajouter -> "Ajouter un repas" (Nutrition) ; Seance -> onglet Entrainement ; Boire -> Hydratation ; aucun renvoi a l'accueil au niveau 1 (assertNotVisible "Quetes du jour" sur chaque ecran cible).
- Completion sans relance : +750, +750, +500 ml dans Hydratation, retour par l'onglet Accueil : la ligne eau passe en "Termine" (fond vert, coche), en-tete "2 en cours" (`n02-06`). Aucune piece affichee au niveau 1 ("Termine" seul), aucune quete echouee/expiree (regex).
- Hors perimetre du flow : "Bravo, tout est fait" (3/3) non teste ; le toast de completion n'a pas ete capture.
- Observation : la base contient 4 quetes `active` pour le compte (eau, repas, seance + hebdo `starter_weekly_train`) ; l'UI en affiche 3. Le critere A1 du contrat ("count(status='active') <= 3") serait faux en base ; decision "hebdo conservee" deja actee en phase 1.
- Observation : apres 2 L bus, la carte Mission du jour ("Bois un premier verre d'eau") ne change pas.

## UATN-03 : 3 chemins -> seance lancee ou programme demarrable : FAIL (Manuel, IA simple) / PARTIEL (Atelier)
### Manuel : FAIL
Flow `.maestro/v121-n03a-manual.yaml` (echoue volontairement sur l'assertion "la carte disparait"). Preuves : `uat-evidence/v121/n03a-manual/` (+ captures `n03a-x1`, `n03a-after-create-explore.png`, `n03a-typing-test*.png`).
- Les 4 etapes `program-builder` fonctionnent (Etape 1/4..4/4, Force, 8 semaines, 7 jours, exercice).
- "Creer mon programme" : AUCUN retour visuel, l'ecran reste sur l'etape 4 (6 s apres). La ligne est creee dans `ziko_ai_generated_programs` avec `is_active=false`. La carte "Cree ton premier entrainement" reste sur l'accueil, l'onglet Entrainement reste sur l'assistant (pile). Aucun chemin vers une seance demarree sans activer le programme a la main depuis "Mes programmes" (non verifie pour Manuel).
- Aussi : un programme avec 0 exercice est cree sans avertissement (lignes `exercises: []`, run 1).
### IA simple : FAIL
Flow `.maestro/v121-n03b-ai-simple.yaml` (Passed : les assertions ne couvrent que jusqu'au tap). Preuves : `uat-evidence/v121/n03b-ai-simple/` (`n03b-03-generated`, `n03b-05-session-settled.png`).
- Wizard 4 etapes OK, faux empile par `v121-queue-session.js`, ecran "Ta seance generee" avec 4 exercices (Squat goblet...) et "Demarrer cette seance".
- Le tap ouvre `/workout/session` SANS les exercices : titre "Seance rapide 00:00", "Ajoute ton premier exercice" (`n03b-05-session-settled.png`). La seance generee est abandonnee. Cause lue dans le code : `ai-generate.tsx` l.390 `router.push('/(app)/workout/session')` sans passer ni stocker `generatedSession` (aucune ecriture dans le store).
### Atelier IA : PARTIEL
Flow `.maestro/v121-n03c-atelier.yaml` (5 min 41, atteint l'onglet Entrainement). Preuves : `uat-evidence/v121/n03c-atelier/` (captures 01 a 07). Le faux Anthropic produit un brouillon via l'outil `workshop_set_draft` (extension de `scripts/uat/fake-script.sh atelier` et `.maestro/scripts/v121-queue-atelier.js`).
- Prouve : carte -> Atelier IA -> message (chip) -> brouillon "BROUILLON / Programme UAT Atelier" -> "Enregistrer le programme" -> "Definir comme programme actif" -> la carte disparait de l'accueil (assertions `notVisible` et `assertNotVisible` OK ; la capture `n03c-06` est prise pendant le fondu et montre encore la carte) -> la liste Programmes montre le programme "ACTIF" (`n03c-07`).
- NON prouve : demarrage d'une seance depuis ce programme. Apres l'activation, l'onglet Entrainement affiche encore la liste "Programmes" (pile imbriquee conservee), pas le tableau avec "Demarrer la seance d'aujourd'hui" ; le flow s'arrete la.
### FWKO-06 (disparition de la carte)
- Atelier (programme actif) : OK. Manuel : KO (programme inactif). IA simple : non testable (aucune seance terminee possible, seance vide).
### Credits epuises : NON PROUVE
`scripts/uat/v121-exhaust-credits.mjs` (solde 0 + quota chat du jour consomme) est ecrit mais n'a PAS ete execute avec un flow : le contexte de l'agent etait epuise. L'etat "Credits epuises" de la carte (FWKO-07) n'est donc pas verifie sur emulateur.

## Bugs
| SEV | Ecran | Observe | Attendu | Preuve |
|-----|-------|---------|---------|--------|
| 2 | Accueil, carte "Cree ton premier entrainement" | Les 3 rangees s'empilent en colonne (icone, titre, phrase, cout, chevron l'un sous l'autre), sans padding : icone collee au bord gauche de la carte, chevron sous le texte. Le style `Pressable` de `PathRow` est une fonction (`({pressed}) => ({...})`) : il semble ignore au rendu Android | Rangee horizontale : icone 44x44 a gauche, texte au centre, chevron a droite, padding 14/16 (maquette h01) | `n01-.../10-home-top.png` |
| 2 | Atelier -> IA simple -> "Demarrer cette seance" | Seance rapide VIDE, les exercices generes sont perdus | La seance demarre avec les 4 exercices generes | `n03b-ai-simple/n03b-05-session-settled.png` |
| 2 | program-builder, "Creer mon programme" | Aucun retour, ecran inchange ; programme insere `is_active=false` ; la carte reste sur l'accueil | Confirmation + programme actif ou proposition de l'activer + retour/redirection ; la carte disparait (FWKO-06) | `n03a-manual/n03a-after-create-explore.png`, ligne DB `is_active=false` |
| 3 | program-builder etape 4 | Creation possible avec 0 exercice (seances vides) | Avertissement ou blocage | peek DB `exercises: []` |
| 3 | Onglet Entrainement apres creation/activation | L'onglet garde l'ecran du dessus (assistant ou liste Programmes), tap sur l'onglet ne revient pas au tableau | Tap sur l'onglet affiche le tableau avec la seance du jour | `n03a-x1-training-tab.png`, `n03c-07-training-tab.png` |
| 4 | Accueil, Mission du jour | Reste "Bois un premier verre d'eau / C'est parti" apres 2 L logues | Mission marquee faite ou remplacee | `n02-06-water-quest-done.png` |

## Ecarts visuels vs maquettes (design contracts phases 1 et 2)
1. Carte phase 2 (h01) : mise en page des rangees cassee (voir bug SEV 2). Ni marges ni alignement horizontal comme la maquette ; titre, pastilles "Programme"/"Seance", cout (vert "Gratuit" / "1 gratuite aujourd'hui") et pastille de solde conformes en contenu.
2. Badge "Conseille" present sur IA simple (absent de la maquette h01, voulu par la phase 2) ; pastille de solde "5 credits" (maquette : 6).
3. Fin d'onboarding (maquette o03 variante B) : contenu identique mot pour mot, mais fond SOMBRE dans l'app (`05-step7-end.png`) alors que la maquette est claire (contrat 5 : "thème clair uniquement", question Q3 ouverte). La carte "La suite" est sombre aussi.
4. Quetes (maquette `with-trois`) : meme structure (surtitre "QUETES DU JOUR", "3 en cours", 3 lignes icone/titre/action/barre/bouton "Boire/Ajouter/Seance"). Differences : pas de pieces (15/15/25) dans l'app au niveau 1, la maquette les affiche (le brief et le contrat D-05 les cachent : la maquette est en retard sur la decision) ; icone/chevron des boutons un peu plus gros ; "0 / 2 L" aligne a droite de la barre comme la maquette.
5. Mission du jour : fond marron/noir avec cercle decoratif, comme l'existant ; "Forme du jour" apres les Quetes comme prevu.
6. Pas de "Voir tout", pas de pieces au niveau 1, pas de quete echouee : conformes.

## Incidents de harnais (corriges)
- Emulateur herite d'une session precedente : processus qemu fige (adb 16 s par commande) ; arret/relance par `emu-stop.ps1` + `emu-start.sh`.
- Metro : `google-services.json` (gitignore) manquant dans ce worktree ("Could not parse Expo config") ; copie locale depuis un worktree frere (non commite). Premier bundle 2 min 23.
- `adb reverse tcp:8200` perdu quand adb a redemarre : ajoute a `v121-reset-run.sh`.
- Flows : regex sur titres avec point final ("C.est note.*"), `back` ramenait a Hydratation (pile), perte de caracteres du clavier.
- Nouveaux outils : `scripts/uat/v121-reset-run.sh`, `ui-find.mjs` (bounds uiautomator), `v121-peek.mjs` (lecture service role), `v121-exhaust-credits.mjs`, `fake-script.sh atelier`.


---

# Re-run 2026-11-20 (branche `uat/phase-3-rerun`, apres corrections `fix/uat-home` et `fix/uat-workout`)

Verdicts a jour (remplacent ceux de la premiere passe ci-dessus) ; synthese dans `03-VERIFICATION.md`. Preuves : `uat-evidence/v121/<flow>/` (gitignore).

| Exigence | Verdict | Notes |
|----------|---------|-------|
| UATN-01 | PASS | Rangees de la carte horizontales (`n01.../10-home-top.png`) : icone 44 px a gauche, titre + pastilles, phrase, cout vert, chevron a droite, separateurs 1 px. Ordre carte > Mission du jour > Quetes > Forme du jour confirme. Bug SEV 2 resolu. |
| UATN-02 | PASS | 3 quetes, completion de l'eau, aucune piece/echec/"Voir tout". Apres 2 L, la Mission "Bois un premier verre d'eau" a disparu (`n02-07`, `n02-08`) : bug SEV 4 resolu. |
| UATN-03 Manuel | PASS partiel | Creation -> actif + toast "Programme actif : Force..." -> tableau "Demarrer la seance d'aujourd'hui" -> carte absente de l'accueil. 0 exercice : alerte "Ajoute au moins un exercice" (`n03d`). Demarrage avec exercices non prouve (saisie clavier, voir Incidents). |
| UATN-03 IA simple | PASS (reserve catalogue) | Ouvre `Seance IA` avec exercices, seance guidee demarree (`n03b-05`). 1/4 exercices apparie. |
| UATN-03 Atelier | PASS | Seance demarree avec exercices (apercu "Full body A, 2 exercices", `n03c-08`/`n03c-09`), carte disparue (`n03c-06`). |
| Credits epuises | PASS | `n03e-02-card-exhausted.png`. |

Bugs initiaux : les 6 bugs de la premiere passe sont resolus sur Android (SEV 2 mise en page, SEV 2 IA simple vide, SEV 2 Manuel sans retour/inactif, SEV 3 0 exercice, SEV 3 onglet Entrainement, SEV 4 Mission). Restants : voir `03-VERIFICATION.md` (SEV 3 appariement catalogue IA, SEV 3 exercice texte libre, SEV 4 ordre de l'accueil).

## Incidents de harnais (re-run)
- Premier bundle Metro apres `--clear` : environ 80 s une fois la requete declenchee ; le dev-client a expire (IOException) la 1re fois : rouvrir apres "Android Bundled".
- Flows corriges : `scrollUntilVisible` s'arretait sur l'en-tete "Quetes du jour" sans montrer les lignes (carte horizontale plus courte) -> ajout d'un scroll vers "Termine une seance" (n01, n02). n03b/n03c : l'ouverture passe par l'apercu "APERCU DU PROGRAMME" puis "Demarrer la seance". n03a : fin adaptee a l'alerte "Seance indisponible".
- Saisie du nom d'exercice (program-builder) : l'emulateur (2 Go, swap) ne conserve que le 1er caractere, y compris par touches adb espacees de 1,5 s ; `retry` + `assertVisible "Squat"` donnait un faux positif (le mot de la barre de suggestions Gboard). Non resolu ; n'affecte pas les autres champs (login, chat).
- Nouveaux flows : `v121-n03d-zero-exercise.yaml`, `v121-n03e-prep.yaml`, `v121-n03e-exhausted.yaml`.
- `uat-evidence/runflow.sh` (local, non commite) : reset + Maestro + preuves par flow.


---

# Rejeu 2 - 2026-11-21 (branche `uat/phase-3-replay2`, apres `fix/uat-remaining`)

Verdicts a jour (remplacent ceux du re-run) ; synthese dans `03-VERIFICATION.md`. Preuves : `uat-evidence/v121/<flow>/` (gitignore).

| Exigence | Verdict | Notes |
|----------|---------|-------|
| UATN-01 | PASS | Ordre carte, Mission du jour, Quetes, Forme du jour ; identique avec programme actif apres creation Manuel (`n03a-manual/home-active-top.png`). |
| UATN-02 | PASS | 3 quetes, eau terminee apres 2 L, Mission disparue ensuite, ni pieces/echec/"Voir tout" (`n02-after-top.png`, `n02-after-mid.png`). |
| UATN-03 Manuel | PASS | Saisie complete au clavier, suggestion catalogue, creation auto-activee, apercu de seance avec "Squat complet barre" (`n03a-08`). Texte inconnu : erreur inline + bouton desactive (`n03d-unknown-*`). 0 exercice : alerte. |
| UATN-03 IA simple | PASS | 4 exercices sur 4 resolus (goblet squat haltere, developpe couche halteres, rowing unilateral machine, planche complete) + toast "Exercices remplaces" (`n03b-04`). |
| UATN-03 Atelier | PASS | Regression OK. |
| Credits epuises | PASS | Regression OK. |
| Bravo, tout est fait | PASS (reserve) | 3/3 atteint, repas et seance inseres par `v121-complete-quests.mjs` (`n02b-03-bravo`). |

## Incidents de harnais (rejeu 2)
- Premier bundle Metro (cache vide) 115 s ; le dev-client a expire (IOException + ANR SystemUI : "Wait" via tap) puis rouvert apres "Android Bundled".
- `google-services.json` copie localement depuis un worktree frere (gitignore).
- Une JVM Maestro s'est figee (run n03a) ; arretee par PID, flow relance (Passed). Flows modifies : `v121-n03a-manual.yaml` (`hideKeyboard` avant "Creer mon programme", clavier masquant le bouton), `v121-n03e-exhausted.yaml` (ecran notifications "Plus tard" optionnel), `v121-n03d-zero-exercise.yaml` (cas texte inconnu). Nouveaux : `v121-n02b-part1.yaml`, `v121-n02b-part2.yaml`, `scripts/uat/v121-complete-quests.mjs`.
- Le clavier garde desormais tout le texte saisi ("Squat") : le remontage par frappe est corrige.
