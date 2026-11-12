# Phase 2: Session & authentification robustes - Context

**Gathered:** 2026-11-12 (recap chantier 1). Req : SESS-01..04.

## Decisions verrouillees
- **D-01** Rafraichir le token au retour au premier plan : `AppState` change -> `supabase.auth.startAutoRefresh()` en actif, `stopAutoRefresh()` en arriere-plan (patron officiel Supabase RN), plus un `getSession()`/`refreshSession()` explicite au retour de l'arriere-plan si l'expiration est proche ou depassee.
- **D-02** Session expiree/irrecuperable (refresh echoue, 400/401 `invalid_grant`) : etat detecte dans `authStore`, redirection propre vers `/(auth)/login` avec un message court (showAlert, pas `Alert`), sans fermer l'app, sans boucle. `onAuthStateChange` : la subscription reste stockee dans `(get() as any)._authSubscription` (regle CLAUDE.md).
- **D-03** Plus aucun "Utilisateur non connecte" tant que la session est valide : trouver tous les sites qui lisent `user`/`session` de facon perimee (cache MMKV, closure obsolete, `getUser()` avant refresh) et les faire passer par une source unique a jour (helper `getFreshSession()`/`requireUser()`).
- **D-04** SESS-04 : diagnostiquer "Impossible d'envoyer la demande" (recherche globale / ajout d'ami). Verifier si meme cause que la session ou cause distincte (RLS, schema `ziko_*`, route backend). Ecrire le diagnostic dans `02-DIAGNOSTIC-friend-request.md` ; corriger si la cause est dans le perimetre auth, sinon transmettre a P21 avec reproduction precise.
- **D-05** Tests : unitaires (vitest) du gestionnaire de session avec client supabase mocke (expiration, refresh ok/ko, retour premier plan). UAT emulateur (expiration simulee, arriere-plan) en file apres P1 + branche de test : le builder prepare les flows Maestro/scripts mais ne bloque pas dessus.
- **D-06** Aucune ecriture en base reelle ; aucune migration.

## Contexte code
`apps/mobile/src/stores/authStore.ts`, `apps/mobile/src/lib/supabase*`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(auth)/`, `apps/mobile/src/components/SearchOverlay.tsx`, plugin `community` (amis), journal (`plugins/journal`).

## Zones grises restantes
Aucune produit. Detail technique laisse au builder (documenter dans le plan).
