# Phase 8 - UAT-PLAN (emulateur, Maestro/adb)

Prerequis : build dev-client (P1), compte de test avec **base de test** (jamais prod), `adb` sur AVD `ziko-uat-1` (5554/5555), verrou machine pris. Date de reference notee `D` (`adb shell date`). Capture a chaque etape : `adb exec-out screencap -p > P8-<id>.png`.
Preparation donnees : compte neuf (0 log) pour U1/U5-vide ; puis compte avec 0 log eau/poids/humeur/repas aujourd'hui.

| Id | Req | Etapes | Critere mesurable (PASS) |
|---|---|---|---|
| U1 | QLOG-01 | Accueil, tuile eau (texte `0.00L`). Taper la tuile 3 fois (attendre 1 s entre chaque) | Texte tuile = `0.75L` apres 3 taps ; apres pull-to-refresh toujours `0.75L` ; base : 3 lignes `ziko_hydration_logs` date=D, somme 750 |
| U2 | QLOG-01 | 12 taps supplementaires (15 logs) | Tuile = `3.75L` ; aucun message de limite ; 15 lignes en base |
| U3 | QLOG-01 | Tuer l'app (`adb shell am force-stop`), relancer | Tuile eau = meme total (source = base) |
| U4 | QLOG-02 | Tuile Poids -> saisir `72,4` -> Confirmer | Tuile affiche `✓ logué` + bord ambre ; 1 ligne `ziko_body_measurements` weight_kg=72.4 date=D |
| U5 | QLOG-02 | Force-stop + relance | `✓ logué` toujours present sans action |
| U6 | QLOG-02 | Re-ouvrir Poids : champ prerempli `72.4` ; saisir `71.9` -> Confirmer | Toujours 1 seule ligne du jour (valeur 71.9), pas de doublon |
| U7 | QLOG-02 | Saisir `abc` ou `5` | Alerte "Poids invalide", aucune ligne creee |
| U8 | QLOG-03 | Tuile Humeur -> choisir 4/5 (icone) | `✓ logué` + bord vert ; 1 ligne `ziko_journal_entries` mood=4 date=D context dans {morning,general,evening} |
| U9 | QLOG-03 | Force-stop + relance ; rouvrir la feuille, choisir 2/5 | Statut persiste ; la ligne du jour passe a mood=2, toujours 1 ligne ; icones non choisies attenuees |
| U10 | QLOG-02/03 | Changer la date de l'emulateur au jour suivant (`adb shell cmd ... date`/reglage), relancer | Poids et Humeur repassent a l'etat non logue (pas de `✓ logué`) ; eau repart a `0.00L` |
| U11 | QLOG-02/03 | Fuseau : regler l'emulateur sur UTC-10 puis UTC+13, loguer eau a 23:50 local | Ligne en base `date` = date LOCALE (pas UTC) ; tuile coherente |
| U12 | QLOG-04 | Compte avec 2 repas (500 + 700 kcal) ; accueil | Tuile Repas affiche `1200 kcal` ; tap -> ecran `nutrition/log` ouvert (existant) |
| U13 | QLOG-04 | Compte 0 repas | Tuile Repas sans ligne kcal |
| U14 | QLOG-05 | Compte 0 donnee du jour | Carte Forme : titre "Pas encore de donnees aujourd'hui", texte explicatif, bouton "Loguer un repas", AUCUN anneau/score "0" ; tap bouton -> `nutrition/log` |
| U15 | QLOG-05 | Loguer 1250 ml d'eau (5 taps) puis relancer | Carte avec anneau ; score = 50 (eau seule : 1250/2500) ; ligne Hydratation `1.3L / 2.5L` |
| U16 | QLOG-05 | Ajouter nuit 8 h + 1100 kcal | Score = round((100+50+50)/3) = 67 |
| U17 | Charte | Parcourir l'accueil | Pas d'emoji, icones Ionicons, fond `#F7F6F3`, bas de scroll non masque par la tab bar (paddingBottom 100) |
| U18 | Erreur | Mode avion puis tap eau | Alerte "Eau non enregistree", tuile revient au total precedent |

Commandes utiles : `adb shell input tap X Y` (coordonnees via `uiautomator dump`), `adb shell am force-stop <pkg>`. Maestro : selecteurs par texte (`0.00L`, `✓ logué`, `Loguer un repas`) ; ajouter `testID` si besoin (non pose ici).
Verification base (lecture seule base de TEST) : `select date, amount_ml from ziko_hydration_logs where user_id=... and date=D`.
