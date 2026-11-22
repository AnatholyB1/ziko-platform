# Phase 5 - Plan UAT (emulateur Android, apres P1)

Preuves : `uat-evidence/05/xcut/` via `scripts/uat/evidence.sh`. Flow : `.maestro/p05-xcut.yaml` (selecteurs a confirmer). Mesures via `adb shell uiautomator dump` (bounds) et `adb shell wm size`/`dumpsys window | grep -i statusbar` (hauteur barre de statut, notee S).

| Id | Etapes | Critere mesurable |
|----|--------|-------------------|
| XCUT-01 | Accueil, Entrainement (programme actif), Profil, Recherche, Amis : dump UI | 0 occurrence regex `[a-z]+_[a-z]+` parmi les textes visibles de goal ; "Prise de muscle"/"Perte de gras" presents |
| XCUT-02 | Seance en cours : lire le bouton de fin ; Profil > badges, Calendrier, historique | Bouton = "Terminer" ; 0 mois anglais (`May\|Jan\|Feb\|...`) dans le dump ; mois en `mai`, `nov.` |
| XCUT-02 (Pantry) | Garde-Manger : onglets du haut et du bas | Libelles "Inventaire/Recettes/Courses" et "Garde-Manger/Recettes IA/Courses" ; 0 "Pantry"/"Shopping" |
| XCUT-03 | Ouvrir Accueil, Coach IA, Profil, Workout (programme), Exercice, Resume ; faire defiler | Pour chaque ecran : `bounds.top` du texte de titre >= S (hauteur barre de statut) ; pas de double espace : ecart titre/S <= 24 px dp |
| XCUT-04 | Sur chaque ecran avec action basse (Repas, Ajouter) : uiautomator bounds du bouton vs FAB (content-desc "Signaler un bug") | Intersection(FAB, bouton d'action) = vide a la position initiale (bord gauche) OU, apres un drag du FAB (`adb shell input swipe`), le tap sur le bouton declenche son action ; FAB cliquable (ouvre le signalement) ; FAB reste au-dessus de la barre d'onglets |
| XCUT-05 | Habitudes, Sommeil, Hydratation, Nutrition, Pantry : dump des SubTabs | `bounds.left` et `screenW - bounds.right` de la barre de sous-onglets >= 16 dp (soit 16 x densite px) des deux cotes, identiques sur tous les plugins |
| XCUT-06 | Entrainement > exercices, Picker, Recherche, Resume de seance | Chaque nom d'exercice commence par une majuscule ; aucun nom tout en majuscules ; noms FR quand `name_fr` ou la table existe |
| XCUT-07 | Accueil, carte conseil | Texte de l'en-tete de carte = "Coach Ziko" seul pour le conseil par defaut (tag = "Conseil" masque ou different), jamais "Coach Ziko . Coach Ziko" |

Captures attendues : `05-home`, `05-workout`, `05-action-tappable`, `05-profile` + une par plugin pour XCUT-05.
Limites : le flow Maestro n'a pas ete execute (pas d'emulateur dans cette session) ; les selecteurs sont a ajuster.
