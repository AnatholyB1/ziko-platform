# UAT-PLAN Phase 25 : Mon coach complet (emulateur, en file apres P1)

Comptes : athlete de test HARN-03 lie a un coach de test qui a assigne un programme (`ziko_workout_programs.assigned_to_user_id = athlete`, `created_by_coach_id = coach`) ; un 2e athlete sans lien (HARN-04) ; un 2e code d'invitation valide du coach. Emulateur Android 1080x2400 / dpi 420, verrou machine `.planning/.machine-lock`. **Base de test/harnais uniquement, jamais la prod.** Aucun appel externe (pas d'IA, pas de mail).

## Preparation (orchestrateur, base jetable)
1. Appliquer dans l'ordre `202612012501`, `202612012502`, `202612012503` (apres 0701-0704 de P7). Rejouer chaque fichier une 2e fois : doit etre sans erreur (idempotence).
2. Lancer `backend/api` : `npx vitest run test/rls/coach-link-guard.spec.ts` avec `SUPABASE_*` de la base de test (spec exclu sans credentials). Attendu : 7 verts. **Cette etape est la seule preuve SQL/RLS : elle n'a PAS ete executee par l'agent P25.**
3. Verif manuelle SQL (psql, role authenticated simule) : `update ziko_coach_client_links set revoked_at = null where id = <lien retire>` -> 0 ligne ; `update ... set coach_id = <autre>` -> erreur `42501` ; `delete from ziko_user_plugins where plugin_id = 'coach'` en tant que proprietaire -> erreur `42501`, en `service_role` -> OK.

## Scenarios
| Id | Scenario | Attendu | Preuve |
|---|---|---|---|
| MC-1 | Athlete sans lien : Modules > Mon coach | Etat A : champ code, `Valider le code` gris tant que < 6 car. puis `#CF4509` ; pas de bloc `ANCIENS COACHS` s'il n'y a pas d'historique | capture |
| MC-2 | Saisir un code valide du coach | Etat B : photo/initiales, nom, specialites, badge KYC si verifie, bio ; `Lier mon compte` = `#CF4509`, `Annuler` zone >= 44 dp | capture + `uiautomator dump` |
| MC-3 | `Lier mon compte` | Etat C : `CoachCard` + carte `Programme de ton coach` ; ligne creee dans `ziko_coach_client_links` (`revoked_at` NULL) | capture + requete |
| MC-4 | Etat C, coach avec programme assigne, athlete sans autre programme actif | Statut `Disponible` (ou `Actif` si deja actif), nom, `3 seances par semaine · semaine x/y` ; `Voir le programme` ouvre le detail ; `Reprendre ce programme` active SANS confirmation | capture + `select is_active` |
| MC-5 | Athlete avec un programme perso actif | Statut `Remplace par ton programme` ; `Reprendre` -> alerte `Remplacer "<nom>" ?` ; `Annuler` ne change rien ; `Remplacer` -> `Actif`, l'ancien `is_active=false` (1 seul actif) | capture + requete |
| MC-6 | Coach sans programme prescrit | Carte presente : `Ton coach n'a pas encore prescrit de programme.` | capture |
| MC-7 | `Retirer ce coach` : ouvrir la modale | Texte contient `conservés` et `nouveau code`, aucun mot `supprime/perdu` ; `Retirer` gris tant que la saisie != `COACH` ; `Garder mon coach` ferme sans effet | capture |
| MC-8 | Saisir `COACH` puis `Retirer` | Alerte `Coach retire`, retour a l'etat A ; base : meme ligne avec `revoked_at` renseigne et `revoked_by = 'client'` (ligne NON supprimee) ; theme coach efface ; le programme prescrit reste dans Mes programmes (toujours actif s'il l'etait) ; ses seances/habitudes intactes | capture + requete |
| MC-9 | Apres MC-8, etat A : bloc `ANCIENS COACHS` | Replie par defaut, chevron >= 44 dp ; une fois deplie : nom du coach + `du <date> au <date>` ; 5 lignes max | capture |
| MC-10 | Se relier au meme coach avec un nouveau code | Nouveau lien actif, l'ancien reste dans l'historique ; aucun delai/blocage | capture + requete |
| MC-11 | Modules/Store (liste) > Mon coach | Bouton `Obligatoire` avec cadenas (pas de `Installe`/`Desinstaller`) ; appui -> alerte `Module obligatoire` ; la carte hero idem ; `store/[id]` : corbeille grisee inchangee | capture |
| MC-12 | Tenter la desinstallation par l'API (jeton de l'athlete) `DELETE ziko_user_plugins ... coach` | Refus `42501` ; apres redemarrage l'app Mon coach reste chargee | requete |
| MC-13 | Coupure reseau a l'ouverture de l'etat C | Carte `Impossible de charger` (P22) ; programme : `Impossible de charger le programme` + `Reessayer` si seul ce volet echoue | capture |

## Hors perimetre / suivi
Section "Mon coach" dans les reglages (non faite, D-11) ; demarrer une seance d'un programme `ziko_workout_programs` (P7/P18/P23) ; messagerie coach.
