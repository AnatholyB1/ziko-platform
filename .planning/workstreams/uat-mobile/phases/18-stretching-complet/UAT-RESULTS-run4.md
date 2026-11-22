# P18 Stretching : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Plus de "permission denied" (bibliotheque) | PASS | onglet Bibliotheque : 24 exercices (Dos 6, Jambes 6, Epaules 6, Hanches 6), aucune erreur ; logcat sans "permission denied" |
| Creer une routine (nom, 2 exercices, defaut) | PASS | routine "Reveil" enregistree, badge PAR DEFAUT |
| Lancer la routine | PASS | session pas a pas : "Accroupi profond" puis "Bras croise... cote droit 2 sur 2", bouton Terminer ; `uat-evidence/run4/p18-session.png` |
| Ecriture du suivi (`ziko_stretching_logs`) | PASS | 1 ligne creee a la fin de la routine (REST service role : count 1, 12:56 UTC) |
| Carte routine en debut de seance | PASS | "Seance rapide" : carte "AJOUTEE EN DEBUT DE SEANCE - Reveil - 2 exercices - 2 min", boutons Lecture / Passer / Modifier ; `p18-carte-seance2.png` |
| Reglage "Lancer automatiquement au debut de chaque seance" | PASS (presence) | interrupteur visible, par defaut OFF ; son effet (lancement auto a l'ouverture) NON-TESTE |

Observations :
- La carte n'apparait que si le plugin `stretching` figure dans `ziko_user_plugins` : la branche n'avait QUE `coach` pour l'athlete ; ajoute 11 plugins (fixture de verification : stretching, hydration, nutrition, gamification, supplements, ai-programs, measurements, sleep, habits, journal, timer).
- Le bouton `Terminer` de la seance de routine et le tableau de bord de seance bloquent `uiautomator dump` ("could not get idle state") a cause de l'animation du chrono : utiliser captures + `tapxy`.
- Saisie du nom de routine : `adb input text` produit du texte parasite ("E chauffer enter y") via le clavier predictif ; effacer par keyevent 67 x N puis retaper sans accent.
