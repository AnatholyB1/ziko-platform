# Phase 2 : verification goal-backward (audit/phase-2)

Methode : relecture du code a la tete du merge `phase/02-premier-entrainement`, comparaison a ROADMAP phase 2, CONTEXT D-01..D-08, contrat (18 controles), plan/summary. Rien de tout cela n'a ete tenu pour acquis. Aucun rendu natif (pas d'emulateur) : tout controle visuel/tactile est HUMAN_NEEDED.

## Exigences
| Id | Verdict | Preuve |
|---|---|---|
| FWKO-01 | VERIFIED (code) / HUMAN_NEEDED (rendu) | `index.tsx:678` carte avant Forme du jour (l.686) et Mission (l.768) ; `firstWorkoutVisibility` R1/R4. Ordre carte < Mission < Quetes tient (P2-2) ; Forme du jour s'intercale (ecart 4, voir ci-dessous) |
| FWKO-02 | VERIFIED | `computeCreditView` sur `/ai/workshop/info`, aucun montant en dur, repli « Consomme des crédits IA » ; tests 3 != 4 |
| FWKO-03 | VERIFIED (code) | `FIRST_WORKOUT_PATHS[0].route = /(app)/workout/program-builder` |
| FWKO-04 | VERIFIED (code) | route `ai-generate` |
| FWKO-05 | VERIFIED (code) | route `atelier` |
| FWKO-06 | PARTIAL | cles `['workouts','finished']` + `['program','active']` dans `HOME_QUERY_KEYS`, invalidation par refocus ; cohabitation Mission (variante vide masquee, mission d'onboarding conservee). Disparition sans relance et absence de clignotement non observees (HUMAN_NEEDED) |
| FWKO-07 | PARTIAL | « Crédits épuisés » avant ouverture, Manuel propose, tap -> `showExhaustionSheet` : verifie en code. Reserve : erreur de lecture des seances seules garde la carte (contredit R4/P2-9, MEDIUM) |
| CLAR-01 | VERIFIED (code) | `workout/index.tsx` : « Créer un programme » -> feuille (jamais `ai-generate`), « Générer une séance IA » -> `ai-generate`, « + » libelle `Créer un entraînement` 44 dp ; texte `programs.tsx` aligne. Reserve LOW : cout absent de la feuille « + » pour un athlete avec programme |
| CLAR-02 | VERIFIED (code) | `step-7.tsx` : chaines interdites absentes, `handleFinish` inchange, `ziko-chat`, fond sombre. Reserve MEDIUM : pas de reduced motion sur le chargement |

## Controles du contrat
P2-1 HUMAN (estimation ~590 dp de bas de carte sur 844, large marge) · P2-2 VERIFIED code · P2-3 VERIFIED (tests rendu) · P2-4 VERIFIED code · P2-5 VERIFIED · P2-6 PARTIAL · P2-7 VERIFIED code · P2-8 VERIFIED code · P2-9 PARTIAL (voir FWKO-07) · P2-10 HUMAN (squelette a 400 ms ; programme actif -> `hide` immediat) · P2-11 VERIFIED code · P2-12 VERIFIED code · P2-13 VERIFIED code (texte) / HUMAN (profil reel) · P2-14 HUMAN · P2-15 HUMAN (couleurs conformes aux valeurs du contrat) · P2-16 PARTIAL (carte : fondu 100 ms, sans translation ; onboarding : manque) · P2-17 VERIFIED · P2-18 HUMAN.

## Jugement des ecarts du builder
1. Seances en erreur, carte affichee : A CORRIGER (MEDIUM) ; masquer sur toute erreur de lecture.
2. Badge « Conseillé » : ACCEPTE (decision D-02, utilisateur) ; documenter dans la maquette, ajouter a l'etiquette d'acces.
3. Step-7 sombre : ACCEPTE (D-06). Tension avec la regle projet « pas de dark mode » : ecran deja sombre avant la phase.
4. Forme du jour : la prémisse « Forme du jour est AU-DESSUS de la carte » est inexacte. La carte est avant Forme du jour ; ROADMAP SC1 (« toute première carte ») est satisfait. L'ecart reel est que Forme du jour s'intercale entre la carte et Mission du jour (R2 / H01). Classe MEDIUM (non bloquant) : deplacer le bloc `index.tsx:686-766` apres le slot Quetes (l.774) ou le masquer tant que la carte est visible.
5. Quota quotidien : ACCEPTE et CORRECT (le quota `chat` est quotidien) ; corriger la maquette H08.
6. Clignotement de chargement sans reduced motion : A CORRIGER (MEDIUM), egalement la pulsation d'icone.

## Porte
type-check 24/24, lint 5/5 (mobile : « no eslint config, skipped »), `turbo run test` 7/7 : mobile 611 + 108 rendu, api 581 (3 skipped, 14 todo), web 333 (9 skipped). Resultats issus du cache turbo.
