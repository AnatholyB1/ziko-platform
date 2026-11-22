# UAT-BACKEND — backend Hono local pour les UAT emulateur (v1.20)

Date: 2026-11-12. Branche git `uat/backend`. Cible Supabase: branche jetable `uat-v1-20`
(ref `oloobswzsziidjwycthm`) UNIQUEMENT. Aucune ecriture sur la prod `ubxllsvanurkwkohzxau`.
Le `backend/api/.env.local` du depot principal (valeurs PROD) n'est jamais lu.

## Ports et composants
| Port | Composant | Fichier |
|---|---|---|
| 8200 | Backend Hono (`tsx --env-file=.env.uat src/index.ts`, sans watch) | `backend/api/src/index.ts` |
| 8210 | Faux Upstash Redis REST | `scripts/uat/fake-upstash.mjs` |
| 8211 | Faux Anthropic Messages API | `scripts/uat/fake-anthropic.mjs` |

## Preparation (une fois)
1. `npm install --no-save` a la racine du worktree (jamais `npm ci`).
2. `node scripts/uat/make-backend-env.mjs` — ecrit `backend/api/.env.uat` (gitignore):
   `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` lus dans `.uat/env` de l'integration, `SUPABASE_SERVICE_KEY` =
   service_role de la branche (CLI `supabase projects api-keys`, jamais affichee) et recopiee en
   `UAT_SERVICE_ROLE_KEY` dans `.uat/env` (pour `scripts/uat/*.mjs`). `CRON_SECRET`, `WEBHOOK_SECRET`,
   `EMAIL_VERIFY_RPC_SECRET` aleatoires. `RESEND/GITHUB/EXPO_ACCESS_TOKEN` vides, `OPENAI_API_KEY` factice.
   `UPSTASH_REDIS_REST_URL=http://127.0.0.1:8210`, `ANTHROPIC_BASE_URL=http://127.0.0.1:8211/v1`.

## Demarrage / arret
```bash
bash scripts/uat/backend-start.sh        # faux Upstash, faux Anthropic, backend; attend /health (60 s max)
node scripts/uat/backend-proof.mjs [--tool]   # preuves (login uat-athlete, /credits/balance, /ai/chat...)
powershell -File scripts/uat/backend-stop.ps1  # arret par PID de port (8200, 8210, 8211); jamais taskkill /IM
```
Garde dans `backend-start.sh`: refuse de demarrer si `SUPABASE_URL` ne contient pas `oloobswzsziidjwycthm`,
si la ref prod apparait dans `.env.uat`, ou si Upstash/Anthropic ne pointent pas vers les faux locaux.
Logs: `uat-evidence/backend/{backend,fake-upstash,fake-anthropic}.log` (gitignore).

## Acces depuis l'emulateur
- `http://10.0.2.2:8200` atteint le backend (PROUVE: `GET /health` -> 200 depuis `adb shell`, emulator-5554).
- `adb reverse tcp:8200 tcp:8200` + `127.0.0.1:8200`: cree sans erreur mais le test `toybox nc` n'a rien renvoye
  (non prouve, probablement limite de `nc`). Preferer `EXPO_PUBLIC_API_URL=http://10.0.2.2:8200` pour le build UAT.
- Trafic clair HTTP: verifier que le build/manifest Android UAT autorise le cleartext vers 10.0.2.2.

## Faux Upstash (8210)
Protocole REST Upstash: commande JSON en tableau (`POST /`), `/pipeline`, `/multi-exec`, encodage `Upstash-Encoding: base64`
honore, jeton `Bearer uat-fake-upstash-token`. Commandes: GET/SET(EX,PX,NX,GET)/SETEX/INCR/INCRBY/DECR/EXPIRE/PEXPIRE/
TTL/PTTL/DEL/EXISTS/MGET/MSET/KEYS/HSET/HGET/HGETALL/HDEL/HINCRBY/SADD/SREM/SMEMBERS/PING/FLUSHALL/SCRIPT LOAD/EVAL/EVALSHA.
Le script sliding window de `@upstash/ratelimit` (limit + remaining) est reimplemente en JS (les limites reelles sont
donc appliquees: 200 req/60 s par IP, `/coach/clients/links/*` 5 par 15 min par IP; `FLUSHALL` ou redemarrage = reset).
Les autres scripts (fixed window, reset) laissent passer. `GET /__health` renseigne le nombre de cles.

