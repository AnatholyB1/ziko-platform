# Phase 1 - Harness UAT Android : SUMMARY

Branche `phase/01-harness-uat-android`. Scripts dans `scripts/uat/` (README), flow `.maestro/demo-login-nav.yaml`, profil EAS `uat-dev`.

## Prouve (execute ici)
- HARN-01 : AVD `ziko-uat-1` cree sans avdmanager (`avd-create.sh`), demarre headless via `emu-start.sh` (Android 16, Play Store present, RAM 2 Go), boot < quelques minutes, adb OK. Preuve : `uat-evidence/01/emu-boot/home.png` (gitignore, local au worktree).
- GPS (`adb emu geo fix`) et mise en arriere-plan (HOME) executes sans erreur sur l'emulateur ; arret par PID du port 5554 verifie ; verrou machine pris/rendu (`queue.sh`, log `uat-queue.log`).
- Maestro 2.12.1 installe hors repo (`~/.ziko-uat/maestro`), `maestro --version` OK.
- HARN-07 : convention + `check-migration-names.mjs` (OK sur etat actuel) + `supabase/migrations/README-v1.20.md`.
- Garde anti-prod : le script refuse l'URL `ubxllsvanurkwkohzxau` (exit 2) ; `--dry-run` de create-accounts / reset-data / sim-session-expiry OK (aucun appel reseau).

## NON prouve
- HARN-02 : aucun APK dev-client (pas de `eas login`/build) ; le flow Maestro n'a jamais tourne, selecteurs (textes login) a confirmer.
- HARN-03 : create-accounts/reset-data jamais executes pour de vrai (pas de cle). La branche `uat-v1-20` etait VIDE (aucune table `ziko_*` via information_schema) : il faut y appliquer le schema avant. Noms de colonnes (`role`, `onboarding_done`, `status`, `tier`...) deduits du code/migrations, non verifies ; la liste WIPE tolere les tables absentes.
- HARN-05 : session-expiry (ban admin) non execute ; camera virtuelle (poster VirtualScene dans `Toren1BD.posters`) non verifiee, peut exiger un chemin different.
- HARN-04 : helper `evidence.sh` : `shot` verifie ; `run` (maestro + logcat) non execute.
- Pas teste : cle publishable branche pour le build (secrets EAS a definir par l'utilisateur).

## Besoins humains
`eas login` + build `uat-dev` ; fichier `.uat/env` ; schema applique sur la branche ; secrets EAS.
