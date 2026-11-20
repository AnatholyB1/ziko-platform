# Phase 3 - Verification (UATN-01..03), re-run apres corrections

Detail, preuves et bugs : `03-UAT.md` (meme dossier, section "Re-run 2026-11-20"). Branche `uat/phase-3-rerun` (depuis `milestone/v1.21`, contient "Merge fix/uat-workout"). Emulateur Android `ziko-uat-1`, faux Anthropic, branche Supabase jetable `uat-v1-20`. Limites : Android et non iOS ; faux Anthropic (reponses scriptees) ; UI d'inscription et OTP non exerces.

| Exigence | Statut | Preuve (`uat-evidence/v121/...`, gitignore) |
|----------|--------|--------|
| UATN-01 compte neuf -> onboarding -> 1re conversation -> accueil | PASS. Rangees de la carte HORIZONTALES conformes a h01 (bug SEV 2 corrige). Ordre : carte, Mission du jour, Quetes, Forme du jour | `n01-fresh-account-home/` (`10-home-top`, `12-home-quests`, `13-home-forme`), flow `.maestro/v121-n01-fresh-account-home.yaml` (Passed 2 min 6) |
| UATN-02 quetes visibles et completables | PASS. 3 quetes, completion eau apres 2 L, ni pieces ni echouees ni "Voir tout". La Mission du jour DISPARAIT apres le log d'eau (SEV 4 corrige) | `n02-quests/` (`n02-06`, `n02-07-mission-after-water`, `n02-08-scrolled`), flow `v121-n02-quests.yaml` (Passed) |
| UATN-03 Manuel | PASS partiel. Creation -> programme actif automatiquement + toast "Programme actif" -> tableau avec "Demarrer la seance d'aujourd'hui" -> carte absente de l'accueil. 0 exercice : bloque (alerte). Demarrage avec exercices NON PROUVE sur ce chemin : le clavier de l'emulateur ne laisse passer que "S" du nom d'exercice, le demarrage affiche alors correctement "Seance indisponible" | `n03a-manual/` (`n03a-05` a `n03a-08`), `n03d-zero-exercise/`, flows `v121-n03a-manual.yaml` (Passed), `v121-n03d-zero-exercise.yaml` (Passed) |
| UATN-03 IA simple | PASS avec reserve. "Demarrer cette seance" ouvre `Seance IA` AVEC exercices puis la seance guidee (Exercice 1/1, Serie 1/3). Mais 1 seul exercice sur 4 generes est apparie au catalogue ("Squat goblet", "Developpe couche halteres", "Gainage planche" perdus sans avertissement visible) | `n03b-ai-simple/` (`n03b-03-generated`, `n03b-04-session-opened`, `n03b-05-session-started`), flow `v121-n03b-ai-simple.yaml` (Passed) |
| UATN-03 Atelier IA | PASS. Brouillon -> enregistrement -> activation -> accueil sans carte -> tableau -> apercu "Full body A, 2 exercices" -> seance demarree avec exercices (toast "Exercices remplaces : Squat par barbell full squat...") | `n03c-atelier/` (`n03c-06`, `n03c-08`, `n03c-09`), flow `v121-n03c-atelier.yaml` (Passed) |
| Credits epuises (FWKO-07) | PASS. Apres `v121-exhaust-credits.mjs` : pastille "0 credit", bandeau "Tes credits IA sont epuises. Le parcours manuel reste gratuit.", IA simple et Atelier IA "Credits epuises" (cadenas) avant ouverture, Manuel "Gratuit" et ouvre le builder (Etape 1/4) | `n03e-exhausted/` (`n03e-02-card-exhausted`, `n03e-03-manual-still-open`), flows `v121-n03e-prep.yaml` + `v121-n03e-exhausted.yaml` (Passed) |

## Bugs restants (aucun correctif applicatif dans ce run)
| SEV | Ecran | Observe | Attendu | Preuve |
|-----|-------|---------|---------|--------|
| 3 | Seance IA (apercu) | Le catalogue ne apparie pas "Squat goblet" (present : "goblet squat haltere"), "Developpe couche halteres", "Gainage planche" : la seance ne contient que 1 des 4 exercices generes ; 03-FIXES-WORKOUT l'avait signale comme "non prouve" | Appariement plus tolerant (ordre des mots, synonymes) et/ou avertissement des exercices ecartes | `n03b-ai-simple/.../n03b-03-generated.png` vs `n03b-04-session-opened.png` |
| 3 | program-builder etape 4 | Exercice saisi en texte libre : un nom absent du catalogue (ici "S") donne un programme actif impossible a demarrer ("Seance indisponible", message correct mais tardif) | Choix dans le catalogue ou avertissement a la saisie | `n03a-manual/.../n03a-08-after-start-tap.png` |
| 4 | Accueil avec programme actif | Ordre "Forme du jour", Mission du jour, Quetes ; etat compte neuf : carte, Mission, Quetes, Forme | Ordre coherent entre les deux etats | `n03c-atelier/.../n03c-06-home-card-gone.png` |

## Ecarts visuels vs maquettes
- Carte phase 2 (h01) : desormais conforme (rangees horizontales, icone 44 px a gauche, chevron a droite, cout vert, pastille de solde) ; badge "Conseille" present (voulu, absent de la maquette) ; pastille "5 credits" (maquette : 6).
- Fin d'onboarding : fond sombre vs maquette claire (non reverifie dans ce run, inchange).
- Quetes : pas de pieces au niveau 1 (decision D-05, maquette en retard).

## Limites et non prouve
- Android uniquement ; rendu iOS non prouve. Faux Anthropic : qualite des reponses du vrai Claude et couts reels non prouves. Inscription (UI) et OTP non exerces.
- Demarrage d'une seance avec exercices depuis un programme MANUEL non prouve (clavier d'emulateur, voir ci-dessus) ; couvert par le meme code via Atelier.
- "Bravo, tout est fait" (3/3 quetes) non teste.
- Emulateur 2 Go RAM en swap : saisie clavier peu fiable dans les champs controles du builder (n'est pas constate sur les autres champs).