## Faux Anthropic (8211)
`ANTHROPIC_BASE_URL` est respectee nativement par `@ai-sdk/anthropic` (verifie dans `dist/index.js`, il faut le suffixe `/v1`):
aucun changement de code dans `backend/api/src` (prod inchangee). `POST /v1/messages` en JSON et SSE
(`message_start`, `content_block_*`, `message_delta`, `message_stop`, `text_delta` / `input_json_delta`).
- Par defaut: texte francais deterministe qui rappelle le message utilisateur.
- Outil force, 3 modes: (1) marqueur dans le dernier message utilisateur `[[tool:hydration_log {"amount_ml":500}]]`
  (suffixe `::force` pour emettre meme si l'outil n'est pas liste dans la requete); (2) file d'attente
  `POST http://127.0.0.1:8211/__script {"tool":"...","input":{...},"count":1}` (GET liste + journal, DELETE vide);
  (3) env `FAKE_ANTHROPIC_TOOL` / `FAKE_ANTHROPIC_TOOL_INPUT` systematique.
- Scripter 2 tours (outil puis reponse) pour LIRE le resultat/les codes d'erreur de l'outil (run3 P16): le SDK
  (`stopWhen: stepCountIs(5)`) renvoie lui-meme un 2e appel `/v1/messages` dont le dernier message est un
  `tool_result`. Le faux y repond `C'est fait ... Resultat de l'outil : <outil> [erreur] -> <contenu du tool_result>`
  (le texte remonte dans la reponse du chat) ET journalise `tool_results: [{tool, is_error, content}]` dans
  `GET /__script` -> `log[]` (dernier element). Exemple: `POST /__script {"tool":"measurements_set_goal","input":{...}}`,
  envoyer le message de chat, puis lire `log` : `content` = `{"ok":false,"error":"goal_exists"}`.
  `FAKE_ANTHROPIC_ECHO_RESULT=0` retablit l'ancien texte generique (le journal reste renseigne).
- Enchainer 2 outils: entree de file `{"tool":"b","input":{...},"afterResult":true}` = emise APRES le resultat du
  1er outil (tour 2), le texte final n'arrive qu'au tour 3. Test: `scripts/uat/fake-anthropic.test.ts` (processus reel).
- Apres un `tool_result` sans entree `afterResult`, repond le texte (pas de boucle).
- Journal des appels: `GET /__script` (champ `log`: modele, stream, nb d'outils, decision, `tool_results`).

## Preuves (2026-11-12)
- `GET /health` -> 200.
- Login `uat-athlete` via `/auth/v1/token` de la branche -> 200; `GET /credits/balance` -> 200
  `{"balance":5,"daily_earned":0,"daily_cap":4,...}`; sans token -> 401.
- `POST /ai/chat` -> 200, reponse du faux; `POST /ai/chat/stream` -> SSE `meta` + `chunk` (faux en stream).
- Outil force `hydration_log` 500 ml: 2 appels Anthropic (tool_use puis texte), ligne reellement inseree dans
  `ziko_hydration_logs` de la branche (RLS/auth/tools chaines de bout en bout).
- `npx vitest run` (backend/api): 24 fichiers passes, 300 tests OK, 3 skipped, 14 todo; aucun fichier source modifie.

## Ce que les faux ne prouvent PAS
- Qualite, ton, latence ou limites de tokens du vrai Claude; hallucinations, choix d'outil spontane, prompt caching.
- Sorties structurees (`generateObject`/`tool_choice`: import de programmes, scan nutrition vision, dashboards coach):
  le faux renvoie `{}` pour un outil impose, donc ces routes exigent un script `/__script` avec un `input` valide.
- Vrai Upstash: pas de cluster, persistance ni latence; stockage en memoire (perdu a l'arret); scripts non-ratelimit permissifs.
- Aucun mail (Resend vide), push Expo, GitHub (bug report), Whisper/OpenAI: ces chemins echouent ou sont inertes.
- Vault, cron `pg_cron`, edge functions, webhooks DB de la branche: non recrees (voir UAT-BRANCH-BOOTSTRAP.md);
  crons Vercel (`/…/cron/*`) appelables a la main avec `Authorization: Bearer <CRON_SECRET de .env.uat>`.
- Verification email applicative (`EMAIL_VERIFY_RPC_SECRET` aleatoire local, pas de row secret cote branche).
- `auth.ts`/`creditGate.ts` lisent `SUPABASE_SERVICE_KEY ?? PUBLISHABLE` : avec le service_role (comme en prod) les
  lectures credits contournent la RLS; une regression RLS sur ces tables ne serait pas vue ici.
