# UAT-PLAN Phase 11 : Hydratation (emulateur Android 1080x2400 / 420 dpi, apres P1)

Prerequis : migration `202612011101_ziko_hydration_settings.sql` appliquee sur la base de TEST (jamais prod par l'agent), compte test sans ligne de reglages, build dev (expo-notifications natif requis : pas Expo Go). Reperage : `uiautomator dump`.

| Id | Flow | Attendu | Preuve |
|---|---|---|---|
| HY-1 | Onglet Aujourd'hui : appui sur +250, +500, +750, puis 10 appuis +250 espaces de 100 ms | total +quantite ; 1 ligne par appui ; les appuis < 300 ms apres le precedent sont ignores (verrou) ; 0 doublon | `select amount_ml,created_at from ziko_hydration_logs` + capture |
| HY-2 | `uiautomator dump` sur les 3 tuiles | largeur egale +-2 dp, hauteur 132 +-4, >= 44x44, gouttes alignees | bounds |
| HY-3 | Appui long 400 ms sur +500 | fond `#F0EFE9`, bord 2 dp `#CF4509`, vibration legere | capture (test unitaire haptique deja vert) |
| HY-4 | Regler les 4 reglages, arret force, relance | valeurs conservees ; 1 ligne `ziko_hydration_settings` (user_id test) | scenario + SQL |
| HY-5 | Rappels 08:00-21:00 / 90 min, Enregistrer ; `adb shell dumpsys notification` ou `getAllScheduledNotificationsAsync` | 9 planifiees, 08:00 puis 20:00 ; interrupteur eteint = 0 ; objectif atteint = 0 aujourd'hui (9 uniques demain) | dump |
| HY-6 | Refuser la permission puis rouvrir Rappels | bandeau `Notifications desactivees`, Enregistrer desactive, bouton ouvre les reglages Android | capture |
| HY-7 | Cafe 250 ml a 50 % / interrupteur eteint | +125 ml / +0 ml (rien ajoute) | SQL |
| HY-8 | Bonus 500 : sans seance objectif = base ; apres une seance enregistree aujourd'hui = base+500 ; bonus 700 | valeur mise a jour sans relance (revenir sur l'onglet) | capture |
| HY-9 | Ouvrir Objectif quotidien (clavier ouvert) | champ ET Enregistrer >= 8 dp au-dessus du clavier | uiautomator + insets |
| HY-10 | `rtk grep -nE "Toutes les 90\|Oui \(à 50\|\+500 ml" HydrationPlugin.tsx` | 0 resultat (fait : OK) | grep |

A verifier en priorite sur appareil (non prouvable ici) : `KeyboardAvoidingView` dans un `Modal` Android (`behavior="height"`) ; planification reelle des DAILY ; ouverture des reglages systeme.
