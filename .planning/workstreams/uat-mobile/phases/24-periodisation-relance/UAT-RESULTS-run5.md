# P24 : resultats run 5 (re-verification des corrections run 4)

Env : emulateur, branche `uat-v1-20`, base milestone/v1.20 (51121da5). Captures : `uat-evidence/run5/p24-start-1|2.png` (gitignore).

| Critere | Verdict | Detail |
|---|---|---|
| Demarrage de la seance prevue (exercice "Squat") | FAIL en l'etat, PASS avec fixture | Sur le catalogue reel de la branche (1318 lignes) la requete `ziko_exercises name ilike *back*squat*` renvoie 0 ligne : ni "Squat" ni "Back Squat" n'existent (seed.sql en a un, l'import du catalogue non). L'alias `GENERIC_ALIASES squat -> back squat` (`apps/mobile/src/lib/exerciseMatch.ts`) ne trouve donc rien, le repli "unique plus proche" est ambigu (>20 "...squat") -> alerte "Seance indisponible ... (Squat)" + bouton "Modifier le programme". Le repli d'alerte est conforme. Apres insertion d'une ligne fixture `Back Squat` (branche) : la seance demarre, nom FR resolu "Squat arriere", 1 exercice. Toast "non resolus" : non observable (rien de non resolu). |
| Seance fantome | PASS | Une seance demarree sans serie validee : ligne supprimee en base au redemarrage (`ended_at is null` = 0 ligne), aucun bandeau "Seance en cours" apres `force-stop` + relance, Entrainement sans "Reprendre". La cloture auto > 6 h avec series : NON-TESTE (pas de seance perimee a seeder sans ecrire des series). |
| Reactivation d'un programme termine (2901) | PASS (donnees) | `completed_at` remis a NULL en base apres "Reactiver" depuis la bibliotheque (Bloc de volume : 100 % / Termine -> actif). |
| Bandeau "Programme termine" apres reactivation | FAIL (mineur) | Reste affiche sur l'onglet Entrainement : il est pilote par la ligne `ziko_program_relaunches` `status=proposed` (`apps/mobile/src/lib/periodization.ts`), non annulee a la reactivation. A trancher (attendu run 3/4 : disparition). |
| P24 B..F (bilan, relance auto) | NON-TESTE | budget de contexte |

Rappel cause racine : le correctif depend d'une ligne du catalogue absente ici ; a verifier sur le catalogue de prod (si "Back Squat" y est absent, l'alias est sans effet : preferer un appariement par groupe/nom FR "squat").
