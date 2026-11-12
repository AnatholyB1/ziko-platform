# Phase 2 - Summary (builder)

Branche `phase/02-session-auth-robustes`. Aucune migration, aucune ecriture base.

## Livre
- `apps/mobile/src/lib/sessionManager.ts` : `ensureFreshSession` (refresh si < 60 s, dedoublonne), `requireUser`, `handleForeground/Background` (startAutoRefresh/stopAutoRefresh), `clearExpiredSession` (signOut local), `patchGetUser` (auth.getUser() sans jwt lit la session locale rafraichie), classification erreurs permanentes vs reseau.
- `apps/mobile/src/lib/supabase.ts` : exporte `sessionManager`, applique `patchGetUser` (couvre les ~100 sites `auth.getUser()` des plugins/ecrans sans les modifier, donc sans conflit avec les autres phases).
- `apps/mobile/src/stores/authStore.ts` : AppState actif -> foreground refresh + refreshLevel ; inactif -> stopAutoRefresh ; expiration (refresh ko ou SIGNED_OUT non initie par l'utilisateur) -> etat nettoye, `showAlert` unique, le layout `(app)` redirige vers `/(auth)/login` (deja `if (!session) <Redirect>`). Subscription toujours stockee/nettoyee.
- `apps/mobile/src/lib/friendRequest.ts` + `SearchOverlay.tsx` : diagnostic et correction (voir `02-DIAGNOSTIC-friend-request.md`).
- `UAT-PLAN.md` : flows emulateur U1-U4.

## Prouve
- 23 tests vitest (mocks du client auth) : refresh pres/apres expiration, none, expired (invalid_grant/400), offline transitoire, dedoublonnage concurrent, requireUser, foreground/background, clearExpiredSession local, patchGetUser (stale token rafraichi, jwt delegue, erreur si irrecuperable), classification d'erreurs, friend request (23505, RLS 42501, session). Suite mobile : 86 tests verts. `tsc --noEmit` mobile : 0 erreur.

## Non prouve
- Aucun test sur emulateur/appareil : le vrai comportement AppState/gotrue (timer auto-refresh, evenement SIGNED_OUT reel, redirection Expo Router, alerte) n'est verifie que par lecture de code. Les tests ne couvrent pas `authStore` (react-native/expo non mockes) : le cablage handleExpired/AppState est non teste unitairement.
- Cause exacte vue en UAT pour "Impossible d'envoyer la demande" (JWT perime vs doublon) non reproduite ; diagnostic par analyse RLS/schema.
- `patchGetUser` ne valide plus la session cote serveur (compte supprime/revoque) : RLS reste l'autorite ; le cas est traite par SIGNED_OUT/refresh ko.
- Sites qui lisent `useAuthStore.getState().user` (store) restent bases sur le store, mis a jour par onAuthStateChange (TOKEN_REFRESHED).

## Transmis a P21
Demande inverse/deja amis dans la recherche, `sendFriendRequest` du plugin community qui ignore l'erreur.

## Fichiers a risque de conflit
`authStore.ts`, `supabase.ts`, `SearchOverlay.tsx` (P21/P5 possibles).
