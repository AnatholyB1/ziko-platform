# UAT-RESULTS P6 (run2, 2026-11-13) - cumul run1 (A PASS, C PASS)

| Id | Verdict | Detail |
|---|---|---|
| B, D, E, F | NON-TESTE | contexte epuise avant les flows seance. |
| Obs. | | Apres activation du programme coach (voir P7) la carte "Mission du jour" de l'accueil disparait (jour non planifie ?) : a verifier. Noms d'exercices bruts anglais toujours visibles dans l'ecran programme ("3/4 sit-up", "Assisted lying calves stretch") : XCUT-06 connu, fix/uat-run1. |

## Run3 (2026-11-13, branche uat/run3) - a lire apres UAT-RESULTS.md
| Id | Verdict | Detail |
|---|---|---|
| B bouton page programme | PASS | Onglet Seance : bouton fixe "Demarrer la seance d'aujourd'hui · Lower" (vendredi) ; ecran ouvert = "Lower", "8 exercices", apercu des 8 exos (`uat-evidence/06/B-start.png`). |
| D semaine type | PASS | 7 lignes L..D : L Full Body Power, M(ardi) Repos, M(ercredi) Upper, J Repos, V Lower, S Repos, D Repos (4 repos / 3 seances) (`06/D-semaine.png`). Jours explicites non testes. |
| E detail depuis Recent | PASS (accueil) | Accueil > Recent > "UAT Seance S1" : DUREE 50 min / VOLUME 1.00 t / SERIES 4 / EXOS 1 + liste exos/series (`06/E-detail.png`). Ecart : VOLUME recalcule depuis les series (1 t) alors que la fixture portait 3000 kg. Retour et "Seances recentes" : NON verifies. |
| F seance rapide | PARTIEL (statique) | Mode libre impossible a ouvrir (seance guidee "Lower" persistee dans le store apres relance). Lecture de `apps/mobile/app/(app)/workout/session.tsx` : Ionicons `barbell-outline` (l.1526/1641), "Terminer", "Poids (kg)" ; aucun emoji U+1F3xx ; glyphes "✓" l.1109/1114 avec texte ANGLAIS "Min reached!/Target reached!". |
| Obs. | | Semaine type : noms bruts anglais ("3/4 sit-up") vs apercu seance en francais : XCUT-06 connu. |

## Run 6 (2026-11-13, uat/run6)
- A (Allez c'est parti) PASS
- C (Terminer sans serie + variante 1 serie) PASS
- Sauvegarder & fermer : FAIL critique, Unmatched Route (summary.tsx:63 route (tabs) inexistante ; summary.tsx:31 replace au rendu)
- Ecarts : seance nommee 'A', '1 series completees', 'HIGHLIGHT' EN, seance ouverte restante apres 2e demarrage
- B, D, E, F, mode libre : NON-TESTE
Detail : ../../UAT-RESULTS-run6.md

## Run 7 (2026-11-13) : verification FIX-UAT-RUN6
| Critere | Verdict | Preuve |
|---|---|---|
| `Sauvegarder & fermer` | PASS | seance rapide (1 serie) -> Terminer -> resume -> `Sauvegarder & fermer` atterrit sur l'onglet Entrainement, pas d'Unmatched Route (p6-after.png) |
| Accueil rafraichi sans relance | PASS | tuile Charge `2/4` -> `4/4 séances` apres retour; ecart : +2 pour une seule seance et incoherence avec `2 séances sur 4 prévues` (onglet Entrainement) |
| Resume | PASS partiel | `Temps fort`, `1 série complétée` OK; reste `1 séries · meilleure : —` (pluriel) et `0 kg` de volume pour 12x60 kg |
| Cold start avion != Bienvenue | PASS | accueil affiche, pas d'onboarding. Ecart : au meme demarrage `Communauté se débloque au niveau 3. Tu es niveau 1.` alors que le niveau en base est 3 |
| Defi collectif 1 participant | PASS | `Total masqué (moins de 3 participants)`, `1 participant`, `Ma contribution : 4000`, pas de barre (p26-collective.png) |

## Run 7 (suite) : Flows B / D / E
| Flow | Verdict | Preuve |
|---|---|---|
| B bouton `Démarrer la séance d'aujourd'hui · Séance` | PASS partiel | present en bas de la page programme avant effacement des donnees locales ; la seance ouverte s'appelle `Séance rapide` (nom du bouton `Séance` != titre de la seance ouverte) |
| Entrainement vs Programmes | FAIL | apres reconnexion (effacement des donnees de l'app) l'onglet Entrainement affiche `Aucun programme actif` alors que `ziko_workout_programs.is_active=true` et que la liste `Programmes` montre `Force 5x5, bloc 2` `ACTIF` (`start_date` null). Avant l'effacement le meme ecran montrait le programme (etat local persiste) : l'onglet ne relit pas la base |
| D semaine type | NON-TESTE / BLOQUE | le programme coach `Force 5x5, bloc 2` ouvre le constructeur avec `0 jours / semaine` (aucun jour en base) ; il faut activer `UAT Full Body 3x8` pour tester (p6-prog.png) |
| E detail depuis Recent | NON-TESTE | budget |
