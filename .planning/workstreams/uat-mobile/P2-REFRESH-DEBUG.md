# P2 - Doute "pas de refresh au retour premier plan" (run 1, point 6)

Verdict: PAS de defaut de code prouve. Le point 6 du run 1 est un artefact de protocole.

## 1. Trace du code (retour premier plan)
`authStore.initialize` -> `AppState 'change'='active'` -> `sessionManager.handleForeground()`:
1. `client.startAutoRefresh()` (supabase-js: relance le ticker 30 s et fait un tick immediat).
2. `ensureFreshSession()` -> `getSession()` : auth-js `__loadSession` refresh si `expires_at*1000 - Date.now() < EXPIRY_MARGIN_MS`
   (= 3 ticks x 30 s = **90 s**, auth-js 2.99.2) ; puis notre seuil `REFRESH_SKEW_SECONDS = 60` appelle `refreshSession()` si `< 60 s`.
3. Refresh ok -> `TOKEN_REFRESHED` (silencieux, aucune UI) ; refus permanent (400/401/403, `refresh_token_not_found`, `invalid_grant`...) -> `expired` -> `handleExpired` (signOut local + alerte unique + redirection login) ; erreur reseau -> `offline` (on garde la session).

## 2. Pourquoi l'UAT n'a rien vu
- Avancer l'horloge ne change pas ce que le serveur accepte : un **refresh token** n'expire pas selon l'horloge du client (seul le JWT `exp` est compare, localement). Au retour, le client rafraichit, le serveur accepte, resultat = `ok` invisible (pas de deconnexion, pas d'alerte). Un refresh reussi n'a AUCUN effet visible : l'agent attendait un signal qui n'existe pas.
- A +400 jours le certificat TLS de Supabase est "expire" pour l'appareil : le fetch echoue -> chemin `offline` (session conservee) ; toujours pas de signal.
- Changer l'heure de l'emulateur ne declenche pas `AppState` : seul un vrai aller-retour background/foreground l'appelle.

## 3. Preuve (test realiste)
`apps/mobile/src/lib/__tests__/sessionRefreshReal.test.ts` : vrai `GoTrueClient` (auth-js), `fetch` mocke, `Date` factice.
- JWT valide 1 h : aucun appel reseau au foreground.
- JWT expirant dans 45 s : 1 refresh, nouvelle session (`rt1`).
- Horloge +2 jours : refresh tente et accepte -> `ok` silencieux.
- Refresh refuse (`refresh_token_not_found`, 400) : `expired`.
4/4 verts. Les 23 tests existants (client mocke) ne prouvaient que la logique du manager ; ceux-ci prouvent l'interaction reelle avec la marge supabase-js.
Non couvert (inchangeable sans emulateur) : cablage `AppState` natif et `handleExpired` dans `authStore` (react-native non mocke).

## 4. Protocole UAT fiable (sans manipulation d'horloge)
Observer le refresh : logs reseau, pas l'UI. Chemin refuse : deconnexion + alerte "Session expirée".

A. Chemin "refresh refuse -> deconnexion propre + alerte" (cible : branche `uat-v1-20`, ref `oloobswzsziidjwycthm` UNIQUEMENT)
   1. App connectee en athlete UAT. Mettre l'app en arriere-plan (Home).
   2. Soit `node scripts/uat/sim-session-expiry.mjs --seconds=120` (ban admin 120 s : refresh -> 403 `user_banned`, classe permanente), soit invalider cote DB (execute_sql, project_id `oloobswzsziidjwycthm`, verifier avant l'appel) :
      `delete from auth.sessions where user_id = (select id from auth.users where email = '<email athlete uat>');` (cascade sur `auth.refresh_tokens`) - compte UAT uniquement.
   3. **Forcer le refresh** : le JWT existant est encore valide ~1 h, donc le client ne refresh pas. Il faut un JWT proche de l'expiration : soit attendre, soit (mieux) rendre le test deterministe en sessions a JWT court : `jwt_exp` de la branche a 300 s (Dashboard branche > Auth > JWT expiry ; l'API de gestion n'est pas accessible via `execute_sql`), puis se reconnecter, attendre > 4 min en arriere-plan avant l'etape 2.
   4. Revenir au premier plan -> attendu : alerte "Session expirée" une seule fois, redirection `/(auth)/login`, pas de boucle.
B. Chemin "refresh reussi" : meme jwt_exp 300 s, retour apres > 4 min sans rien casser -> `adb logcat`/proxy : un `POST /auth/v1/token?grant_type=refresh_token` 200 ; l'app reste connectee.
C. Sans reglage JWT : la couverture automatique (section 3) fait foi pour la marge/horloge ; l'UAT device ne verifie que le chemin A (alerte + redirection), a declencher quand le JWT est a < 90 s de l'expiration ou via `jwt_exp` court.
Ne pas utiliser : changement d'horloge emulateur (invalide TLS, n'exerce pas le serveur).
