# UAT-RUN10 RESUME
Resultats : `UAT-RESULTS-run10.md`. Reprise comme `UAT-RUN9-RESUME.md` + pieges nouveaux :
- `npm install --no-save` : UNE seule instance (la concurrence corrompt node_modules) ; ~6 min.
- Git Bash : `MSYS_NO_PATHCONV=1` pour `adb shell uiautomator dump //sdcard/u.xml` ; lien profond `adb shell am start -a android.intent.action.VIEW -d 'ziko://gamification/dashboard' com.ziko.mobile` (apostrophes, sinon sh syntax error) ; Atelier = `ziko://workout/atelier`.
- Navigation par coordonnees (1080x2400) : onglets Accueil 180,2250 / Entrainement 540,2250 / Profil 900,2250 ; tuile eau Quick Log 158,2088 (+250 ml).
- Colonnes : `ziko_user_quests(slug,title,icon,metric,target,unit,scope,source,status,progress,reward_coins,period_start,expires_at,ai_meta)`, `ziko_user_gamification(coins,current_streak,...)`.
Etat branche : quete `run10-eau` completee+versee, solde pieces 500476, `Bloc de force` actif.
A faire : clavier Atelier, puis flows 2 a 5 de la liste run 9.
