# Phase 3 - Verification (UATN-01..03), rejeu 2 apres `fix/uat-remaining`

Detail et preuves : `03-UAT.md` (section "Rejeu 2 - 2026-11-21"). Branche `uat/phase-3-replay2` (depuis `milestone/v1.21`, contient "Merge fix/uat-remaining"). Emulateur Android `ziko-uat-1`, faux Anthropic, branche Supabase jetable `uat-v1-20`, reset du compte avant chaque flow. Limites : Android et non iOS ; faux Anthropic (reponses scriptees) ; UI d'inscription et OTP non exerces.

| Exigence | Statut | Preuve (`uat-evidence/v121/...`, gitignore) |
|----------|--------|--------|
| UATN-01 compte neuf -> onboarding -> 1re conversation -> accueil | PASS. Ordre fixe observe : carte, Mission du jour, Quetes, Forme du jour (defilement ordonne + captures). Meme ordre sans carte, avec programme actif (Mission = seance du jour, puis Quetes, puis Forme) | `n01-fresh-account-home/` (`10-home-top`..`13-home-forme`), `n03a-manual/home-active-top.png`, `home-active-mid.png` ; flow `v121-n01-fresh-account-home.yaml` (Passed 2 min 17) |
| UATN-02 quetes | PASS. 3 quetes, CTA, eau terminee apres 2 L (sans relance), ni pieces ni echouees ni "Voir tout" ; la Mission du jour disparait apres le log d'eau (ordre carte, Quetes, Forme). "Bravo, tout est fait" ATTEINT (voir bonus) | `n02-quests/` (`n02-06`, `n02-after-top.png`, `n02-after-mid.png`), flow `v121-n02-quests.yaml` (Passed 2 min 49) |
| UATN-03 Manuel | PASS. Le clavier conserve "Squat" en entier (plus de perte apres 1 caractere) ; suggestion catalogue `exercise-suggestion-0` -> "squat complet barre" ; creation -> programme actif, carte disparue, "Demarrer la seance d'aujourd'hui" -> apercu "Seance 6 / 1 exercice / Squat complet barre" avec "Demarrer la seance" (seance AVEC exercice : prouve). Texte inconnu "zzqxv" : erreur inline "n'est pas dans le catalogue", "Creer mon programme" desactive. 0 exercice : alerte "Ajoute au moins un exercice" | `n03a-manual/` (`n03a-04-step4`, `n03a-06-home-card-gone`, `n03a-08-after-start-tap`), `n03d-zero-exercise/` (`n03d-zero-exercise-blocked`, `n03d-unknown-text`, `n03d-unknown-blocked`), flows `v121-n03a-manual.yaml` (Passed 3 min 11), `v121-n03d-zero-exercise.yaml` (Passed) |
| UATN-03 IA simple | PASS. La seance contient les 4 exercices generes : Goblet squat haltere, Developpe couche halteres, Rowing unilateral machine, Planche complete ; toast "Exercices remplaces : Squat goblet par dumbbell goblet squat, Rowing unilater..." (aucun exercice ignore) | `n03b-ai-simple/` (`n03b-04-session-opened`, `n03b-05-session-started`), flow `v121-n03b-ai-simple.yaml` (Passed 2 min 51) |
| UATN-03 Atelier IA | PASS (regression) | `n03c-atelier/`, flow `v121-n03c-atelier.yaml` (Passed 2 min 35) |
| Credits epuises (FWKO-07) | PASS (regression) : "Credits epuises" sur les lignes IA, Manuel "Gratuit" et ouvre le builder | `n03e-exhausted/` (`n03e-02-card-exhausted`, `n03e-03-manual-still-open`), flows `v121-n03e-prep.yaml` + `v121-n03e-exhausted.yaml` (Passed) |
| Bonus "Bravo, tout est fait" | PASS avec reserve : etat "QUETES DU JOUR / 3 sur 3 / Bravo, tout est fait / De nouvelles quetes arrivent bientot." obtenu. Eau 2 L logguee par l'UI ; repas et seance INSERES par `scripts/uat/v121-complete-quests.mjs` (service role), pas par l'UI | `n02b-part2/` (`n02b-03-bravo`), flows `v121-n02b-part1.yaml`, `v121-n02b-part2.yaml` |

## Bugs restants (aucun correctif applicatif dans ce run)
Aucun SEV 1-3. Observations de severite basse :
| SEV | Ecran | Observe | Attendu | Preuve |
|-----|-------|---------|---------|--------|
| 4 | Seance IA (apercu) | "Gainage planche 3 x 40 s" s'affiche "Planche complete - 3 series - 40 rep." : une duree est presentee comme des repetitions ; le toast resume ne montre que les 2 premiers remplacements (texte tronque) | "40 s" ; liste des remplacements lisible | `n03b-ai-simple/.../n03b-04-session-opened.png` |
| 4 | program-builder etape 4 | Clavier ouvert : le bouton "Creer mon programme" est masque derriere le clavier tant qu'on ne le ferme pas | Bouton accessible (scroll ou clavier ferme au choix d'une suggestion) | `n03a-manual/.../step-083-tapOnElement-Creer_mon_programme.png` (run 1) |
| 4 | Accueil apres seance terminee | Mission du jour affiche "Aucun programme actif / Creer un programme IA" alors que la carte "Cree ton premier entrainement" a disparu (seance inseree sans programme) | A confirmer sur parcours reel : carte ou CTA coherent | `n02b-part2/.../n02b-03-bravo.png` |
| 4 | Logs backend | `triggerRetroactiveRecompute: non-2xx response 500` apparu dans le log Metro apres ouverture de l'app (non investigue, sans effet visible sur les quetes) | 2xx | `uat-evidence/metro/metro.log` |

## Ecarts visuels vs maquettes
Inchanges par rapport au rejeu 1 : carte conforme (rangees horizontales), badge "Conseille" voulu, pastille "5 credits" (maquette 6), fin d'onboarding sombre vs maquette claire (non reverifie), pas de pieces au niveau 1 (decision D-05).

## Limites et non prouve
- Android uniquement ; rendu iOS non prouve. Faux Anthropic : qualite des reponses du vrai Claude et couts reels non prouves. Inscription (UI) et OTP non exerces.
- Appariement catalogue verifie sur le catalogue de la branche jetable, pas sur la production.
- "Bravo, tout est fait" : repas et seance inseres par le harnais, completion UI de ces deux quetes (ajout d'un repas, fin d'une vraie seance) non rejouee.
- Demarrage de la seance (bouton "Demarrer la seance") jusqu'a la fin d'une seance reelle non rejoue sur le chemin Manuel ; l'apercu avec l'exercice du catalogue est prouve.
- Emulateur 2 Go : lenteur ; une defaillance Maestro (JVM figee) a ete relancee a la main.


## SEV4 verification
Voir `03-UAT.md`, section "SEV4 verification - 2026-11-21" : controles 1 a 5 PASS sur Android (apercu 40 s + chrono, toast complet, builder clavier ouvert, retroactive 200 sans 5xx, regression n01/n02/n03b/n03e-exhausted). Aucun nouveau bug ; 1 observation SEV 4 (toast en anglais vs apercu en francais).
