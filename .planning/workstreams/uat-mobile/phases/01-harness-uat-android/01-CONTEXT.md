# Phase 1: Harness UAT Android - Context

**Gathered:** 2026-11-12 (depuis `MILESTONE-RECAP-2026-11-12.md` chantier 0 + decisions utilisateur du 2026-11-12). Req : HARN-01..07.

## Decisions verrouillees
- **D-01** UAT = Claude, **emulateur Android seul** (pas d'Expo Web : MMKV non supporte). Jamais l'utilisateur.
- **D-02** Machine : Windows 11, 16 Go RAM (serree), 1 emulateur, 2 max si RAM libre > 6 Go. UAT en **file** (verrou `.planning/.machine-lock`, `mkdir` atomique, perime > 25 min). Dev/migrations/maquettes restent paralleles.
- **D-03** AVD : creer **sans cmdline-tools** si besoin (ecrire `config.ini`/`.ini` dans `~/.android/avd`) ou telecharger cmdline-tools. System image DEJA presente : `android-36/google_apis_playstore/x86_64`. Nom `ziko-uat-1`, ports 5554/5555 ; `ziko-uat-2` 5556/5557. Profil leger (RAM AVD 2-3 Go, `-no-snapshot-save`, `-gpu` selon ce qui marche, `-no-boot-anim`).
- **D-04** Build de l'app = **dev-client natif via EAS cloud** (profil `development`, `buildType: apk`, `developmentClient: true`). L'utilisateur fait `eas login` lui-meme. L'agent PREPARE le profil `eas.json` (nouvelle entree, ex. `uat-dev`) + commandes documentees ; il ne lance AUCUN build cloud et ne demande aucun identifiant. Le JS se charge ensuite via Metro (port reserve 8281+).
- **D-05** Maestro : installer hors repo (binaire utilisateur) ; Java requis : `C:\Program Files\Android\openjdk\jdk-21.0.8`. Flows dans `.maestro/` (repo), un flow de demonstration login -> navigation -> captures.
- **D-06** Base UAT = **branche Supabase jetable de `portfolio`** (creee par la session principale, pas par l'agent). L'agent ecrit : `scripts/uat/create-accounts.*` (cree `uat-athlete` + `uat-coach` lies via `coach_invitations`/`coach_client_links`, API admin), `scripts/uat/reset-data.*` (etat reproductible, idempotent), `scripts/uat/README.md`. **Garde obligatoire** : les scripts lisent `UAT_SUPABASE_URL` / `UAT_SERVICE_ROLE_KEY` depuis `scripts/uat/.env.uat` (gitignore, jamais imprime) et REFUSENT de tourner si l'URL contient `ubxllsvanurkwkohzxau` ou n'est pas explicitement marquee `UAT_TARGET=branch`. Test des scripts : mode `--dry-run` seulement (aucun appel reseau reel) tant que la branche n'existe pas.
- **D-07** Preuves (HARN-04) : dossier `uat-evidence/<phase>/<flow>/` (gitignore) avec captures PNG + logcat + resultat Maestro ; le `VERIFICATION`/`UAT` de la phase cite chemins et resume. Helper `scripts/uat/evidence.*`.
- **D-08** Simulations HARN-05 : expiration de session (invalidation du refresh token cote branche via API admin, ou `adb shell` + horloge), arriere-plan (`adb shell input keyevent HOME` + `am start`), GPS (`adb emu geo fix`), camera virtuelle (scene image de code-barres dans la config AVD `VirtualScene` ou `adb emu`), toutes derivees en scripts `scripts/uat/sim-*`.
- **D-09** File UAT (HARN-06) : `scripts/uat/queue.*` pose/retire le verrou, journalise (phase, flow, debut, fin) dans `.planning/workstreams/uat-mobile/uat-queue.log`.
- **D-10** Convention migrations (HARN-07) : `supabase/migrations/20261201PPSS_description.sql`, PP phase (2 chiffres), SS 01-09. Documentee dans `supabase/migrations/README-v1.20.md` et un check `scripts/uat/check-migration-names.*` (verifie prefixe/bloc, aucune edition de migration existante).

## Hors perimetre
Pas de creation de branche Supabase, pas de build EAS, pas d'ecriture en prod `portfolio`, pas de push.

## Contexte code a scouter (builder)
`apps/mobile/eas.json`, `apps/mobile/app.json`, `apps/mobile/android/` (suivi dans git), `apps/mobile/src/stores/authStore.ts`, tables `coach_invitations`/`coach_client_links`, `supabase/migrations/`.

## Questions ouvertes pour l'orchestrateur
Aucune pour le builder ; dependances humaines : branche Supabase, `eas login`, premier build (voir DEPLOY-CHECKLIST).
