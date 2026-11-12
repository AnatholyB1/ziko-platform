# Phase 3 - Plan UAT emulateur (HABT-01, HABT-02)

Flow Maestro : `.maestro/p03-habits-crash.yaml`. Harnais : `scripts/uat/README.md` (file d'attente `queue.sh`, preuves `evidence.sh`).
Compte : athlete UAT (voir README harnais). Base : branche Supabase jetable uniquement, jamais la prod.

## Pre-requis
- Build dev-client `uat-dev` (la route de test est active car `__DEV__` est vrai ; sur un build de production elle redirige vers l'accueil sans jamais lever d'erreur). Alternative explicite : definir `EXPO_PUBLIC_UAT_CRASH_ROUTE=1` pour le build.
- Compte athlete connecte (niveau >= 1 suffit, Habitudes est de niveau 1).
- Etat de donnees a couvrir : 2 passes, (a) compte sans habitude, (b) compte avec les 4 habitudes par defaut + au moins un rappel `reminder_time` (ex. `09:00`).

## Route de test gardee (erreur de rendu forcee)
- Fichier : `apps/mobile/app/(app)/(plugins)/crash-test/index.tsx`, lien profond `ziko://crash-test` (ou `adb shell am start -a android.intent.action.VIEW -d "ziko://crash-test" com.ziko.mobile`).
- Garde : `__DEV__ || EXPO_PUBLIC_UAT_CRASH_ROUTE === '1'`, sinon `<Redirect href="/(app)/" />`. Elle vit sous `(plugins)`, donc sous la meme `ErrorBoundary` que les 19 plugins.
- A retirer ou laisser inactive pour la release store (elle est inerte en prod par la garde).

## Etapes (a executer par Claude, apres P1)
| # | Action | Attendu | Preuve |
|---|--------|---------|--------|
| 1 | Accueil > "Tous mes outils" > Habitudes (ouverture 1) | Ecran Habitudes (header "Habits", onglets Aujourd'hui / Historique / Nouvelle), toujours present apres 5 s (fetch + rappels differes de 1,5 s passes) | capture `02-habits-stable`, `logcat.txt` sans `FATAL EXCEPTION` ni `ReactNativeJS: Error` |
| 2 | Retour (chevron) puis rouvrir (ouverture 2) | Identique | capture |
| 3 | Retour (touche systeme Android) puis rouvrir (ouverture 3) | Identique | capture |
| 4 | Repeter 1-3 en mode avion (`sim.sh network off`) | Pas d'ecran blanc : soit l'ecran habitudes vide, soit l'ecran d'erreur reseau avec bouton "Retour" fonctionnel (header present pendant le chargement) | capture + retour effectif |
| 5 | Repeter 1 apres `sim.sh session-expiry` | Idem etape 4 (pas de blocage) | capture |
| 6 | Ouvrir `ziko://crash-test` | Ecran "Ce module a rencontre un probleme" (icone Ionicons, boutons "Reessayer" et "Retour a l'accueil"), pas d'ecran blanc | capture `03-module-error-screen` |
| 7 | "Reessayer" | L'erreur reapparait (cause permanente), l'app reste utilisable | capture |
| 8 | "Retour a l'accueil" | Accueil affiche | capture `04-back-home` |
| 9 | Depuis l'ecran d'erreur, ouvrir un autre module via l'accueil | Le module s'ouvre normalement (la garde se reinitialise au changement de route) | capture |

Criteres d'acceptation phase : etapes 1-3 et 6-8 vertes avec captures ; etapes 4-5 vertes ou ecart documente.

## Ce que l'emulateur doit trancher
La cause racine exacte du blanc d'origine n'a pas pu etre reproduite hors appareil (voir SUMMARY.md). Si l'etape 1 echoue malgre les correctifs : recuperer `logcat.txt` (stack `ReactNativeJS`) et l'evenement Sentry du 2026-11-12 16:03 (tag `plugin=habits`) et relancer /gsd-debug sur la trace reelle.
