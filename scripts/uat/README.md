# Harness UAT Android (v1.20, phase 1)

Cible : emulateur `ziko-uat-1` (console 5554 / adb 5555), base = branche Supabase jetable `oloobswzsziidjwycthm`. JAMAIS la prod `ubxllsvanurkwkohzxau` (les scripts refusent).

## Secrets (hors repo, gitignores)
Fichier `.uat/env` (ou `scripts/uat/.env.uat`), lu par `lib.mjs`, jamais imprime :
```
UAT_SUPABASE_URL=https://oloobswzsziidjwycthm.supabase.co
UAT_SERVICE_ROLE_KEY=...
UAT_ANON_KEY=...                  # publishable, pour le build
UAT_ATHLETE_EMAIL / UAT_ATHLETE_PASSWORD   (defaut email uat-athlete@uat.ziko.invalid)
UAT_COACH_EMAIL / UAT_COACH_PASSWORD
```
`.uat/env` est cherche aussi dans `C:/ziko-platform/.uat/env`. Garde : l'URL doit contenir la ref de la branche.

## Mise en route
1. `bash scripts/uat/avd-create.sh` : ecrit l'AVD sans avdmanager (RAM 2 Go).
2. `bash scripts/uat/setup-maestro.sh` : Maestro dans `~/.ziko-uat/maestro` (hors repo).
3. Build dev-client (UTILISATEUR, apres `eas login`) : `cd apps/mobile && eas build --profile uat-dev --platform android`. Definir les secrets EAS `EXPO_PUBLIC_SUPABASE_KEY` (cle publishable de la branche) et `EXPO_PUBLIC_API_URL` pour le profil ; l'URL branche est deja dans `eas.json`. Telecharger l'APK.
4. Comptes : `node scripts/uat/create-accounts.mjs` ; reset : `node scripts/uat/reset-data.mjs` (`--dry-run` pour simuler).
   Prerequis : la branche doit avoir le schema `ziko_*` (au 2026-11-12 la branche etait vide : verifie).
5. Run UAT (un a la fois) :
```
bash scripts/uat/queue.sh acquire <phase> <flow>
bash scripts/uat/emu-start.sh [--window]
bash scripts/uat/install-apk.sh path/app.apk
EXPO_PUBLIC_SUPABASE_URL="$UAT_SUPABASE_URL" EXPO_PUBLIC_SUPABASE_KEY="$UAT_ANON_KEY" \
  EXPO_PUBLIC_API_URL=<url du backend UAT> npx expo start --dev-client --port 8281 --clear   # Metro, port reserve
bash scripts/uat/evidence.sh run <phase> <flow> .maestro/<flow>.yaml UAT_EMAIL=... UAT_PASSWORD=...
powershell -File scripts/uat/emu-stop.ps1
bash scripts/uat/queue.sh release <phase> <flow>
```
Pieges Metro (run 9) :
- Les noms `UAT_*` ci-dessus ne servent qu'aux scripts du harnais (`lib.mjs`, `create-accounts.mjs`...). Le bundle de l'app ne lit QUE
  `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY` (cle publishable) / `EXPO_PUBLIC_API_URL` ; sans eux : `supabaseUrl is required`.
  Les passer en variables d'environnement de la commande Metro (jamais dans un fichier commite).
- Premier bundle apres `--clear` : environ 4 minutes. Patienter, ne pas relancer Metro.
- Le dev-client expire pendant ce temps : il faut l'OUVRIR UNE SECONDE FOIS (double ouverture) une fois le bundle pret.
- Un lien profond vers un ecran deja monte ne le recharge pas : pour tester un refetch, quitter puis rouvrir l'ecran.

Preuves : `uat-evidence/<phase>/<flow>/` (PNG, `logcat.txt`, `maestro-result.xml`, `RESULT.txt`), gitignore. Citer les chemins dans le VERIFICATION/UAT de la phase.

## Simulations (`sim.sh`)
`background [s]`, `gps <lat> <lon>`, `network off|on`, `session-expiry [s]` (ban admin court => refresh echoue), `camera-barcode <png>` (poster VirtualScene, non verifie).

## Migrations
Voir `supabase/migrations/README-v1.20.md` ; check : `node scripts/uat/check-migration-names.mjs`.

## Arret emulateur
Toujours par PID du port 5554 (`emu-stop.ps1`), jamais `taskkill /IM`.
